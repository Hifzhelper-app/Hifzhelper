// ============================================================
// verify_v3762_haidh_decision.mjs — V3.76.2: the teacher's decision on a
// gap refusal, in the maktab calendar.
//
// Worker: mark-range honours override_gap (skips the GAP rule only) and
// status:'absent' (writes absent rows, no rules) — for teacher-or-above
// only; a student's flags are ignored. Refusals now carry a code.
// Calendar: on a gap refusal in maktab mode the confirm bar is replaced by
// a three-way decision bar (haidh anyway / absent / adjust). The student's
// own calendar never enters that state.
// Dates relative to today, as in verify_v3761.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleMarkHaidhRange } from '../worker/src/attendance.js';
import { haidhAddDaysISO } from '../shared/haidhRules.js';
import { error as workerError } from '../worker/src/utils.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => haidhAddDaysISO(TODAY, n);

// ---------- worker ----------
function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, role TEXT NOT NULL, haidh_ruling TEXT NOT NULL DEFAULT 'hanafi');
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
  const put = (id, d, status) => db.prepare('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)').run(id, d, status);
  const rows = (id) => db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date').all(id);
  return { env: { DB }, put, rows };
}
const TEACHER = { id: 'TCH1', role: 'teacher' };
const STUDENT = { id: 'STU1', role: 'student' };
const req = (body) => ({ json: async () => body, url: 'https://x/' });

{
  const { env, put, rows } = makeDb();
  for (let n = -12; n <= -10; n++) put('STU1', day(n), 'haidh');   // real period ended 10 days ago
  const plain = await handleMarkHaidhRange(req({ student_id: 'STU1', startDate: day(-2), endDate: day(0) }), env, TEACHER);
  check('worker: a gap refusal carries code haidh_gap', plain.error && plain.code === 'haidh_gap' && plain.status === 400, JSON.stringify(plain));
  const over = await handleMarkHaidhRange(req({ student_id: 'STU1', startDate: day(-2), endDate: day(0), override_gap: true }), env, TEACHER);
  check('worker: teacher + override_gap → written as haidh despite the gap', !over.error && over.data.status === 'haidh' && rows('STU1').filter(r => r.status === 'haidh').length === 6, JSON.stringify(over));
}
{
  const { env, put, rows } = makeDb();
  for (let n = -12; n <= -10; n++) put('STU1', day(n), 'haidh');
  const r = await handleMarkHaidhRange(req({ student_id: 'STU1', startDate: day(-2), endDate: day(0), status: 'absent' }), env, TEACHER);
  check('worker: teacher + status:absent → three absent rows, no rules, nothing else touched',
    !r.error && r.data.status === 'absent' && r.data.count === 3 && rows('STU1').filter(x => x.status === 'absent').map(x => x.date).join(',') === [day(-2), day(-1), day(0)].join(',')
    && rows('STU1').filter(x => x.status === 'haidh').length === 3, JSON.stringify(r));
}
{
  const { env, put, rows } = makeDb();
  for (let n = -12; n <= -10; n++) put('STU1', day(n), 'haidh');
  const r1 = await handleMarkHaidhRange(req({ startDate: day(-2), endDate: day(0), override_gap: true }), env, STUDENT);
  check('worker: a STUDENT\'s override_gap is ignored — still refused', r1.error && r1.code === 'haidh_gap', JSON.stringify(r1));
  const r2 = await handleMarkHaidhRange(req({ startDate: day(-2), endDate: day(0), status: 'absent' }), env, STUDENT);
  check('worker: a STUDENT\'s status:absent is ignored — the normal rules run (refused)', r2.error && r2.code === 'haidh_gap' && rows('STU1').every(x => x.status !== 'absent'), JSON.stringify(r2));
}
{
  const { env, put } = makeDb();
  for (let n = -30; n <= -28; n++) put('STU1', day(n), 'haidh');
  const r = await handleMarkHaidhRange(req({ student_id: 'STU1', startDate: day(-14), endDate: day(0), override_gap: true }), env, TEACHER);
  check('worker: override_gap does NOT override the run cap (15 days hanafi → refused, code haidh_run)', r.error && r.code === 'haidh_run', JSON.stringify(r));
}
{
  const res = workerError('x', 400, 'haidh_gap');
  const body = await res.json();
  check('worker: error() puts the code in the body', body.error === 'x' && body.code === 'haidh_gap');
  const res2 = workerError('y', 400);
  const body2 = await res2.json();
  check('worker: no code → body unchanged from before', JSON.stringify(body2) === '{"error":"y"}');
  check('worker: respond() passes result.code through', /error\(result\.error, result\.status \|\| 400, result\.code\)/.test(read('worker/src/index.js')));
  check('api: apiFetch attaches body.code to the thrown error', /if\(body && body\.code\) err\.code = body\.code;/.test(read('js/api.js')));
}

