// ============================================================
// V4.2.14 supersession regression for the old V3.76.1 prediction harness.
// Predictions are plans only; a confirmed Haidh resets/re-anchors the whole
// prediction set, and Maktab activity/purity rules cannot be bypassed.
// ============================================================

import { DatabaseSync } from 'node:sqlite';
import { handleMarkHaidhRange, handleSetAttendance, haidhEvidenceDates } from '../worker/src/attendance.js';
import { evaluateHaidhMark, evaluateHaidhRange, haidhAddDaysISO } from '../shared/haidhRules.js';

let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => haidhAddDaysISO(TODAY, n);

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, gender TEXT, track_haidh INTEGER NOT NULL DEFAULT 0,
      haidh_ruling TEXT NOT NULL DEFAULT 'hanafi', haidh_cycle_length INTEGER,
      haidh_period_length INTEGER, haidh_next_expected TEXT
    );
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
      PRIMARY KEY (student_id, date));
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    INSERT INTO students (id, role, haidh_cycle_length, haidh_period_length)
      VALUES ('STU1','student',28,5), ('TCH1','teacher',NULL,NULL);
  `);
  const stmt = (sql, args) => ({
    async run() { const r=db.prepare(sql).run(...args); return { meta: { last_row_id:Number(r.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const DB = {
    prepare(sql) { return { bind(...args) { return Object.assign(stmt(sql, args), { _sql: sql, _args: args }); } }; },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  const put = (d, status) => db.prepare('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)').run('STU1', d, status);
  const log = d => db.prepare('INSERT INTO maktab_sabaq_log (student_id,date) VALUES (?,?)').run('STU1', d);
  const rows = () => db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date').all('STU1');
  const has = (d, status) => rows().some(r => r.date === d && r.status === status);
  const profile = () => db.prepare('SELECT gender, track_haidh, haidh_next_expected FROM students WHERE id = ?').get('STU1');
  return { env: { DB }, put, log, rows, has, profile };
}
const TEACHER = { id: 'TCH1', role: 'teacher' };
const range = (a, b, extra={}) => ({ json: async () => ({ student_id: 'STU1', startDate: a, endDate: b, ...extra }), url: 'https://x/' });
const single = (d, status) => ({ json: async () => ({ student_id: 'STU1', date: d, status }), url: 'https://x/' });

// ---------- evidence rule ----------
{
  const rows = [
    { date: day(-30), status: 'haidh' }, { date: day(-3), status: 'predicted-haidh' },
    { date: day(0), status: 'predicted-haidh' }, { date: day(5), status: 'predicted-haidh' },
    { date: day(9), status: 'haidh' },
  ];
  const ev = haidhEvidenceDates(rows, TODAY);
  check('evidence: confirmed rows count', ev.includes(day(-30)) && ev.includes(day(9)));
  check('evidence: passed prediction does NOT auto-confirm', !ev.includes(day(-3)));
  check('evidence: today prediction is still only a prediction', !ev.includes(day(0)));
  check('evidence: future prediction is not evidence', !ev.includes(day(5)));
  check('pure helpers expose run anchors', evaluateHaidhMark([day(-1)], day(0)).runStart === day(-1)
    && evaluateHaidhRange([], day(-2), day(0)).runEnd === day(0));
}

// ---------- confirming a new real period replaces the entire prediction set ----------
{
  const { env, put, rows, has, profile } = makeDb();
  for (let n = -26; n <= -22; n++) put(day(n), 'haidh');
  put(day(5), 'predicted-haidh');
  put(day(20), 'predicted-haidh');
  const r = await handleMarkHaidhRange(range(day(-4), day(0)), env, TEACHER);
  check('real range is accepted after sufficient purity', !r.error && r.data.status === 'haidh', JSON.stringify(r));
  check('all five selected days are confirmed', [-4,-3,-2,-1,0].every(n => has(day(n),'haidh')));
  check('old predictions are all replaced, not selectively retained', !has(day(5),'predicted-haidh') && !has(day(20),'predicted-haidh'));
  check('new predictions are regenerated from confirmed Day 1',
    has(day(24),'predicted-haidh') && has(day(25),'predicted-haidh') && has(day(52),'predicted-haidh'));
  check('response reports regeneration and next expected is anchored to Day 1',
    r.data.regeneratedPredictions === 20 && profile().haidh_next_expected === day(24), JSON.stringify(r.data));
  check('old confirmed history remains intact', rows().filter(x => x.status === 'haidh').length === 10);
  check('teacher-confirmed Haidh promotes Female + Haaidha', profile().gender === 'F' && profile().track_haidh === 1);
}

// ---------- predictions never veto confirmation ----------
{
  const { env, put } = makeDb();
  put(day(-30), 'haidh');
  put(day(-3), 'predicted-haidh');
  const r = await handleMarkHaidhRange(range(day(-2), day(0)), env, TEACHER);
  check('a passed prediction does not block a valid confirmed range', !r.error && r.data.status === 'haidh', JSON.stringify(r));
}

// ---------- global purity: no teacher override ----------
{
  const { env, put } = makeDb();
  for (let n=-12; n<=-10; n++) put(day(n),'haidh');
  const plain = await handleMarkHaidhRange(range(day(-2),day(0)), env, TEACHER);
  const over = await handleMarkHaidhRange(range(day(-2),day(0),{override_gap:true}), env, TEACHER);
  check('purity gap refusal carries haidh_gap', plain.error && plain.code === 'haidh_gap');
  check('teacher override_gap is retired and cannot bypass purity', over.error && over.code === 'haidh_gap');
}

// ---------- prediction writes remain plans ----------
{
  const { env, put, has, profile } = makeDb();
  put(day(-30),'haidh');
  put(day(6),'predicted-haidh');
  const r = await handleMarkHaidhRange(range(day(3),day(5)), env, TEACHER);
  check('future range is stored as predicted Haidh', !r.error && r.data.status === 'predicted-haidh', JSON.stringify(r));
  check('existing prediction does not veto or get reset by another prediction', has(day(6),'predicted-haidh'));
  check('prediction alone does not promote Haaidha', !profile().track_haidh && profile().gender == null);
}

// ---------- single confirmed day uses the first confirmed date as anchor ----------
{
  const { env, put, has, profile } = makeDb();
  put(day(-30),'haidh');
  put(day(-1),'haidh');
  put(day(8),'predicted-haidh');
  const r = await handleSetAttendance(single(day(0),'haidh'), env, TEACHER);
  check('single-day confirmation can extend an existing confirmed run', !r.error, JSON.stringify(r));
  check('prediction regeneration anchors to the run first day, not the clicked day',
    profile().haidh_next_expected === day(27) && has(day(27),'predicted-haidh'));
  check('old prediction set was replaced', !has(day(8),'predicted-haidh'));
}

// ---------- activity wins and rejects Haidh writes ----------
{
  const { env, log, has } = makeDb();
  log(day(0));
  const r = await handleSetAttendance(single(day(0),'haidh'), env, TEACHER);
  const rr = await handleMarkHaidhRange(range(day(-1),day(0)), env, TEACHER);
  check('single-day Haidh cannot overwrite logged Maktab activity', r.error && r.code === 'haidh_activity' && !has(day(0),'haidh'));
  check('range containing logged activity is rejected wholesale', rr.error && rr.code === 'haidh_activity');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
