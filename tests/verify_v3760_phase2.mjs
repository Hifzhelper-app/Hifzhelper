// ============================================================
// verify_v3760_phase2.mjs — V3.76.0, Phase 2: the maktab haidh calendar.
//
// The student's Haidh calendar is now SHARED with the maktab (the way the
// day view is): opened from the summary's haidh icon under a maktab log
// context it shows that student's calendar and marks haidh as a RANGE
// through the teacher-gated *For endpoints. Three things are proven here:
//   1. the worker's mark-range honours a teacher's student_id and ignores a
//      student's — against a real SQLite attendance table;
//   2. the calendar, driven for real, routes every read/write by context and
//      keeps the PJ path byte-for-byte as it was;
//   3. the summary icon is a link (no toggle wiring survives), and
//      showScreen keeps the maktab context for the calendar but drops it
//      for everything else.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleMarkHaidhRange } from '../worker/src/attendance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const calSrc = read('js/haidhDetailScreen.js');
const summarySrc = read('js/maktabSummary.js');
const daySrc = read('js/maktabDay.js');
const appSrc = read('js/app.js');
const apiSrc = read('js/api.js');
const html = read('index.html');
const workerSrc = read('worker/src/attendance.js');

// ---------- 1: worker — mark-range for a named student ----------
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, role TEXT NOT NULL, haidh_ruling TEXT NOT NULL DEFAULT 'hanafi');
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
      PRIMARY KEY (student_id, date));
    INSERT INTO students (id, role) VALUES ('STU1','student'), ('STU2','student'), ('TCH1','teacher');
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
  const env = { DB };
  const req = (body) => ({ json: async () => body, url: 'https://x/' });
  const rows = (id) => db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date').all(id);

  const r1 = await handleMarkHaidhRange(req({ student_id: 'STU2', startDate: '2026-03-02', endDate: '2026-03-04' }), env, { id: 'TCH1', role: 'teacher' });
  check('worker: teacher + student_id → range written on THAT student, none on the teacher',
    !r1.error && rows('STU2').length === 3 && rows('TCH1').length === 0, JSON.stringify(r1));
  check('worker: the three days are consecutive and share one status (past → haidh)',
    rows('STU2').map(r => r.date).join(',') === '2026-03-02,2026-03-03,2026-03-04' && rows('STU2').every(r => r.status === 'haidh'));

  const r2 = await handleMarkHaidhRange(req({ student_id: 'STU2', startDate: '2026-06-01', endDate: '2026-06-02' }), env, { id: 'STU1', role: 'student' });
  check('worker: a STUDENT sending student_id is ignored — written on her own id, never a wrong-row write',
    !r2.error && rows('STU1').length === 2 && rows('STU2').length === 3, JSON.stringify(r2));

  const r3 = await handleMarkHaidhRange(req({ startDate: '2026-09-01', endDate: '2026-09-03' }), env, { id: 'STU1', role: 'student' });
  check('worker: no student_id at all → own id, exactly as before', !r3.error && rows('STU1').length === 5);

  // the rules apply to the named student: a range within the gap is refused wholesale
  const r4 = await handleMarkHaidhRange(req({ student_id: 'STU2', startDate: '2026-03-10', endDate: '2026-03-11' }), env, { id: 'TCH1', role: 'teacher' });
  check('worker: the 14-day gap is enforced for the NAMED student and the range is rejected wholesale',
    r4.error && r4.status === 400 && /days have not passed/.test(r4.error) && rows('STU2').length === 3, JSON.stringify(r4));
  check('worker: the override is the same one-line shape the single-day handlers use',
    /const studentId = isTeacherOrAbove\(auth\) && bodyStudentId \? String\(bodyStudentId\) : auth\.id;/.test(workerSrc));
}

