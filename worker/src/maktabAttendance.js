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

import { isTeacherOrAbove, isValidDate, maktabTodayISO } from './utils.js';
import { termContainingToday } from './maktabCalendar.js';   // V3.87.0: terms drive attendance
import { readMaktabSettings, teachingDaysOf, WEEKDAY_KEYS } from './maktabSettings.js';   // V3.98.0
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

// ============================================================
// GET /attendance/page[?student_id&from&to] — V3.80.0, the attendance
// page (the original list-of-11 intent behind item 5, stated in full
// 2026-08-28). One student's attendance over a PERIOD, computed here so
// the frontend makes one call, not one per day.
//
//   period    = ?from/?to when given (the page's custom option), else the
//               CURRENT TERM from maktab settings (migration 0025), else
//               the last 4 weeks ending on the maktab's own today.
//   "day"     = MAKTAB DAY (the user's standing definition, 2026-08-28);
//               haidh stays on calendar days — both exactly as
//               deriveStudentAttendance has always computed them.
//   present % = days PRESENT OR HAIDH over the period's maktab days
//               (user: "present = activity logged or haidh").
//   absent    = the period's maktab days with neither.
//   haidh_ranges = the last 3 CONFIRMED runs (status 'haidh' only,
//               consecutive calendar dates), newest first.
//
// Auth mirrors the calendar endpoints: a student gets her own page; a
// teacher passes student_id.
// ============================================================
export async function handleAttendancePage(request, env, auth) {
  if (!auth) return { error: 'Not authenticated', status: 401 };
  const url = new URL(request.url);
  const bodyStudentId = url.searchParams.get('student_id');
  const studentId = isTeacherOrAbove(auth) && bodyStudentId ? String(bodyStudentId) : auth.id;

  const student = await env.DB.prepare(
    "SELECT id, haidh_ruling, track_haidh FROM students WHERE id = ? AND role = 'student'"
  ).bind(studentId).first();
  if (!student) return { error: 'Student not found', status: 404 };

  const settings = await readMaktabSettings(env);
  const today = await maktabTodayISO(env);

  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');
  let source = 'custom';
  if (!isValidDate(from) || !isValidDate(to)) {
    // V3.87.0: TERMS DRIVE ATTENDANCE (user) — the default period is
    // the TERM CONTAINING TODAY from maktab_terms, not the retired
    // single pair on maktab_settings. Chain unchanged otherwise:
    // custom → term-of-today → last 28 days.
    const term = await termContainingToday(env, today);
    if (term) {
      from = term.term_from; to = term.term_to; source = 'term';
    } else {
      const d = new Date(today + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 27);
      from = d.toISOString().slice(0, 10); to = today; source = '4w';
    }
  }
  if (from > to) return { error: 'from must not be after to', status: 400 };

  // Derivation runs over ALL maktab days — haidh propagation on a day
  // inside the period can depend on a run that began before it — and the
  // period then filters the result.
  const allMaktabDays = await loadMaktabDays(env, settings.maktab_day_min);
  const { results: loggedRows } = await env.DB.prepare(
    `SELECT DISTINCT date FROM (
       SELECT date FROM maktab_sabaq_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_sabaq_dhor_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_dhor_log WHERE student_id = ?
     )`
  ).bind(studentId, studentId, studentId).all();
  const { results: haidhRows } = await env.DB.prepare(
    `SELECT date, status FROM attendance WHERE student_id = ? AND status IN ('haidh','predicted-haidh') ORDER BY date`
  ).bind(studentId).all();

  const derived = deriveStudentAttendance(
    allMaktabDays,
    new Set(loggedRows.map(r => r.date)),
    haidhRows.map(r => r.date),
    student.haidh_ruling || 'hanafi',
    settings.absence_flag_days
  );

  const periodDays = allMaktabDays.filter(d => d >= from && d <= to);
  const absent_dates = periodDays.filter(d => derived.statuses[d] === 'absent');
  const present_days = periodDays.length - absent_dates.length;   // present OR haidh, per the spec
  const percent = periodDays.length ? Math.round((present_days / periodDays.length) * 100) : null;

  // The last 3 CONFIRMED runs, newest first: consecutive calendar dates
  // of 'haidh' rows only (a prediction is a plan, not history — V3.76.1).
  const confirmed = haidhRows.filter(r => r.status === 'haidh').map(r => r.date);
  const ranges = [];
  for (const d of confirmed) {
    const last = ranges[ranges.length - 1];
    const next = last && new Date(new Date(last.to + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    if (last && d === next) last.to = d;
    else ranges.push({ from: d, to: d });
  }
  const haidh_ranges = ranges.slice(-3).reverse();

  return { data: {
    student_id: studentId, from, to, source,
    maktab_days: periodDays.length, present_days, percent,
    maktab_day_min: settings.maktab_day_min,   // V3.85.0: lets the page explain an EMPTY period
    absent_dates, haidh_ranges,
    track_haidh: !!student.track_haidh,
    term_from: settings.term_from || null, term_to: settings.term_to || null,
  } };
}

// ============================================================
// V3.98.0 — THE MAKTAB ATTENDANCE SCREEN (user, 2026-08-31).
//
// One week at a time; ‹ › pages by week. Columns come from the maktab's
// configured TEACHING DAYS, not from derived maktab days — a maktab day
// is derived from logging activity, so no future date can ever be one.
//
// Every teaching day appears as a column even when nothing can happen on
// it, LABELLED with the reason (user: "so that the user doesn't skip days
// as they scroll"): a public holiday by its own name, a date outside any
// term as a term break, and a past teaching day that fell below the
// maktab-day threshold as "No maktab day" — the V3.85 rule stands there,
// so such a day is never turned into a wall of false absences.
//
// Cell content follows the calendar, not the column:
//   BEFORE today → three lists: present, absent, haa'idha (the derived
//                  truth, exactly as the per-student page computes it).
//   TODAY onward → predicted haa'idha and predicted absentees — today is
//                  a planning column, not a half-written register (user).
// ============================================================
export async function handleMaktabWeek(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const monday = url.searchParams.get('monday');
  if (!isValidDate(monday)) return { error: 'monday must be YYYY-MM-DD', status: 400 };

  const settings = await readMaktabSettings(env);
  const today = await maktabTodayISO(env);
  const teaching = teachingDaysOf(settings);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    dates.push({ date: d.toISOString().slice(0, 10), key: WEEKDAY_KEYS[i] });
  }
  const columns = dates.filter(d => teaching.includes(d.key));
  if (!columns.length) return { data: { monday, today, columns: [] } };

  const first = columns[0].date, last = columns[columns.length - 1].date;

  const [students, marks, terms, entries, maktabDays, logged] = await Promise.all([
    env.DB.prepare("SELECT id, name, track_haidh FROM students WHERE role = 'student' AND active = 1 ORDER BY name").all(),
    env.DB.prepare('SELECT student_id, date, status FROM attendance WHERE date >= ? AND date <= ?').bind(first, last).all(),
    env.DB.prepare('SELECT term_from, term_to FROM maktab_terms').all(),
    env.DB.prepare("SELECT date_from, date_to, label, type FROM maktab_calendar WHERE type = 'holiday' AND date_to >= ? AND date_from <= ?").bind(first, last).all(),
    loadMaktabDays(env, settings.maktab_day_min),
    env.DB.prepare(
      `SELECT DISTINCT student_id, date FROM (
         SELECT date, student_id FROM maktab_sabaq_log
         UNION ALL SELECT date, student_id FROM maktab_sabaq_dhor_log
         UNION ALL SELECT date, student_id FROM maktab_dhor_log
       ) WHERE date >= ? AND date <= ?`
    ).bind(first, last).all(),
  ]);

  const nameOf = new Map(students.results.map(s => [s.id, s.name]));
  const loggedOn = new Set(logged.results.map(r => `${r.student_id}|${r.date}`));
  const maktabDaySet = new Set(maktabDays);
  const markAt = new Map(marks.results.map(r => [`${r.student_id}|${r.date}`, r.status]));

  const holidayOn = (date) => {
    const hit = entries.results.find(e => e.date_from <= date && e.date_to >= date);
    return hit ? (hit.label || 'Public Holiday') : null;
  };
  const inTerm = (date) => terms.results.some(t => t.term_from <= date && t.term_to >= date);

  const out = columns.map(({ date, key }) => {
    const holiday = holidayOn(date);
    const past = date < today;
    const col = { date, weekday: key, past, holiday, note: null, present: [], absent: [], haidh: [], predictedHaidh: [], predictedAbsent: [] };

    if (holiday) { col.note = holiday; return col; }
    if (!inTerm(date)) { col.note = 'Term break'; return col; }

    if (past) {
      // the V3.85 threshold rule: a teaching day the maktab plainly did
      // not hold is named, never filled with false absences
      if (!maktabDaySet.has(date)) { col.note = 'No maktab day'; return col; }
      for (const s of students.results) {
        const status = markAt.get(`${s.id}|${date}`);
        if (loggedOn.has(`${s.id}|${date}`)) col.present.push(s.name);
        else if (status === 'haidh' || status === 'predicted-haidh') col.haidh.push(s.name);
        else col.absent.push(s.name);
      }
    } else {
      for (const s of students.results) {
        const status = markAt.get(`${s.id}|${date}`);
        if (status === 'haidh' || status === 'predicted-haidh') col.predictedHaidh.push(s.name);
        else if (status === 'predicted-absent') col.predictedAbsent.push(s.name);
      }
    }
    return col;
  });

  return { data: { monday, today, teaching_days: teaching, columns: out, students: students.results.map(s => ({ id: s.id, name: s.name })) } };
}
