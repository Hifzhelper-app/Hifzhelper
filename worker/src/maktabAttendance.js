// ============================================================
// Hifzhelper -- derived maktab attendance (V3.67.0, delivery (f)).
// The last of the six maktab deliveries. NOTHING IS STORED: every value
// here is computed at read time from the three maktab log tables plus
// the haidh marks already in `attendance`. That is why V3.54.0's
// attendance-sync work deliberately never extended to the maktab tables
// -- there is no maktab attendance row to keep in sync.
//
// The rules, all confirmed in chat:
//   maktab day = a date where >= N DISTINCT students have any maktab log
//                (N from the maktab settings, delivery (g)). Dates below
//                the threshold are not maktab days at all -- nobody is
//                absent on them.
//   present    = the student has any maktab log that day. Assumed, never
//                written.
//   haidh      = a haidh/predicted-haidh row in `attendance` for that
//                date (from her PJ or a teacher's toggle -- one shared
//                store). A log always wins: the maktab save already
//                clears the mark, so a day is never both.
//   absent     = a maktab day, no log, not haidh.
//   propagation= after a haidh day, later maktab days with no logs stay
//                haidh until the student's ruling max, then ABSENT.
//                *** Counted in CALENDAR days from the haidh start,
//                NOT maktab days *** (user correction, 2026-08-16):
//                haidh is a physiological duration, so it runs on the
//                calendar whether or not the maktab met. A maktab that
//                skips a week DOES consume the allowance.
//   flag       = no maktab log for >= absence_flag_days consecutive
//                MAKTAB DAYS (that one IS counted in maktab days -- it
//                measures attendance, not biology).
// ============================================================

import { isTeacherOrAbove } from './utils.js';
import { readMaktabSettings } from './maktabSettings.js';
import { haidhOfficialMaxDuration } from '../../shared/haidhRules.js';

function daysBetweenISO(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

// Every date that qualifies as a maktab day, ascending. One UNION over
// the three tables -- the same shape releaseAttendanceIfNoActivity has
// used since V3.54.0.
export async function loadMaktabDays(env, minStudents) {
  const { results } = await env.DB.prepare(
    `SELECT date, COUNT(DISTINCT student_id) AS n FROM (
       SELECT date, student_id FROM maktab_sabaq_log
       UNION ALL SELECT date, student_id FROM maktab_sabaq_dhor_log
       UNION ALL SELECT date, student_id FROM maktab_dhor_log
     ) GROUP BY date HAVING n >= ? ORDER BY date`
  ).bind(minStudents).all();
  return results.map(r => r.date);
}

// Which (student, date) pairs have any maktab log at all.
async function loadLoggedPairs(env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT student_id, date FROM (
       SELECT student_id, date FROM maktab_sabaq_log
       UNION ALL SELECT student_id, date FROM maktab_sabaq_dhor_log
       UNION ALL SELECT student_id, date FROM maktab_dhor_log
     )`
  ).all();
  const byStudent = {};
  for (const r of results) (byStudent[r.student_id] = byStudent[r.student_id] || new Set()).add(r.date);
  return byStudent;
}

// Pure, so the harness can drive every branch without a DB: given one
// student's logged dates, her haidh marks and her ruling, decide her
// status on each maktab day, plus whether she should be flagged.
export function deriveStudentAttendance(maktabDays, loggedDates, haidhDates, ruling, absenceFlagDays) {
  const logged = loggedDates instanceof Set ? loggedDates : new Set(loggedDates || []);
  const haidh = new Set(haidhDates || []);
  const maxDays = haidhOfficialMaxDuration(ruling);
  const sortedHaidh = [...haidh].sort();

  // The haidh RUN a date belongs to: the earliest haidh mark reachable
  // by walking back through consecutive marked dates. Propagation is
  // measured from that start, in calendar days.
  const runStartFor = (date) => {
    let start = date;
    while (haidh.has(start)) {
      const prev = new Date(new Date(start + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
      if (!haidh.has(prev)) break;
      start = prev;
    }
    return start;
  };

  const statuses = {};
  for (const date of maktabDays) {
    if (logged.has(date)) { statuses[date] = 'present'; continue; }   // a log always wins
    if (haidh.has(date)) { statuses[date] = 'haidh'; continue; }      // explicitly marked

    // Not marked, but possibly still inside a run that started earlier.
    const priorStart = sortedHaidh.filter(d => d < date).pop();
    if (priorStart) {
      const start = runStartFor(priorStart);
      // elapsed is 0-based from the start date: start itself is day 1,
      // so a hanafi max of 10 covers start .. start+9.
      if (daysBetweenISO(start, date) < maxDays) { statuses[date] = 'haidh'; continue; }
    }
    statuses[date] = 'absent';
  }

  // The flag counts CONSECUTIVE MAKTAB DAYS with no log, most recent
  // backwards -- any log resets it. Haidh days still count as "no log"
  // for this purpose: the flag is about a student the maktab has not
  // heard from, whatever the reason, and a teacher seeing it can judge.
  let streak = 0;
  for (let i = maktabDays.length - 1; i >= 0; i--) {
    if (logged.has(maktabDays[i])) break;
    streak++;
  }
  return { statuses, noLogStreak: streak, flagged: absenceFlagDays > 0 && streak >= absenceFlagDays };
}

// GET /maktab/attendance?date=YYYY-MM-DD  (teacher+)
// One date's derived status for every active student, for the summary,
// plus the attention flag. The summary already knows who logged what
// that day; what it cannot know without this is absent-vs-haidh-vs-not-
// a-maktab-day, and the streak.
export async function handleMaktabAttendance(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date must be YYYY-MM-DD', status: 400 };

  const settings = await readMaktabSettings(env);
  const maktabDays = await loadMaktabDays(env, settings.maktab_day_min);
  const isMaktabDay = maktabDays.includes(date);

  const { results: students } = await env.DB.prepare(
    'SELECT id, haidh_ruling FROM students WHERE active = 1 AND role = \'student\''   // V3.77.0 (j): same roster rule as the summary
  ).all();
  const logged = await loadLoggedPairs(env);
  const { results: haidhRows } = await env.DB.prepare(
    `SELECT student_id, date FROM attendance WHERE status IN ('haidh','predicted-haidh')`
  ).all();
  const haidhByStudent = {};
  for (const r of haidhRows) (haidhByStudent[r.student_id] = haidhByStudent[r.student_id] || []).push(r.date);

  const out = {};
  for (const s of students) {
    const d = deriveStudentAttendance(
      maktabDays, logged[s.id] || new Set(), haidhByStudent[s.id] || [],
      s.haidh_ruling || 'hanafi', settings.absence_flag_days
    );
    out[s.id] = {
      // null when the date isn't a maktab day at all: nobody is absent on
      // a day the maktab didn't run.
      status: isMaktabDay ? d.statuses[date] : null,
      noLogStreak: d.noLogStreak,
      flagged: d.flagged,
    };
  }
  return { data: { date, isMaktabDay, maktabDayCount: maktabDays.length, attendance: out } };
}
