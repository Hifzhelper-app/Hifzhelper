// ============================================================
// verify_v3761_haidh_predictions.mjs — V3.76.1: a future PREDICTION never
// vetoes a real haidh mark; a confirmed mark clears the predictions it
// supersedes.
//
// Device report 2026-08-27: a real range 27–31 Aug refused with "15 days
// have not passed since the last haidh" — the last real haidh was 3+ weeks
// back; the blocker was a predicted day on 5 Sep, four days AHEAD.
//
// Every date here is RELATIVE TO TODAY (the worker decides confirmed vs
// predicted against the real clock), so this cannot become the time bomb
// verify_e2's fixed-date fixture once was.
// ============================================================

import { DatabaseSync } from 'node:sqlite';
import { handleMarkHaidhRange, handleSetAttendance, haidhEvidenceDates } from '../worker/src/attendance.js';
import { HAIDH_GAP_CODE, evaluateHaidhRange, haidhAddDaysISO } from '../shared/haidhRules.js';

let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => haidhAddDaysISO(TODAY, n);

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, role TEXT NOT NULL, gender TEXT, track_haidh INTEGER NOT NULL DEFAULT 0, haidh_ruling TEXT NOT NULL DEFAULT 'hanafi');
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
      PRIMARY KEY (student_id, date));
    INSERT INTO students (id, role) VALUES ('STU1','student'), ('TCH1','teacher');
  `);
  const stmt = (sql, args) => ({
    async run() { db.prepare(sql).run(...args); return { meta: {} }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const DB = {
    prepare(sql) { return { bind(...args) { return Object.assign(stmt(sql, args), { _sql: sql, _args: args }); } }; },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  const put = (d, status) => db.prepare('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)').run('STU1', d, status);
  const rows = () => db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date').all('STU1');
  const has = (d, status) => rows().some(r => r.date === d && r.status === status);
  const profile = () => db.prepare('SELECT gender, track_haidh FROM students WHERE id = ?').get('STU1');
  return { env: { DB }, put, rows, has, profile };
}
const TEACHER = { id: 'TCH1', role: 'teacher' };
const range = (a, b) => ({ json: async () => ({ student_id: 'STU1', startDate: a, endDate: b }), url: 'https://x/' });
const single = (d, status) => ({ json: async () => ({ student_id: 'STU1', date: d, status }), url: 'https://x/' });

// ---------- the evidence rule, pure ----------
{
  const rows = [
    { date: day(-30), status: 'haidh' }, { date: day(-3), status: 'predicted-haidh' },
    { date: day(0), status: 'predicted-haidh' }, { date: day(5), status: 'predicted-haidh' }, { date: day(9), status: 'haidh' },
  ];
  const ev = haidhEvidenceDates(rows, TODAY);
  check('evidence: confirmed rows always count (even a future one, if it ever existed)', ev.includes(day(-30)) && ev.includes(day(9)));
  check('evidence: a passed prediction counts (lazy auto-confirm)', ev.includes(day(-3)));
  check('evidence: a prediction dated today counts', ev.includes(day(0)));
  check('evidence: a FUTURE prediction does not', !ev.includes(day(5)));
  check('evaluateHaidhRange now returns runEnd', typeof evaluateHaidhRange([], day(-2), day(0)).runEnd === 'string' && evaluateHaidhRange([], day(-2), day(0)).runEnd === day(0));
}

// ---------- THE device case: real range, prediction 5 days ahead, last real haidh 3 weeks back ----------
{
  const { env, put, rows, has, profile } = makeDb();
  for (let n = -26; n <= -22; n++) put(day(n), 'haidh');   // last real period, ended 22 days ago
  put(day(5), 'predicted-haidh');                          // the plan that used to block
  put(day(20), 'predicted-haidh');                         // a later plan, outside the window
  const r = await handleMarkHaidhRange(range(day(-4), day(0)), env, TEACHER);
  check('device case: the real range is ACCEPTED', !r.error && r.data && r.data.status === 'haidh', JSON.stringify(r));
  check('device case: all five days written as haidh', [-4, -3, -2, -1, 0].every(n => has(day(n), 'haidh')));
  check('device case: the prediction 5 days ahead is DELETED (inside the 14-day window)', !has(day(5), 'predicted-haidh'));
  check('device case: the prediction 20 days ahead SURVIVES (outside the window)', has(day(20), 'predicted-haidh'));
  check('device case: the response names what it cleared', JSON.stringify(r.data.clearedPredictions) === JSON.stringify([day(5)]), JSON.stringify(r.data));
  check('device case: the old real period is untouched', rows().filter(x => x.status === 'haidh').length === 10);
  check('V4.2.11: teacher-confirmed haidh promotes Female + Haaidha', profile().gender === 'F' && profile().track_haidh === 1);
}

// ---------- the rule still holds in the other direction ----------
{
  const { env, put, has } = makeDb();
  for (let n = -4; n <= 0; n++) put(day(n), 'haidh');
  const r = await handleMarkHaidhRange(range(day(4), day(6)), env, TEACHER);
  check('a PREDICTION placed 3 days after a real haidh is still refused', r.error && r.status === 400 && /days have not passed/.test(r.error), JSON.stringify(r));
  check('…and nothing was written', !has(day(4), 'predicted-haidh'));
}
{
  const { env, put } = makeDb();
  for (let n = -20; n <= -16; n++) put(day(n), 'haidh');
  const r = await handleMarkHaidhRange(range(day(-10), day(-8)), env, TEACHER);
  check('a real range 5 days after a real haidh is still refused', r.error && /days have not passed/.test(r.error));
}
{
  const { env, put } = makeDb();
  put(day(-6), 'predicted-haidh');   // passed prediction = history
  const r = await handleMarkHaidhRange(range(day(-2), day(0)), env, TEACHER);
  check('a PASSED prediction still counts as evidence (gap 3 → refused)', r.error && /days have not passed/.test(r.error));
}
{
  const { env, put, has, profile } = makeDb();
  put(day(-30), 'haidh');
  put(day(6), 'predicted-haidh');
  const r = await handleMarkHaidhRange(range(day(3), day(5)), env, TEACHER);
  check('a predicted range written NEXT TO another prediction is accepted (plans do not veto plans)', !r.error && r.data.status === 'predicted-haidh', JSON.stringify(r));
  check('…and a predicted write clears nothing', has(day(6), 'predicted-haidh') && r.data.clearedPredictions.length === 0);
  check('V4.2.11: a future prediction alone does NOT promote Haaidha', !profile().track_haidh && profile().gender == null);
}
{
  const { env, put, has } = makeDb();
  for (let n = -3; n <= 0; n++) put(day(n), 'haidh');
  put(day(-40), 'haidh');
  const r = await handleMarkHaidhRange(range(day(1), day(2)), env, TEACHER);
  check('extending a real run into the future (adjacent) is still an extension, not a new run', !r.error, JSON.stringify(r));
}

// ---------- the single-day handler, same rule ----------
{
  const { env, put, has } = makeDb();
  put(day(-30), 'haidh');
  put(day(4), 'predicted-haidh');
  const r = await handleSetAttendance(single(day(0), 'haidh'), env, TEACHER);
  check('single-day: a real mark today is not vetoed by a prediction 4 days ahead', !r.error, JSON.stringify(r));
  check('single-day: and that prediction is cleared', !has(day(4), 'predicted-haidh') && JSON.stringify(r.data.clearedPredictions) === JSON.stringify([day(4)]));
  const r2 = await handleSetAttendance(single(day(3), 'predicted-haidh'), env, TEACHER);
  check('single-day: a prediction 2 days after a real mark is still refused', r2.error && /days have not passed/.test(r2.error));
}

// ---------- never touches confirmed rows ----------
{
  const { env, put, has } = makeDb();
  put(day(-30), 'haidh');
  put(day(3), 'haidh');   // should not exist in practice, but if it does the clear must not touch it
  const r = await handleMarkHaidhRange(range(day(-2), day(0)), env, TEACHER);
  check('a confirmed future row is evidence — the range is refused (gap 2), nothing cleared', r.error && has(day(3), 'haidh'));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
