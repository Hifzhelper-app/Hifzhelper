/* Hifzhelper build 4.2.14 | worker/src/maktabAttendance.js */
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
//   present    = the student has any Maktab log that day. Derived, never
//                stored as Maktab attendance.
//   haidh      = normalized confirmed `attendance.status='haidh'`.
//   predicted  = normalized `predicted-haidh`; time passing never promotes it.
//   activity   = any Maktab log; strongest evidence, ends the current Haidh run.
//   absent     = a completed qualifying Maktab day with no log/Haidh, or an
//                explicit teacher absence marker. Explicit absence also stops
//                an existing Haidh run for compatibility with teacher records.
//   biology    = confirmed/predicted duration is counted in CALENDAR days,
//                NOT Maktab days. Weekends and non-teaching days consume the
//                allowance and therefore appear on the Haidh calendar.
//   flag       = no maktab log for >= absence_flag_days consecutive
//                MAKTAB DAYS (that one IS counted in maktab days -- it
//                measures attendance, not biology).
// ============================================================

import { isTeacherOrAbove, isValidDate, maktabTodayISO } from './utils.js';
import { termContainingToday } from './maktabCalendar.js';   // V3.87.0: terms drive attendance
import { readMaktabSettings, teachingDaysOf, WEEKDAY_KEYS } from './maktabSettings.js';   // V3.98.0
import { normalizeHaidhTimeline } from './haidhTimeline.js';

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

// V4.2.14 — one normalized attendance state model.
//
// There is no third/probable Haidh state. Confirmed and predicted rows are
// normalized against stronger Maktab activity (and explicit teacher Absent
// stop-evidence) by worker/src/haidhTimeline.js. Activity wins immediately
// and an old Haidh episode cannot resume after the stop.
function asDateSet(values) {
  return values instanceof Set ? new Set(values) : new Set(values || []);
}


// Pure, so the harness can drive every branch without a DB. Signature stays
// backward-compatible through argument 8.
export function deriveStudentAttendance(maktabDays, loggedDates, confirmedHaidhDates, ruling, absenceFlagDays, todayISO) {
  const logged = asDateSet(loggedDates);
  const confirmedHaidh = asDateSet(confirmedHaidhDates);
  const explicitAbsent = asDateSet(arguments.length > 6 && arguments[6] ? arguments[6] : []);
  const predictedHaidh = asDateSet(arguments.length > 7 && arguments[7] ? arguments[7] : []);
  const rawRows = [
    ...[...confirmedHaidh].map(date => ({ date, status: 'haidh' })),
    ...[...predictedHaidh].map(date => ({ date, status: 'predicted-haidh' })),
  ];
  const timeline = normalizeHaidhTimeline(rawRows, logged, explicitAbsent, ruling || 'hanafi');

  const statuses = {};
  for (const date of maktabDays) {
    if (logged.has(date)) { statuses[date] = 'present'; continue; }
    const haidhStatus = timeline.byDate.get(date);
    if (haidhStatus === 'haidh' || haidhStatus === 'predicted-haidh') { statuses[date] = haidhStatus; continue; }
    if (explicitAbsent.has(date)) { statuses[date] = 'absent'; continue; }

    // Today/future without explicit evidence is unresolved, never absent.
    if (todayISO && date >= todayISO) continue;
    statuses[date] = 'absent';
  }

  // Attention flag remains a no-LOG streak, as originally specified.
  let streak = 0;
  const streakDays = todayISO
    ? maktabDays.filter(d => d < todayISO || logged.has(d))
    : maktabDays;
  for (let i = streakDays.length - 1; i >= 0; i--) {
    if (logged.has(streakDays[i])) break;
    streak++;
  }
  return {
    statuses,
    haidhByDate: timeline.byDate,
    confirmedHaidhDates: timeline.confirmedDates,
    predictedHaidhDates: timeline.predictedDates,
    noLogStreak: streak,
    flagged: absenceFlagDays > 0 && streak >= absenceFlagDays,
  };
}