// ---------- 2: the calendar, driven under both contexts ----------
function calDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <span id="haidhDetailHeaderIcon"></span><h2 id="haidhDetailTitle">Haidh</h2>
    <button id="haidhCalPrevBtn"></button><span id="haidhCalMonthLabel"></span><button id="haidhCalNextBtn"></button>
    <div id="haidhCalWeekdays"></div><div id="haidhCalGrid"></div>
    <div id="haidhRangeBar" class="hidden"><span id="haidhRangeBarText"></span><button id="haidhRangeCancelBtn"></button><button id="haidhRangeConfirmBtn"></button></div>
    <div id="haidhRangeDecision" class="hidden"><span id="haidhRangeDecisionText"></span><button id="haidhDecisionAdjustBtn"></button><button id="haidhDecisionAbsentBtn"></button><button id="haidhDecisionHaidhBtn"></button></div>
    <div id="haidhCalError"></div></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var calls = [];
    var MODE = 'pj', STUDENT = { id: 'STU2', name: 'Zaynab' };
    function logCtxIsMaktab(){ return MODE === 'maktab'; }
    function logCtxStudentId(){ return STUDENT.id; }
    function logCtxStudentName(){ return STUDENT.name; }
    function iconHtml(){ return ''; }
    function showBanner(m){ calls.push(['banner', m]); }
    var ROWS = { pj: [{ date: '2026-08-03', status: 'haidh' }], maktab: [{ date: '2026-08-10', status: 'haidh' }] };
    var REJECT = null;
    function apiGetAttendance(){ calls.push(['get-own']); return Promise.resolve(ROWS.pj); }
    function apiGetAttendanceFor(id){ calls.push(['get-for', id]); return Promise.resolve(ROWS.maktab); }
    function apiDeleteAttendance(d){ calls.push(['clear-own', d]); return Promise.resolve({}); }
    function apiClearAttendanceFor(id, d){ calls.push(['clear-for', id, d]); return Promise.resolve({}); }
    function apiMarkHaidhRange(a, b){ calls.push(['range-own', a, b]); return REJECT ? Promise.reject(new Error(REJECT)) : Promise.resolve({}); }
    function apiMarkHaidhRangeFor(id, a, b){ calls.push(['range-for', id, a, b]); return REJECT ? Promise.reject(new Error(REJECT)) : Promise.resolve({}); }
    function haidhAddDaysISO(iso, n){ const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
    function haidhDaysBetween(a, b){ return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
  `);
  w.eval(calSrc);
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const dayBtn = (w, iso) => [...w.document.querySelectorAll('.haidh-cal-day')].find(b => !b.classList.contains('haidh-cal-day-muted') && b.textContent === String(parseInt(iso.slice(8), 10)));

{
  // count CODE only — a historical comment still names apiGetAttendance()
  const code = calSrc.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  check('cal: every attendance touch goes through haidhCalClient() — no direct call survives outside it',
    (code.match(/apiGetAttendance\(\)|apiDeleteAttendance\(|apiMarkHaidhRange\(/g) || []).length === 3
    && (code.match(/haidhCalClient\(\)\./g) || []).length === 4);   // 4 since V3.76.2: haidhDecide() is the fourth caller
}

{ // PJ path — unchanged
  const w = calDom();
  await w.eval("renderHaidhDetailScreen('2026-08-15')");
  await tick();
  check('cal PJ: reads the student\'s OWN attendance', w.eval('calls[0]')[0] === 'get-own');
  check('cal PJ: heading is plain "Haidh"', w.document.getElementById('haidhDetailTitle').textContent === 'Haidh');
  check('cal PJ: the string param still jumps to that month', /August 2026/.test(w.document.getElementById('haidhCalMonthLabel').textContent));
  dayBtn(w, '2026-08-20').click(); dayBtn(w, '2026-08-22').click();
  await tick();
  w.document.getElementById('haidhRangeConfirmBtn').click();
  await tick(); await tick();
  const range = w.eval('calls').find(c => c[0].startsWith('range'));
  check('cal PJ: confirming a range writes through the OWN endpoint', range && range[0] === 'range-own' && range[1] === '2026-08-20' && range[2] === '2026-08-22', JSON.stringify(range));
  dayBtn(w, '2026-08-03').click();
  await tick(); await tick();
  const clr = w.eval('calls').find(c => c[0].startsWith('clear'));
  check('cal PJ: tapping a marked day clears through the OWN endpoint', clr && clr[0] === 'clear-own' && clr[1] === '2026-08-03', JSON.stringify(clr));
}

{ // maktab path
  const w = calDom();
  w.eval("MODE = 'maktab'");
  await w.eval("renderHaidhDetailScreen({ maktab: true, date: '2026-08-15' })");
  await tick();
  check('cal maktab: reads the NAMED student\'s attendance', JSON.stringify(w.eval('calls[0]')) === JSON.stringify(['get-for', 'STU2']));
  check('cal maktab: heading carries her name', w.document.getElementById('haidhDetailTitle').textContent === 'Haidh — Zaynab');
  check('cal maktab: the object param\'s date opens that month', /August 2026/.test(w.document.getElementById('haidhCalMonthLabel').textContent));
  check('cal maktab: her marked day is painted, not the PJ fixture\'s', dayBtn(w, '2026-08-10').classList.contains('haidh-cal-day-confirmed') && !dayBtn(w, '2026-08-03').classList.contains('haidh-cal-day-confirmed'));
  dayBtn(w, '2026-08-20').click(); dayBtn(w, '2026-08-22').click();
  await tick();
  check('cal maktab: the confirm bar shows for the pending range', !w.document.getElementById('haidhRangeBar').classList.contains('hidden') && /3 days selected/.test(w.document.getElementById('haidhRangeBarText').textContent));
  w.document.getElementById('haidhRangeConfirmBtn').click();
  await tick(); await tick();
  const range = w.eval('calls').find(c => c[0].startsWith('range'));
  check('cal maktab: confirming writes through the *For endpoint with her id', JSON.stringify(range) === JSON.stringify(['range-for', 'STU2', '2026-08-20', '2026-08-22']), JSON.stringify(range));
  dayBtn(w, '2026-08-10').click();
  await tick(); await tick();
  const clr = w.eval('calls').find(c => c[0].startsWith('clear'));
  check('cal maktab: tapping her marked day clears through the *For endpoint', JSON.stringify(clr) === JSON.stringify(['clear-for', 'STU2', '2026-08-10']), JSON.stringify(clr));
  // the worker's refusal is shown verbatim — this is where item 6's haidh error lives now
  w.eval("REJECT = '15 days have not passed since the last haidh. Please revise your history.'");
  dayBtn(w, '2026-08-24').click(); dayBtn(w, '2026-08-25').click();
  await tick();
  w.document.getElementById('haidhRangeConfirmBtn').click();
  await tick(); await tick();
  check('cal maktab: a refused range shows the worker\'s message verbatim and keeps the selection', /15 days have not passed/.test(w.document.getElementById('haidhCalError').textContent)
    && !w.document.getElementById('haidhRangeBar').classList.contains('hidden'));
  // and back to PJ: the heading reverts, nothing leaks
  w.eval("MODE = 'pj'");
  await w.eval("renderHaidhDetailScreen()");
  await tick();
  check('cal: the next PJ visit reverts the heading to "Haidh"', w.document.getElementById('haidhDetailTitle').textContent === 'Haidh');
}

// ---------- 3: summary icon, opener, routing ----------
check('summary: the icon opens the ATTENDANCE PAGE with the student and the PICKED date (V3.80.0 — the calendar lives inside it)', /openMaktabAttendancePage\(stu, date\);/.test(summarySrc));
check('summary: no toggle wiring survives', !/maktabToggleHaidh|aria-pressed/.test(summarySrc));
check('summary: the tap still does not reach the row', /e\.stopPropagation\(\);\n\s*openMaktabAttendancePage/.test(summarySrc));
// V3.80.0: the opener is openMaktabAttendancePage; the old calendar
// opener delegates to it, so "open the calendar" still routes correctly.
check('day: the opener sets the maktab context and passes { maktab: true, date }',
  /function openMaktabAttendancePage\(student, date\)\{[\s\S]{0,200}setMaktabLogContext\(student, date \|\| maktabTodayISO\(\)\);[\s\S]{0,120}showScreen\('attendancePage', \{ maktab: true, date \}\)/.test(daySrc)
  && /function openMaktabHaidhCalendar\(student, date\)\{\n\s*openMaktabAttendancePage\(student, date\);\n\}/.test(daySrc));
check('day: the toggle flow is deleted, not left dangling', !/function maktabToggleHaidh|function maktabMarkHaidhFlow|function maktabHaidhGapDays/.test(daySrc));
check('app: showScreen keeps the context for the maktab-opened page and drops it otherwise (attendancePage since V3.80.0)',
  /const keepsMaktabCtx = id === 'logDetail' \|\| id === 'studentSummary' \|\| !!\(id === 'attendancePage' && param && typeof param === 'object' && param\.maktab === true\);/.test(appSrc)
  && /if\(!keepsMaktabCtx && typeof exitMaktabDay === 'function'\) exitMaktabDay\(\);/.test(appSrc));
check('api: apiMarkHaidhRangeFor posts student_id with the range', /function apiMarkHaidhRangeFor\(studentId, startDate, endDate, opts\)\{[\s\S]{0,200}student_id: studentId, startDate, endDate/.test(apiSrc));   // opts since V3.76.2
check('html: the heading is id\'d for the name (an h3 inside the attendance page since V3.80.0)', /<h3 class="att-haidh-title" id="haidhDetailTitle">Haidh<\/h3>/.test(html));

// showScreen's keep/drop, driven: simulate the exit hook and call the real predicate line
{
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  const line = appSrc.match(/const keepsMaktabCtx = .*;/)[0];
  const f = w.eval(`(function(id, param){ ${line} return keepsMaktabCtx; })`);
  check('app driven: logDetail keeps', f('logDetail', 'sabaq') === true);
  check('app driven: attendancePage from the maktab keeps', f('attendancePage', { maktab: true, date: '2026-08-15' }) === true);
  check('app driven: attendancePage from the nav (string date) DROPS', f('attendancePage', '2026-08-15') === false);
  check('app driven: attendancePage from the nav (no param) DROPS', f('attendancePage', undefined) === false);
  check('app driven: any other screen drops', f('home', undefined) === false && f('maktabSummary', undefined) === false);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
