// ============================================================
// verify_v3800_attendance_page.mjs — V3.80.0: the attendance page.
//
//   migration 0025 (term dates); the term in settings save/read;
//   /attendance/page: period resolution (custom → term → last 4 weeks),
//   maktab-day denominator, present = activity OR haidh, absent dates,
//   the last-3 CONFIRMED haidh ranges, auth (own vs teacher's student_id);
//   the page driven in jsdom: %, period labels, custom apply/reset,
//   absent list, haidh block toggled by track_haidh, ranges rendered;
//   the summary icon and nav rewiring.
// Dates relative to today where the clock matters.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleAttendancePage } from '../worker/src/maktabAttendance.js';
import { handleSaveMaktabSettings, handleGetMaktabSettings } from '../worker/src/maktabSettings.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };
const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => { const d = new Date(TODAY + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- fixture ----------
function makeEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT DEFAULT '', role TEXT NOT NULL, haidh_ruling TEXT DEFAULT 'hanafi', track_haidh INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
    CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, mushaf TEXT DEFAULT '13line', maktab_day_min INTEGER DEFAULT 2, absence_flag_days INTEGER DEFAULT 30, name TEXT DEFAULT '', updated_at TEXT, timezone TEXT);
    INSERT INTO maktab_settings (id) VALUES (1);
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
    INSERT INTO students (id, role, track_haidh) VALUES ('STU1','student',1), ('STU2','student',0), ('TCH1','teacher',0);
  `);
  db.exec(read('worker/migrations/0025_term_dates.sql'));
  const stmt = (sql, args) => ({
    async run() { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const DB = {
    prepare(sql) { return Object.assign(stmt(sql, []), { _sql: sql, _args: [], bind(...args) { return Object.assign(stmt(sql, args), { _sql: sql, _args: args }); } }); },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  // maktab days need >= 2 distinct students logging: STU2 logs every day
  const log = (id, d) => db.prepare('INSERT INTO maktab_sabaq_log (student_id, date) VALUES (?, ?)').run(id, d);
  const haidh = (d, status) => db.prepare('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)').run('STU1', d, status || 'haidh');
  return { db, env: { DB }, log, haidh };
}
const TEACHER = { id: 'TCH1', role: 'teacher' };
const STUDENT = { id: 'STU1', role: 'student' };
const req = (qs) => ({ url: `https://x/attendance/page${qs ? '?' + qs : ''}` });
const post = (body) => ({ json: async () => body, url: 'https://x/' });

// ---------- 0025 + the term in settings ----------
{
  const { db, env } = makeEnv();
  check('0025: term_from and term_to exist, NULL', db.prepare('SELECT term_from, term_to FROM maktab_settings WHERE id=1').get().term_from === null);
  check('settings: a bad term date is refused', (await handleSaveMaktabSettings(post({ term_from: '01/09/2026' }), env, { id: 'A', role: 'admin' })).status === 400);
  check('settings: from after to is refused', (await handleSaveMaktabSettings(post({ term_from: '2026-09-10', term_to: '2026-09-01' }), env, { id: 'A', role: 'admin' })).status === 400);
  check('settings: a term saves and reads back', !(await handleSaveMaktabSettings(post({ term_from: '2026-08-01', term_to: '2026-12-15' }), env, { id: 'A', role: 'admin' })).error
    && (await handleGetMaktabSettings(req(''), env, TEACHER)).data.term_from === '2026-08-01');
  check('settings: empty clears a term end', !(await handleSaveMaktabSettings(post({ term_from: '' }), env, { id: 'A', role: 'admin' })).error
    && db.prepare('SELECT term_from FROM maktab_settings WHERE id=1').get().term_from === null);
}

// ---------- the endpoint ----------
{
  // Ten maktab days: day(-20..-11). STU1 logs on 6 of them, haidh run on
  // 2 (calendar-adjacent), absent on 2.
  const { env, log, haidh } = makeEnv();
  const days = [];
  for (let n = -20; n <= -11; n++) { const d = day(n); days.push(d); log('STU2', d); log('X' + n, d); }
  [0, 1, 2, 3, 4, 5].forEach(i => log('STU1', days[i]));
  // days[6], days[7]: ABSENT (no log, no haidh, and no prior run to
  // propagate from — the older runs below are > their ruling max away).
  // days[8], days[9]: present-by-haidh. Putting the run LAST matters:
  // derivation deliberately propagates haidh forward onto no-log maktab
  // days within the ruling window, so absent days must precede it.
  haidh(days[8]); haidh(days[9]);
  // an older confirmed run + a single-day run for the ranges
  haidh(day(-60)); haidh(day(-59)); haidh(day(-58));
  haidh(day(-40));
  haidh(day(5), 'predicted-haidh');                      // a plan, never history

  const r = (await handleAttendancePage(req(`student_id=STU1&from=${days[0]}&to=${days[9]}`), env, TEACHER)).data;
  check('page: maktab days are the denominator', r.maktab_days === 10, JSON.stringify(r));
  check('page: present = activity OR haidh', r.present_days === 8 && r.percent === 80, JSON.stringify(r));
  check('page: absent dates named exactly', JSON.stringify(r.absent_dates) === JSON.stringify([days[6], days[7]]));
  check('page: the last 3 CONFIRMED ranges, newest first, predictions excluded',
    JSON.stringify(r.haidh_ranges) === JSON.stringify([
      { from: days[8], to: days[9] },
      { from: day(-40), to: day(-40) },
      { from: day(-60), to: day(-58) },
    ]), JSON.stringify(r.haidh_ranges));
  check('page: track_haidh rides along', r.track_haidh === true && r.source === 'custom');

  // period resolution
  const noParams = (await handleAttendancePage(req('student_id=STU1'), env, TEACHER)).data;
  check('page: no params + no term → last 4 weeks ending on the maktab today', noParams.source === '4w' && noParams.to === TODAY && noParams.from === day(-27), JSON.stringify([noParams.from, noParams.to]));
  await handleSaveMaktabSettings(post({ term_from: days[2], term_to: days[9] }), env, { id: 'A', role: 'admin' });
  const term = (await handleAttendancePage(req('student_id=STU1'), env, TEACHER)).data;
  check('page: the current term is the default period once set', term.source === 'term' && term.from === days[2] && term.maktab_days === 8, JSON.stringify(term));
  check('page: custom still overrides the term', (await handleAttendancePage(req(`student_id=STU1&from=${days[0]}&to=${days[1]}`), env, TEACHER)).data.source === 'custom');

  // auth
  const own = (await handleAttendancePage(req(''), env, STUDENT)).data;
  check('page: a student gets her OWN page with no student_id', own.student_id === 'STU1');
  const ignored = (await handleAttendancePage(req('student_id=STU2'), env, STUDENT)).data;
  check('page: a student\'s student_id is ignored (hers regardless)', ignored.student_id === 'STU1');
  check('page: a teaching id is not a student page', (await handleAttendancePage(req('student_id=TCH1'), env, TEACHER)).status === 404);
  check('page: from after to refused', (await handleAttendancePage(req(`student_id=STU1&from=${days[5]}&to=${days[0]}`), env, TEACHER)).status === 400);

  const stu2 = (await handleAttendancePage(req('student_id=STU2'), env, TEACHER)).data;
  check('page: a non-haa\'idah page carries track_haidh false and no ranges', stu2.track_haidh === false && stu2.haidh_ranges.length === 0);
}

// ---------- the page, driven ----------
const pageSrc = read('js/haidhDetailScreen.js');
function pageDom(payloads) {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <span id="attendanceHeaderIcon"></span><h2 id="attendanceTitle"></h2>
    <div id="attPercent"></div><div id="attCount"></div><div id="attPeriod"></div>
    <input id="attFrom"><input id="attTo"><button id="attApply"></button><button id="attReset" class="hidden"></button>
    <button id="attAbsentBtn"></button><div id="attAbsentList" class="hidden"></div><div id="attError"></div>
    <div id="attHaidhBlock">
      <span id="haidhDetailHeaderIcon"></span><h3 id="haidhDetailTitle">Haidh</h3>
      <button id="haidhCalPrevBtn"></button><span id="haidhCalMonthLabel"></span><button id="haidhCalNextBtn"></button>
      <div id="haidhCalWeekdays"></div><div id="haidhCalGrid"></div>
      <div id="haidhRangeBar" class="hidden"><span id="haidhRangeBarText"></span><button id="haidhRangeCancelBtn"></button><button id="haidhRangeConfirmBtn"></button></div>
      <div id="haidhRangeDecision" class="hidden"><span id="haidhRangeDecisionText"></span><button id="haidhDecisionAdjustBtn"></button><button id="haidhDecisionAbsentBtn"></button><button id="haidhDecisionHaidhBtn"></button></div>
      <div id="haidhCalError"></div>
      <div id="attHaidhRanges"></div>
    </div></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var PAYLOADS = ${JSON.stringify(payloads)};   // keyed 'default' and 'from|to'
    var pageCalls = [];
    function apiGetAttendancePage(from, to){ pageCalls.push(['own', from, to]); return Promise.resolve(PAYLOADS[(from && to) ? from + '|' + to : 'default']); }
    function apiGetAttendancePageFor(id, from, to){ pageCalls.push(['for', id, from, to]); return Promise.resolve(PAYLOADS[(from && to) ? from + '|' + to : 'default']); }
    var MODE = 'pj', STUDENT = { id: 'STU2', name: 'Umme' };
    function logCtxIsMaktab(){ return MODE === 'maktab'; }
    function logCtxStudentId(){ return STUDENT.id; }
    function logCtxStudentName(){ return STUDENT.name; }
    function iconHtml(){ return ''; }
    function apiGetAttendance(){ return Promise.resolve([]); }
    function apiGetAttendanceFor(){ return Promise.resolve([]); }
    function apiDeleteAttendance(){ return Promise.resolve({}); }
    function apiClearAttendanceFor(){ return Promise.resolve({}); }
    function apiMarkHaidhRange(){ return Promise.resolve({}); }
    function apiMarkHaidhRangeFor(){ return Promise.resolve({}); }
    function haidhAddDaysISO(iso, n){ const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
    function haidhDaysBetween(a, b){ return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
    function showBanner(){ }
  `);
  w.eval(pageSrc);
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const BASE = { student_id: 'STU1', from: '2026-08-01', to: '2026-08-28', source: 'term', maktab_days: 20, present_days: 18, percent: 90,
  absent_dates: ['2026-08-05', '2026-08-12'], haidh_ranges: [{ from: '2026-08-20', to: '2026-08-24' }], track_haidh: true, term_from: '2026-08-01', term_to: '2026-12-15' };

{
  const w = pageDom({ 'default': BASE, '2026-08-10|2026-08-14': Object.assign({}, BASE, { from: '2026-08-10', to: '2026-08-14', source: 'custom', percent: 50, maktab_days: 4, present_days: 2, absent_dates: ['2026-08-11', '2026-08-13'] }) });
  await w.eval("renderAttendancePage('2026-08-28')");
  await tick(); await tick(); await tick();
  check('page: % and the count render', w.document.getElementById('attPercent').textContent === '90%'
    && /present 18 of 20 maktab days/.test(w.document.getElementById('attCount').textContent));
  check('page: the period line names the source', /2026-08-01 – 2026-08-28 \(current term\)/.test(w.document.getElementById('attPeriod').textContent.replace('\u2013', '–')));
  check('page: absent button carries the count; list hidden until tapped', /\(2\)/.test(w.document.getElementById('attAbsentBtn').textContent)
    && w.document.getElementById('attAbsentList').classList.contains('hidden'));
  w.document.getElementById('attAbsentBtn').click();
  check('page: the absent list shows the dates', !w.document.getElementById('attAbsentList').classList.contains('hidden')
    && w.document.querySelectorAll('.att-absent-date').length === 2);
  check('page: the haidh block is visible for a haa\'idah, calendar rendered, ranges below',
    !w.document.getElementById('attHaidhBlock').classList.contains('hidden')
    && w.document.querySelectorAll('.haidh-cal-day').length > 0
    && /2026-08-20 . 2026-08-24/.test(w.document.getElementById('attHaidhRanges').textContent));
  // custom period
  w.document.getElementById('attFrom').value = '2026-08-10';
  w.document.getElementById('attTo').value = '2026-08-14';
  w.document.getElementById('attApply').click();
  await tick(); await tick();
  check('page: Apply refetches over the custom period and shows reset', w.document.getElementById('attPercent').textContent === '50%'
    && !w.document.getElementById('attReset').classList.contains('hidden')
    && /\(custom\)/.test(w.document.getElementById('attPeriod').textContent));
  w.document.getElementById('attReset').click();
  await tick(); await tick();
  check('page: reset returns to the default period', w.document.getElementById('attPercent').textContent === '90%'
    && w.document.getElementById('attReset').classList.contains('hidden'));
  check('page: PJ mode used the own endpoint, no student_id', w.eval('pageCalls[0]')[0] === 'own');
}
{
  const noHaidh = Object.assign({}, BASE, { track_haidh: false, haidh_ranges: [] });
  const w = pageDom({ 'default': noHaidh });
  w.eval("MODE = 'maktab'");
  await w.eval("renderAttendancePage({ maktab: true, date: '2026-08-28' })");
  await tick(); await tick(); await tick();
  check('page: maktab mode titles with her name and uses the For endpoint', w.document.getElementById('attendanceTitle').textContent === 'Attendance — Umme'
    && w.eval('pageCalls[0]')[0] === 'for' && w.eval('pageCalls[0]')[1] === 'STU2');
  check('page: no haidh block for a non-haa\'idah', w.document.getElementById('attHaidhBlock').classList.contains('hidden'));
}

// ---------- rewiring assertions ----------
check('summary: the icon is the attendance icon on EVERY student and opens the page',
  /btn\.innerHTML = iconHtml\('attendance'\);/.test(read('js/maktabSummary.js')) && /openMaktabAttendancePage\(stu, date\);/.test(read('js/maktabSummary.js')));
check('nav: the item is Attendance for every student; trackHaidh no longer gates the nav',
  /const ATTENDANCE_NAV_ITEM = \{ id: 'attendancePage', label: 'Attendance', icon: 'attendance' \};/.test(read('js/auth.js')));
check('app: the screen key renamed whole (no haidhDetail route survives)',
  !/'haidhDetail'/.test(read('js/app.js')) && /attendancePage: true/.test(read('js/app.js')));
check('settings: the General card stages term_from/term_to into Save',
  /id="mset_term_from"/.test(read('js/maktabSettings.js')) && /term_from: document\.getElementById\('mset_term_from'\)\.value/.test(read('js/maktabSettings.js')));
check('icons: the attendance icon exists', /attendance: '<svg/.test(read('js/icons.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