// V4.2.14: reporting separates logged activity, confirmed Haidh, predicted
// Haidh and absence. Both Haidh states are excused; unresolved today/future
// dates stay out of the denominator.
export function summarizeAttendancePeriod(maktabDays, statuses, from, to) {
  const qualifyingDays = maktabDays.filter(d => d >= from && d <= to);
  const resolvedDays = qualifyingDays.filter(d => ['present','haidh','predicted-haidh','absent'].includes(statuses[d]));
  const active_dates = resolvedDays.filter(d => statuses[d] === 'present');
  const confirmed_haidh_dates = resolvedDays.filter(d => statuses[d] === 'haidh');
  const predicted_haidh_dates = resolvedDays.filter(d => statuses[d] === 'predicted-haidh');
  const absent_dates = resolvedDays.filter(d => statuses[d] === 'absent');
  const active_days = active_dates.length;
  const confirmed_haidh_days = confirmed_haidh_dates.length;
  const predicted_haidh_days = predicted_haidh_dates.length;
  const haidh_days = confirmed_haidh_days + predicted_haidh_days;
  const attended_days = active_days + haidh_days;
  const percent = resolvedDays.length ? Math.round((attended_days / resolvedDays.length) * 100) : null;
  return {
    periodDays: resolvedDays, qualifyingDays,
    active_dates, confirmed_haidh_dates, predicted_haidh_dates, absent_dates,
    active_days, confirmed_haidh_days, predicted_haidh_days, haidh_days,
    attended_days,
    present_days: attended_days, // compatibility alias
    percent,
  };
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
  const today = await maktabTodayISO(env);   // V4.0.2: today is unresolved, not absent
  const { results: haidhRows } = await env.DB.prepare(
    `SELECT student_id, date, status FROM attendance WHERE status IN ('haidh','predicted-haidh')`
  ).all();
  const haidhByStudent = {}, predictedByStudent = {};
  for (const r of haidhRows) {
    const target = r.status === 'haidh' ? haidhByStudent : predictedByStudent;
    (target[r.student_id] = target[r.student_id] || []).push(r.date);
  }
  // V4.0.2: a teacher's OWN 'absent' mark stands on any day, today included
  const { results: absentRows } = await env.DB.prepare(
    `SELECT student_id, date FROM attendance WHERE status = 'absent'`
  ).all();
  const absentByStudent = {};
  for (const r of absentRows) (absentByStudent[r.student_id] = absentByStudent[r.student_id] || []).push(r.date);

  const out = {};
  for (const s of students) {
    const d = deriveStudentAttendance(
      maktabDays, logged[s.id] || new Set(), haidhByStudent[s.id] || [],
      s.haidh_ruling || 'hanafi', settings.absence_flag_days,
      today, absentByStudent[s.id] || [], predictedByStudent[s.id] || []
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
//   reporting = ACTIVE (a log), HAIDH (confirmed + predicted) and ABSENT
//               are reported separately. Attendance % counts Active + Haidh
//               over RESOLVED Maktab days; an unresolved current day is not
//               silently counted as present.
//   absent    = the period's resolved maktab days with neither log nor Haidh.
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
  const { results: absentRows } = await env.DB.prepare(   // V4.0.2: explicit teacher marks
    `SELECT date FROM attendance WHERE student_id = ? AND status = 'absent'`
  ).bind(studentId).all();

  const loggedDateSet = new Set(loggedRows.map(r => r.date));
  const confirmed = haidhRows.filter(r => r.status === 'haidh').map(r => r.date);
  const predicted = haidhRows.filter(r => r.status === 'predicted-haidh').map(r => r.date);
  const absentDates = absentRows.map(r => r.date);
  const derived = deriveStudentAttendance(
    allMaktabDays,
    loggedDateSet,
    confirmed,
    student.haidh_ruling || 'hanafi',
    settings.absence_flag_days,
    today, absentDates, predicted
  );

  const periodSummary = summarizeAttendancePeriod(allMaktabDays, derived.statuses, from, to);
  const {
    periodDays, absent_dates, active_days, haidh_days,
    confirmed_haidh_days, predicted_haidh_days, present_days, percent
  } = periodSummary;

  // The last 3 CONFIRMED runs, newest first: consecutive calendar dates
  // of 'haidh' rows only (a prediction is a plan, not history — V3.76.1).
  const ranges = [];
  for (const d of derived.confirmedHaidhDates) {
    const last = ranges[ranges.length - 1];
    const next = last && new Date(new Date(last.to + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    if (last && d === next) last.to = d;
    else ranges.push({ from: d, to: d });
  }
  const haidh_ranges = ranges.slice(-3).reverse();

  return { data: {
    student_id: studentId, from, to, source,
    maktab_days: periodDays.length,
    active_days, haidh_days, confirmed_haidh_days, predicted_haidh_days,
    present_days, percent,   // present_days kept as a compatibility alias; UI uses active/Haidh counts
    maktab_day_min: settings.maktab_day_min,
    absent_dates, haidh_ranges, predicted_haidh_dates: derived.predictedHaidhDates,
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

  const [students, marks, terms, entries, maktabDays, loggedByStudent] = await Promise.all([
    env.DB.prepare("SELECT id, name, track_haidh, haidh_ruling FROM students WHERE role = 'student' AND active = 1 ORDER BY name").all(),
    env.DB.prepare('SELECT student_id, date, status FROM attendance').all(),
    env.DB.prepare('SELECT term_from, term_to FROM maktab_terms').all(),
    env.DB.prepare("SELECT date_from, date_to, label, type FROM maktab_calendar WHERE type = 'holiday' AND date_to >= ? AND date_from <= ?").bind(first, last).all(),
    loadMaktabDays(env, settings.maktab_day_min),
    loadLoggedPairs(env),
  ]);

  const loggedOn = new Set();
  for (const [studentId, dates] of Object.entries(loggedByStudent)) for (const date of dates) loggedOn.add(`${studentId}|${date}`);
  const maktabDaySet = new Set(maktabDays);
  const markAt = new Map(marks.results.map(r => [`${r.student_id}|${r.date}`, r.status]));
  const confirmedByStudent = {}, predictedByStudent = {}, absentByStudent = {};
  for (const r of marks.results) {
    if (r.status === 'haidh') (confirmedByStudent[r.student_id] = confirmedByStudent[r.student_id] || []).push(r.date);
    else if (r.status === 'predicted-haidh') (predictedByStudent[r.student_id] = predictedByStudent[r.student_id] || []).push(r.date);
    else if (r.status === 'absent') (absentByStudent[r.student_id] = absentByStudent[r.student_id] || []).push(r.date);
  }
  const derivedByStudent = {};
  for (const stu of students.results) {
    derivedByStudent[stu.id] = deriveStudentAttendance(
      maktabDays, loggedByStudent[stu.id] || new Set(), confirmedByStudent[stu.id] || [],
      stu.haidh_ruling || 'hanafi', settings.absence_flag_days, today,
      absentByStudent[stu.id] || [], predictedByStudent[stu.id] || []
    );
  }

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
        const status = derivedByStudent[s.id].statuses[date];
        if (status === 'present') col.present.push(s.name);
        else if (status === 'haidh') col.haidh.push(s.name);
        else if (status === 'predicted-haidh') col.predictedHaidh.push(s.name);
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


// ============================================================
// V4.2.11 — TERM REGISTER GRID.
//
// The Attendance overview is now a conventional register: one student
// roster down the left, teaching-day columns across the current term,
// grouped beneath merged Maktab-week headings. Absence has no glyph — a
// blank cell is the register's absence state. Present is a log-derived
// green tick; confirmed/planned haidh uses the shared haidh status.
//
// This is a READ shape only. Attendance remains derived from the same
// maktab logs + attendance rows; no attendance table or migration is
// introduced. The older one-week endpoint stays in place for regression
// compatibility, but the V4.2.11 screen uses this endpoint.
// ============================================================
function registerAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function registerMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export async function handleMaktabRegister(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const settings = await readMaktabSettings(env);
  const today = await maktabTodayISO(env);
  const teaching = teachingDaysOf(settings);

  const { results: terms } = await env.DB.prepare(
    'SELECT id, name, term_from, term_to FROM maktab_terms ORDER BY term_from, id'
  ).all();
  const requestedId = url.searchParams.get('term_id');
  let term = null;
  if (requestedId != null && requestedId !== '') {
    const n = Number(requestedId);
    if (!Number.isInteger(n)) return { error: 'term_id must be an integer', status: 400 };
    term = terms.find(t => Number(t.id) === n) || null;
    if (!term) return { error: 'Term not found', status: 404 };
  } else {
    term = terms.find(t => t.term_from <= today && t.term_to >= today) || null;
    if (!term && terms.length) {
      // Outside a term: use the nearest term, preferring the most recent
      // past term. This keeps the register useful during a break.
      term = [...terms].reverse().find(t => t.term_from <= today) || terms[0];
    }
  }

  let from, to, periodName, prevTermId = null, nextTermId = null;
  if (term) {
    from = term.term_from; to = term.term_to; periodName = term.name;
    const idx = terms.findIndex(t => Number(t.id) === Number(term.id));
    if (idx > 0) prevTermId = Number(terms[idx - 1].id);
    if (idx >= 0 && idx < terms.length - 1) nextTermId = Number(terms[idx + 1].id);
  } else {
    // No terms configured at all: a four-week register containing today.
    const thisMon = registerMondayOf(today);
    from = registerAddDays(thisMon, -21);
    to = registerAddDays(thisMon, 6);
    periodName = 'Last 4 weeks';
  }

  const [students, marks, maktabDays, loggedByStudent] = await Promise.all([
    env.DB.prepare("SELECT id, name, track_haidh, haidh_ruling FROM students WHERE role = 'student' AND active = 1 ORDER BY name").all(),
    // Attendance marks AND log stop-evidence must both span history. An
    // earlier confirmed Haidh can reach into this term, but a log before
    // the term may already have ended that run. Clipping logs to `from`
    // was a V4.2.13 leakage found during the audit.
    env.DB.prepare('SELECT student_id, date, status FROM attendance').all(),
    loadMaktabDays(env, settings.maktab_day_min),
    loadLoggedPairs(env),
  ]);

  const maktabDaySet = new Set(maktabDays);
  const loggedOn = new Set();
  for (const [studentId, dates] of Object.entries(loggedByStudent)) {
    for (const date of dates) loggedOn.add(`${studentId}|${date}`);
  }
  const markAt = new Map(marks.results.map(r => [`${r.student_id}|${r.date}`, r.status]));
  const haidhByStudent = {}, predictedByStudent = {}, absentByStudent = {};
  for (const r of marks.results) {
    if (r.status === 'haidh')
      (haidhByStudent[r.student_id] = haidhByStudent[r.student_id] || []).push(r.date);
    else if (r.status === 'predicted-haidh')
      (predictedByStudent[r.student_id] = predictedByStudent[r.student_id] || []).push(r.date);
    else if (r.status === 'absent')
      (absentByStudent[r.student_id] = absentByStudent[r.student_id] || []).push(r.date);
  }

  const weeks = [];
  for (let mon = registerMondayOf(from); mon <= to; mon = registerAddDays(mon, 7)) {
    const columns = [];
    for (let i = 0; i < 7; i++) {
      const date = registerAddDays(mon, i);
      const key = WEEKDAY_KEYS[i];
      if (date < from || date > to || !teaching.includes(key)) continue;
      const past = date < today;
      const noMaktabDay = past && !maktabDaySet.has(date);
      columns.push({ date, weekday: key, past, future: date > today, no_maktab_day: noMaktabDay });
    }
    if (columns.length) weeks.push({ monday: mon, columns });
  }

  const rows = students.results.map(s => {
    // EXACTLY the individual Attendance-page calculation: derive once and
    // use the same truth both for the grid cells and the percentage. This
    // matters for V4.2.11.4 probable Haidh: an inferred Haidh day is excused
    // and therefore must not fall back to the grid's blank = absent state.
    const derived = deriveStudentAttendance(
      maktabDays, loggedByStudent[s.id] || new Set(), haidhByStudent[s.id] || [],
      s.haidh_ruling || 'hanafi', settings.absence_flag_days, today,
      absentByStudent[s.id] || [], predictedByStudent[s.id] || []
    );

    const cells = {};
    for (const w of weeks) for (const c of w.columns) {
      const key = `${s.id}|${c.date}`;
      let status = '';
      // Real activity is strongest. Otherwise paint the normalized Haidh
      // timeline even on below-threshold/future teaching dates; a blank
      // below-threshold cell is still never inferred as absence.
      if (loggedOn.has(key)) status = 'present';
      else {
        const normalized = derived.haidhByDate && derived.haidhByDate.get(c.date);
        if (normalized === 'haidh' || normalized === 'predicted-haidh') status = normalized;
      }
      cells[c.date] = status;
    }

    const summary = summarizeAttendancePeriod(maktabDays, derived.statuses, from, to);

    return {
      id: s.id, name: s.name, track_haidh: !!s.track_haidh, cells,
      attendance_percent: summary.percent,
      attendance_active_days: summary.active_days,
      attendance_haidh_days: summary.haidh_days,
      attendance_predicted_haidh_days: summary.predicted_haidh_days,
      attendance_absent_days: summary.absent_dates.length,
      attendance_present_days: summary.present_days,   // compatibility alias
      attendance_maktab_days: summary.periodDays.length,
    };
  });

  return { data: {
    today, from, to, period_name: periodName,
    term_id: term ? Number(term.id) : null,
    prev_term_id: prevTermId, next_term_id: nextTermId,
    teaching_days: teaching, weeks, students: rows,
  } };
}