// ---------- calendar ----------
const calSrc = read('js/haidhDetailScreen.js');
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
    var MODE = 'maktab', STUDENT = { id: 'STU2', name: 'Umme' };
    function logCtxIsMaktab(){ return MODE === 'maktab'; }
    function logCtxStudentId(){ return STUDENT.id; }
    function logCtxStudentName(){ return STUDENT.name; }
    function iconHtml(){ return ''; }
    function showBanner(){ }
    var REFUSE = null;   // { code, message } — the next markRange rejects with this
    function apiGetAttendance(){ return Promise.resolve([]); }
    function apiGetAttendanceFor(){ return Promise.resolve([]); }
    function apiDeleteAttendance(){ return Promise.resolve({}); }
    function apiClearAttendanceFor(){ return Promise.resolve({}); }
    function reject(){ const e = new Error(REFUSE.message); if(REFUSE.code) e.code = REFUSE.code; return Promise.reject(e); }
    function apiMarkHaidhRange(a, b){ calls.push(['own', a, b]); return REFUSE ? reject() : Promise.resolve({}); }
    function apiMarkHaidhRangeFor(id, a, b, opts){ calls.push(['for', id, a, b, opts || null]); return REFUSE ? reject() : Promise.resolve({}); }
    function haidhAddDaysISO(iso, n){ const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
    function haidhDaysBetween(a, b){ return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
  `);
  w.eval(calSrc);
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const dayBtn = (w, iso) => [...w.document.querySelectorAll('.haidh-cal-day')].find(b => !b.classList.contains('haidh-cal-day-muted') && b.textContent === String(parseInt(iso.slice(8), 10)));
const hidden = (w, id) => w.document.getElementById(id).classList.contains('hidden');
const GAP = '15 days have not passed since the last haidh. Please revise your history.';

async function selectAndConfirm(w) {
  await w.eval("renderHaidhDetailScreen({ maktab: true, date: '2026-08-15' })");
  await tick();
  dayBtn(w, '2026-08-20').click(); dayBtn(w, '2026-08-22').click();
  await tick();
  w.document.getElementById('haidhRangeConfirmBtn').click();
  await tick(); await tick();
}

{ // gap refusal in maktab mode → the decision bar, selection kept
  const w = calDom();
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await selectAndConfirm(w);
  check('cal: gap refusal in maktab mode shows the DECISION bar, not the error line',
    !hidden(w, 'haidhRangeDecision') && hidden(w, 'haidhRangeBar') && w.document.getElementById('haidhCalError').textContent === '');
  check('cal: the decision bar carries the worker\'s message', w.document.getElementById('haidhRangeDecisionText').textContent === GAP);
  check('cal: the selection is still pending underneath', w.document.querySelectorAll('.haidh-cal-day-selecting').length === 3);
  // Adjust dates → back to the confirm bar, selection kept
  w.document.getElementById('haidhDecisionAdjustBtn').click();
  await tick();
  check('cal: Adjust dates → confirm bar back, decision gone, selection kept',
    hidden(w, 'haidhRangeDecision') && !hidden(w, 'haidhRangeBar') && w.document.querySelectorAll('.haidh-cal-day-selecting').length === 3);
}
{ // Mark as haidh anyway → resubmit with overrideGap
  const w = calDom();
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await selectAndConfirm(w);
  w.eval('REFUSE = null');
  w.document.getElementById('haidhDecisionHaidhBtn').click();
  await tick(); await tick(); await tick();
  const last = w.eval('calls[calls.length - 1]');
  check('cal: Mark as haidh anyway → resubmits the SAME range with overrideGap', JSON.stringify(last) === JSON.stringify(['for', 'STU2', '2026-08-20', '2026-08-22', { overrideGap: true }]), JSON.stringify(last));
  check('cal: …and clears the selection and both bars on success',
    hidden(w, 'haidhRangeDecision') && hidden(w, 'haidhRangeBar') && w.document.querySelectorAll('.haidh-cal-day-selecting').length === 0);
}
{ // Mark absent → status: 'absent'
  const w = calDom();
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await selectAndConfirm(w);
  w.eval('REFUSE = null');
  w.document.getElementById('haidhDecisionAbsentBtn').click();
  await tick(); await tick(); await tick();
  const last = w.eval('calls[calls.length - 1]');
  check('cal: Mark absent → resubmits with status absent', JSON.stringify(last) === JSON.stringify(['for', 'STU2', '2026-08-20', '2026-08-22', { status: 'absent' }]), JSON.stringify(last));
}
{ // a second refusal on "haidh anyway" (the run cap) → plain error, selection kept
  const w = calDom();
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await selectAndConfirm(w);
  w.eval("REFUSE = { code: 'haidh_run', message: 'haidh days cannot exceed 10 days. Please revise your history.' }");
  w.document.getElementById('haidhDecisionHaidhBtn').click();
  await tick(); await tick(); await tick();
  check('cal: a run-cap refusal after "haidh anyway" is the plain error, confirm bar back, selection kept',
    /cannot exceed/.test(w.document.getElementById('haidhCalError').textContent) && hidden(w, 'haidhRangeDecision') && !hidden(w, 'haidhRangeBar')
    && w.document.querySelectorAll('.haidh-cal-day-selecting').length === 3);
}
{ // tapping a day while deciding = adjusting
  const w = calDom();
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await selectAndConfirm(w);
  dayBtn(w, '2026-08-25').click();
  await tick();
  check('cal: tapping a day while the decision bar is up dismisses it and starts a fresh selection',
    hidden(w, 'haidhRangeDecision') && w.document.querySelectorAll('.haidh-cal-day-selecting').length === 1);
}
{ // a non-gap refusal in maktab mode → plain error
  const w = calDom();
  w.eval("REFUSE = { code: 'haidh_run', message: 'haidh days cannot exceed 10 days. Please revise your history.' }");
  await selectAndConfirm(w);
  check('cal: a run-cap refusal in maktab mode never offers the decision', hidden(w, 'haidhRangeDecision') && /cannot exceed/.test(w.document.getElementById('haidhCalError').textContent));
}
{ // the student's own calendar: a gap refusal is the plain error, no decision, no flags ever sent
  const w = calDom();
  w.eval("MODE = 'pj'");
  w.eval(`REFUSE = { code: 'haidh_gap', message: ${JSON.stringify(GAP)} }`);
  await w.eval("renderHaidhDetailScreen('2026-08-15')");
  await tick();
  dayBtn(w, '2026-08-20').click(); dayBtn(w, '2026-08-22').click();
  await tick();
  w.document.getElementById('haidhRangeConfirmBtn').click();
  await tick(); await tick();
  check('cal PJ: a gap refusal on her OWN calendar is the plain message — no decision bar', hidden(w, 'haidhRangeDecision') && w.document.getElementById('haidhCalError').textContent === GAP);
  check('cal PJ: the own-endpoint call carries no flags', w.eval('calls[0]')[0] === 'own' && w.eval('calls[0]').length === 3);
}
check('html: the decision bar exists with its three buttons', /id="haidhRangeDecision"/.test(read('index.html'))
  && ['haidhDecisionAdjustBtn', 'haidhDecisionAbsentBtn', 'haidhDecisionHaidhBtn'].every(id => read('index.html').includes(`id="${id}"`)));
check('css: the decision bar stacks', /\.haidh-range-decision \{ flex-direction: column;/.test(read('css/haidh.css')));
check('cal: no browser confirm() anywhere in the calendar (code, not comments)', !/\bconfirm\(/.test(calSrc.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').replace(/onHaidhRangeConfirm|haidhRangeConfirmBtn|RangeConfirm/g, '')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
