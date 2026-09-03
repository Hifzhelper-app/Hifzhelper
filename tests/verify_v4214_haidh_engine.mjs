#!/usr/bin/env node
// ============================================================
// V4.2.14 authoritative Haidh engine regression.
// One normalized model across Student calendar, Attendance and Summary:
// confirmed / predicted / Maktab activity, with activity always strongest.
// ============================================================

import { DatabaseSync } from 'node:sqlite';
import {
  HAIDH_OFFICIAL_MAX_DURATION, HAIDH_GAP_OFFICIAL, HAIDH_GAP_CODE,
  haidhOfficialMaxDuration, haidhCodeMaxRunDays, haidhAddDaysISO,
} from '../shared/haidhRules.js';
import { normalizeHaidhTimeline } from '../worker/src/haidhTimeline.js';
import { handleGetAttendance, handleSetAttendance, handleMarkHaidhRange } from '../worker/src/attendance.js';

let pass = 0, fail = 0;
const check = (label, condition, detail = '') => {
  if (condition) pass++;
  else { fail++; console.log('FAIL:', label, detail); }
};

const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => haidhAddDaysISO(TODAY, n);

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY, name TEXT, role TEXT NOT NULL, active INTEGER DEFAULT 1,
      gender TEXT, track_haidh INTEGER NOT NULL DEFAULT 0,
      haidh_ruling TEXT NOT NULL DEFAULT 'hanafi', haidh_cycle_length INTEGER,
      haidh_period_length INTEGER, haidh_next_expected TEXT
    );
    CREATE TABLE attendance (
      student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh','predicted-absent')),
      PRIMARY KEY (student_id, date)
    );
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    INSERT INTO students (id,name,role,haidh_cycle_length,haidh_period_length)
      VALUES ('STU1','Student','student',28,5), ('TCH1','Teacher','teacher',NULL,NULL);
  `);
  const stmt = (sql, args) => ({
    async run() { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    _sql: sql, _args: args,
  });
  const DB = {
    prepare(sql) {
      return {
        bind(...args) { return stmt(sql, args); },
        async first() { return db.prepare(sql).get() ?? null; },
        async all() { return { results: db.prepare(sql).all() }; },
        async run() { const r = db.prepare(sql).run(); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
      };
    },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  const put = (date, status) => db.prepare(
    'INSERT INTO attendance (student_id,date,status) VALUES (?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status'
  ).run('STU1', date, status);
  const log = (date) => db.prepare('INSERT INTO maktab_sabaq_log (student_id,date) VALUES (?,?)').run('STU1', date);
  const rows = () => db.prepare('SELECT date,status FROM attendance WHERE student_id=? ORDER BY date').all('STU1');
  const profile = () => db.prepare('SELECT gender,track_haidh,haidh_next_expected FROM students WHERE id=?').get('STU1');
  return { env: { DB }, put, log, rows, profile };
}

const TEACHER = { id: 'TCH1', role: 'teacher' };
const single = (date, status, extra = {}) => ({ json: async () => ({ student_id: 'STU1', date, status, ...extra }), url: 'https://x/attendance' });
const range = (startDate, endDate, extra = {}) => ({ json: async () => ({ student_id: 'STU1', startDate, endDate, ...extra }), url: 'https://x/attendance/mark-range' });

// 1-4: shared global limits.
check('global official Haidh maximum is 10 days for Hanafi', haidhOfficialMaxDuration('hanafi') === 10 && HAIDH_OFFICIAL_MAX_DURATION.hanafi === 10);
check('global official Haidh maximum is 10 days for Shafii', haidhOfficialMaxDuration('shafii') === 10 && HAIDH_OFFICIAL_MAX_DURATION.shafii === 10);
check('partial-day edge permits 11 touched calendar dates only', haidhCodeMaxRunDays('hanafi') === 11 && haidhCodeMaxRunDays('shafii') === 11);
check('purity minimum remains 15 official / 14 intervening calendar days', HAIDH_GAP_OFFICIAL === 15 && HAIDH_GAP_CODE === 14);

// 5-8: normalized confirmed timeline and activity stop.
{
  const raw = [];
  for (let n = -10; n <= -6; n++) raw.push({ date: day(n), status: 'haidh' });
  raw.push({ date: day(-5), status: 'haidh' }, { date: day(-4), status: 'haidh' }); // stale after activity on -5
  const t = normalizeHaidhTimeline(raw, [day(-5)]);
  check('Maktab activity wins visually over a confirmed Haidh row', t.byDate.get(day(-5)) === 'activity');
  check('activity terminates the confirmed run before that date', t.confirmedDates.includes(day(-6)) && !t.confirmedDates.includes(day(-5)));
  check('stale confirmed rows cannot resume the old run after activity', !t.confirmedDates.includes(day(-4)));
  check('normalized engine exposes no probable Haidh state', t.rows.every(r => r.status !== 'probable-haidh'));
}

// 9-11: predicted clusters are plans; activity terminates only the old cluster.
{
  const raw = [
    { date: day(-3), status: 'predicted-haidh' },
    { date: day(-2), status: 'predicted-haidh' },
    { date: day(-1), status: 'predicted-haidh' },
    { date: day(20), status: 'predicted-haidh' },
    { date: day(21), status: 'predicted-haidh' },
  ];
  const t = normalizeHaidhTimeline(raw, [day(-2)]);
  check('a past predicted day remains predicted rather than auto-confirming', t.byDate.get(day(-3)) === 'predicted-haidh');
  check('activity replaces a predicted day and stops the rest of that predicted run', t.byDate.get(day(-2)) === 'activity' && !t.byDate.has(day(-1)));
  check('a later prediction cycle survives an earlier activity stop', t.byDate.get(day(20)) === 'predicted-haidh' && t.byDate.get(day(21)) === 'predicted-haidh');
}

// 12-13: explicit non-Maktab stop evidence also prevents old-run resumption.
{
  const raw = [
    { date: day(-25), status: 'haidh' },
    { date: day(-24), status: 'haidh' },
    { date: day(-23), status: 'haidh' },
    { date: day(-22), status: 'haidh' },
  ];
  const t = normalizeHaidhTimeline(raw, [], [day(-23)]);
  check('stored Present/teacher Absent can terminate a Haidh episode without painting green', !t.byDate.has(day(-23)));
  check('confirmed rows after an explicit stop cannot resume within the purity window', !t.confirmedDates.includes(day(-22)));
}

// 14-15: exact purity boundary from a terminated episode.
{
  const raw = [{ date: day(-30), status: 'haidh' }];
  const stopped = normalizeHaidhTimeline(raw, [day(-29)]);
  const blocked = normalizeHaidhTimeline([...raw, { date: day(-15), status: 'haidh' }], [day(-29)]);
  const allowed = normalizeHaidhTimeline([...raw, { date: day(-14), status: 'haidh' }], [day(-29)]);
  check('new confirmed period is blocked with only 13 intervening days after termination', stopped.byDate.get(day(-29)) === 'activity' && !blocked.confirmedDates.includes(day(-15)));
  check('new confirmed period is allowed after 14 intervening calendar days', allowed.confirmedDates.includes(day(-14)));
}

// 16-17: GET /attendance uses the same normalized truth and synthetic activity state.
{
  const { env, put, log } = makeDb();
  put(day(-3), 'haidh'); put(day(-2), 'haidh'); put(day(-1), 'haidh');
  log(day(-2));
  const response = await handleGetAttendance({ url: 'https://x/attendance?student_id=STU1' }, env, TEACHER);
  const by = new Map(response.data.map(r => [r.date, r.status]));
  check('Attendance GET returns activity instead of Haidh on a logged day', by.get(day(-2)) === 'activity');
  check('Attendance GET suppresses stale Haidh after the logged activity day', !by.has(day(-1)));
}

// 18-20: confirmation replaces predictions and anchors them to confirmed Day 1.
{
  const { env, put, rows, profile } = makeDb();
  for (let n = -32; n <= -28; n++) put(day(n), 'haidh');
  put(day(7), 'predicted-haidh'); put(day(18), 'predicted-haidh');
  const r = await handleMarkHaidhRange(range(day(-4), day(0)), env, TEACHER);
  const state = rows();
  const has = (date, status) => state.some(x => x.date === date && x.status === status);
  check('confirmed Haidh range is saved as the new real period', !r.error && r.data.status === 'haidh' && [-4,-3,-2,-1,0].every(n => has(day(n), 'haidh')), JSON.stringify(r));
  check('confirmation clears/replaces the previous prediction set', !has(day(7), 'predicted-haidh') && !has(day(18), 'predicted-haidh'));
  check('new predictions regenerate from confirmed Day 1', has(day(24), 'predicted-haidh') && profile().haidh_next_expected === day(24));
}

// 21: logged activity blocks a Haidh write.
{
  const { env, log } = makeDb();
  log(day(0));
  const r = await handleSetAttendance(single(day(0), 'haidh'), env, TEACHER);
  check('Haidh cannot overwrite a day with Maktab activity', r.error && r.code === 'haidh_activity');
}

// 22: teacher purity override is retired globally.
{
  const { env, put } = makeDb();
  for (let n = -12; n <= -10; n++) put(day(n), 'haidh');
  const r = await handleMarkHaidhRange(range(day(-2), day(0), { override_gap: true }), env, TEACHER);
  check('teacher override cannot bypass the global 15-day purity rule', r.error && r.code === 'haidh_gap');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
