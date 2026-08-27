// ============================================================
// verify_v3770_account_separation.mjs — V3.77.0, delivery (j).
//
//   worker: the maktab roster (summary + derived attendance) is STUDENTS
//           only; /admin/create-teaching-profile derives <id>TEACHER with
//           every guard; updateLog refuses a bad date instead of storing it.
//   admin:  a role chip on non-student rows; the create action only on an
//           active student without a teaching profile; cross-notes.
//   switch: the device's known accounts; the chips; forget; the menu item;
//           the router's switch flag; PIN never stored.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleCreateTeachingProfile, handleListUsers, teachingIdFor } from '../worker/src/admin.js';
import { handleMaktabSummary } from '../worker/src/maktabLog.js';
import { handleMaktabAttendance } from '../worker/src/maktabAttendance.js';
import { updateLog } from '../worker/src/logHelpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- worker ----------
function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
      pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, whatsapp_number TEXT, gender TEXT,
      setup_complete INTEGER DEFAULT 0, mushaf TEXT DEFAULT '13line', track_haidh INTEGER DEFAULT 0, haidh_ruling TEXT DEFAULT 'hanafi');
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
    CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, mushaf TEXT DEFAULT '13line', maktab_day_min INTEGER DEFAULT 1, absence_flag_days INTEGER DEFAULT 30, name TEXT DEFAULT '', updated_at TEXT);
    INSERT INTO maktab_settings (id) VALUES (1);
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, sabaq_from TEXT, sabaq_to TEXT, tajweed_tags TEXT, line_count INTEGER, page_count INTEGER, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, zone TEXT, tajweed_tags TEXT, mistakes INTEGER, from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tags TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL, entered_by TEXT, sabaq_from TEXT, sabaq_to TEXT, created_at TEXT);
    INSERT INTO students (id, name, role, created_date, active) VALUES
      ('K7M2QX','Umme','student','2026-01-01',1),
      ('ABCDEF','Zaynab','student','2026-01-01',1),
      ('GONE01','Left','student','2026-01-01',0),
      ('ABCDEFG','ADMIN-01','admin','2026-01-01',1),
      ('TCH001','Ustadha Maryam','teacher','2026-01-01',1);
    INSERT INTO sabaq_log (id, student_id, date, entered_by, sabaq_from, sabaq_to, created_at) VALUES (1, 'K7M2QX', '2026-08-01', 'K7M2QX', '2:1', '2:5', '2026-08-01T00:00:00Z');
  `);
  const stmt = (sql, args) => ({
    async run() { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  // prepare(sql) must work both bound and unbound (some handlers call .all()
  // straight off prepare with no parameters).
  const DB = {
    prepare(sql) { return Object.assign(stmt(sql, []), { _sql: sql, _args: [], bind(...args) { return Object.assign(stmt(sql, args), { _sql: sql, _args: args }); } }); },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  return { env: { DB }, db };
}
const ADMIN = { id: 'ABCDEFG', role: 'admin' };
const TEACHER = { id: 'TCH001', role: 'teacher' };
const STUDENT = { id: 'K7M2QX', role: 'student' };
const post = (body) => ({ json: async () => body, url: 'https://x/' });
const get = (qs) => ({ url: `https://x/?${qs}` });

{ // roster
  const { env } = makeDb();
  const r = (await handleMaktabSummary(get(`date=${TODAY}`), env, TEACHER)).data;
  check('roster: the summary lists STUDENTS only — no admin, no teacher, no inactive',
    r.students.map(s => s.id).sort().join(',') === 'ABCDEF,K7M2QX', JSON.stringify(r.students));
  const a = (await handleMaktabAttendance(get(`date=${TODAY}`), env, TEACHER)).data;
  const ids = Object.keys(a.attendance || {});
  check('roster: derived attendance is computed for STUDENTS only', !ids.includes('ABCDEFG') && !ids.includes('TCH001'), JSON.stringify(a));
}

{ // create-teaching-profile
  const { env, db } = makeDb();
  check('derive: teachingIdFor appends TEACHER', teachingIdFor('K7M2QX') === 'K7M2QXTEACHER');
  const denied = await handleCreateTeachingProfile(post({ id: 'K7M2QX' }), env, TEACHER);
  check('create: a TEACHER is refused (admin only)', denied.status === 403);
  const r = await handleCreateTeachingProfile(post({ id: 'K7M2QX' }), env, ADMIN);
  check('create: admin from a student → the derived row', !r.error && r.data.id === 'K7M2QXTEACHER' && r.data.role === 'teacher' && r.data.derived_from === 'K7M2QX', JSON.stringify(r));
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get('K7M2QXTEACHER');
  check('create: role teacher, active, NO pin (set on first login), name derived', row && row.role === 'teacher' && row.active === 1 && row.pin_hash === null && row.name === 'Umme (Teacher)', JSON.stringify(row));
  check('create: NO journal columns populated — nothing links the rows in the data', row.whatsapp_number === null && row.setup_complete === 0);
  const again = await handleCreateTeachingProfile(post({ id: 'K7M2QX' }), env, ADMIN);
  check('create: twice → 409, names the existing id', again.status === 409 && /K7M2QXTEACHER/.test(again.error), JSON.stringify(again));
  const fromTeaching = await handleCreateTeachingProfile(post({ id: 'K7M2QXTEACHER' }), env, ADMIN);
  check('create: from a teaching account → refused', fromTeaching.status === 400 && /STUDENT/.test(fromTeaching.error));
  const fromAdmin = await handleCreateTeachingProfile(post({ id: 'ABCDEFG' }), env, ADMIN);
  check('create: from the admin row → refused (ADMIN-01 keeps its own id)', fromAdmin.status === 400);
  const inactive = await handleCreateTeachingProfile(post({ id: 'GONE01' }), env, ADMIN);
  check('create: from an inactive student → refused', inactive.status === 400 && /inactive/.test(inactive.error));
  const missing = await handleCreateTeachingProfile(post({ id: 'NOPE' }), env, ADMIN);
  check('create: unknown id → 404', missing.status === 404);
  // the new row must NOT appear in the maktab roster
  const roster = (await handleMaktabSummary(get(`date=${TODAY}`), env, TEACHER)).data;
  check('create: the teaching row does not enter the maktab roster', !roster.students.find(s => s.id === 'K7M2QXTEACHER'));
  const list = (await handleListUsers(get(''), env, ADMIN)).data;
  check('list: the admin list carries the teaching row with its role', list.find(u => u.id === 'K7M2QXTEACHER' && u.role === 'teacher') !== undefined);
}

{ // updateLog date validation
  const { env, db } = makeDb();
  // isValidDate is a SHAPE check (YYYY-MM-DD) — the same one every other
  // route uses — so the malformed case is the shape, not an impossible day.
  const bad = await updateLog(env, 'sabaq_log', 1, 'K7M2QX', { date: '13/08/2026', sabaq_to: '2:9' }, 'K7M2QX', ['date', 'sabaq_from', 'sabaq_to'], true);
  check('updateLog: a bad date is REFUSED (400), not stored', bad.status === 400 && /YYYY-MM-DD/.test(bad.error) && db.prepare('SELECT date, sabaq_to FROM sabaq_log WHERE id = 1').get().date === '2026-08-01', JSON.stringify(bad));
  const good = await updateLog(env, 'sabaq_log', 1, 'K7M2QX', { date: '2026-08-02' }, 'K7M2QX', ['date', 'sabaq_from', 'sabaq_to'], false);
  check('updateLog: a good date still saves', !good.error && db.prepare('SELECT date FROM sabaq_log WHERE id = 1').get().date === '2026-08-02');
}

// ---------- admin screen ----------
const adminSrc = read('js/adminPage.js');
function adminDom(users) {
  const dom = new JSDOM('<!DOCTYPE html><body><input id="admin_search"><div id="adminUsersList"></div><div id="adminRegisterError"></div><div id="adminRegisterResult"></div><input id="admin_new_name"><input id="admin_new_whatsapp"><button id="adminRegisterBtn"></button><button id="adminRegisterContinueBtn"></button><button id="adminRegisterCancelBtn"></button><button id="adminRegisterResetPinBtn"></button></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var created = [], banners = [];
    window.confirm = () => true;
    function iconHtml(){ return ''; }
    function showBanner(m){ banners.push(m); }
    var USERS = ${JSON.stringify(users)};
    function apiAdminListUsers(){ return Promise.resolve(USERS); }
    function apiAdminCreateTeachingProfile(id){ created.push(id); const t = { id: id + 'TEACHER', name: 'x (Teacher)', role: 'teacher', active: 1 }; USERS.push(t); return Promise.resolve(t); }
    function apiAdminUpdateUser(){ return Promise.resolve({}); } function apiAdminChangeRole(){ return Promise.resolve({}); }
    function apiAdminResetPin(){ return Promise.resolve({}); } function apiAdminDeleteUser(){ return Promise.resolve({}); }
    function apiAdminRegisterStudent(){ return Promise.resolve({}); }
  `);
  w.eval(adminSrc);
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
{
  const users = [
    { id: 'K7M2QX', name: 'Umme', role: 'student', active: 1 },
    { id: 'ABCDEF', name: 'Zaynab', role: 'student', active: 1 },
    { id: 'ABCDEFTEACHER', name: 'Zaynab (Teacher)', role: 'teacher', active: 1 },
    { id: 'ABCDEFG', name: 'ADMIN-01', role: 'admin', active: 1 },
  ];
  const w = adminDom(users);
  await w.eval('loadAdminUsers()');
  await tick();
  const rows = [...w.document.querySelectorAll('.admin-list-row')];
  check('admin list: a role chip on teacher and admin rows, none on students',
    rows.length === 4 && rows[0].querySelector('.admin-role-chip') === null && rows[2].querySelector('.admin-role-chip').textContent === 'teacher' && rows[3].querySelector('.admin-role-chip').textContent === 'admin');
  // Umme: student, no teaching profile → the action is offered
  w.eval("openUserCard('K7M2QX')");
  check('admin card: an active student WITHOUT a teaching profile gets "Create teaching profile"', !!w.document.getElementById('uc_create_teaching'));
  w.document.getElementById('uc_create_teaching').click();
  await tick(); await tick(); await tick();
  check('admin card: tapping it calls the endpoint with her id and reloads the list', JSON.stringify(w.eval('created')) === '["K7M2QX"]' && /K7M2QXTEACHER/.test(w.eval('banners')[0]));
  w.document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  // Zaynab: has one → no action, a note instead
  w.eval("openUserCard('ABCDEF')");
  check('admin card: a student WITH a teaching profile gets the note, not the action',
    !w.document.getElementById('uc_create_teaching') && /ABCDEFTEACHER/.test(w.document.getElementById('uc_teaching_note').textContent));
  w.document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  // the teaching row: no action, derived-from note
  w.eval("openUserCard('ABCDEFTEACHER')");
  check('admin card: a teaching row never offers the action and names whose it is',
    !w.document.getElementById('uc_create_teaching') && /Zaynab/.test(w.document.getElementById('uc_derived_note').textContent) && /ABCDEF/.test(w.document.getElementById('uc_derived_note').textContent));
  w.document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  w.eval("openUserCard('ABCDEFG')");
  check('admin card: the admin row never offers the action', !w.document.getElementById('uc_create_teaching'));
}

// ---------- the switcher ----------
const apiSrc = read('js/api.js');
const authSrc = read('js/auth.js');
{
  // the store, driven through the real api.js helpers
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  const storeSrc = apiSrc.slice(apiSrc.indexOf('const REMEMBERED_ID_KEY'), apiSrc.indexOf('function getPathLoginId'));
  w.eval(storeSrc);
  w.eval("rememberKnownAccount({ id: 'K7M2QX', name: 'Umme', role: 'student' }); rememberKnownAccount({ id: 'K7M2QXTEACHER', name: 'Umme (Teacher)', role: 'teacher', pin: '1234', token: 'abc' });");
  const list = w.eval('getKnownAccounts()');
  check('store: two accounts, most recent first', list.length === 2 && list[0].id === 'K7M2QXTEACHER' && list[1].id === 'K7M2QX');
  check('store: ONLY id, name, role are kept — a PIN or token passed in is dropped', Object.keys(list[0]).sort().join(',') === 'id,name,role');
  check('store: nothing PIN-like anywhere in localStorage', !/1234|abc/.test(w.localStorage.getItem('hh_known_accounts')));
  w.eval("rememberKnownAccount({ id: 'K7M2QX', name: 'Umme', role: 'student' })");
  check('store: re-signing in moves an account to the front, no duplicate', w.eval('getKnownAccounts()').length === 2 && w.eval('getKnownAccounts()')[0].id === 'K7M2QX');
  w.eval("forgetKnownAccount('K7M2QXTEACHER')");
  check('store: forget removes one', w.eval('getKnownAccounts()').map(a => a.id).join(',') === 'K7M2QX');
  w.eval('requestAccountSwitch()');
  check('store: the switch flag is consumed on read', w.eval('consumeAccountSwitchRequest()') === true && w.eval('consumeAccountSwitchRequest()') === false);
}
{
  // the screen, driven through the real auth.js switch functions
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div id="loginScreenFallback" class="hidden"></div><div id="loginScreenPersonal" class="hidden"></div><div id="createPinScreen" class="hidden"></div>
    <div id="registerScreen" class="hidden"></div><div id="registeredScreen" class="hidden"></div>
    <div id="loginScreenSwitch" class="hidden"><div id="switchAccountList"></div><button id="switchUseAnotherIdBtn"></button></div>
    </body>`, { runScripts: 'dangerously', url: 'https://x/K7M2QX' });
  const w = dom.window;
  w.eval(`
    var routed = 0, replaced = null, tokenCleared = 0;
    function iconHtml(){ return '<svg></svg>'; }
    function routeToLoginScreen(){ routed++; }
    function replaceUrlWithLoginId(id){ replaced = id; }
    function clearToken(){ tokenCleared++; }
    var remembered = 'K7M2QX';
    function getRememberedLoginId(){ return remembered; }
    function rememberLoginId(id){ remembered = id; }
    function forgetRememberedLoginId(){ remembered = null; }
    var KNOWN = [{ id: 'K7M2QX', name: 'Umme', role: 'student' }, { id: 'K7M2QXTEACHER', name: 'Umme (Teacher)', role: 'teacher' }];
    function getKnownAccounts(){ return KNOWN; }
    function forgetKnownAccount(id){ KNOWN = KNOWN.filter(a => a.id !== id); }
    const ALL_LOGIN_SCREENS = ['loginScreenFallback','loginScreenPersonal','createPinScreen','registerScreen','registeredScreen','loginScreenSwitch'];
    function hideAllLoginScreens(){ ALL_LOGIN_SCREENS.forEach(id => document.getElementById(id).classList.add('hidden')); }
  `);
  const a = authSrc.indexOf('function showSwitchScreen()');
  const b = authSrc.indexOf("document.getElementById('personalSwitchAccountBtn')");
  w.eval(authSrc.slice(a, b));
  w.eval('showSwitchScreen()');
  const chips = [...w.document.querySelectorAll('.switch-account-chip')];
  check('switch: one chip per known account, name shown', chips.length === 2 && chips[0].querySelector('.switch-account-name').textContent === 'Umme');
  check('switch: a role tag on the teaching chip only', chips[0].querySelector('.switch-account-role') === null && chips[1].querySelector('.switch-account-role').textContent === 'teacher');
  check('switch: the screen is visible, others hidden', !w.document.getElementById('loginScreenSwitch').classList.contains('hidden') && w.document.getElementById('loginScreenPersonal').classList.contains('hidden'));
  chips[1].click();
  check('switch: tapping the teaching chip remembers its id, rewrites the URL and routes to the PIN screen',
    w.eval('remembered') === 'K7M2QXTEACHER' && w.eval('replaced') === 'K7M2QXTEACHER' && w.eval('routed') === 1);
  w.document.querySelector('[data-forget-id="K7M2QXTEACHER"]').click();
  check('switch: forget drops the chip and the remembered id if it was that one',
    w.document.querySelectorAll('.switch-account-chip').length === 1 && w.eval('remembered') === null);
  // "Use another ID" from the PIN screen goes to the switcher when accounts are known
  w.eval('switchLoginAccount()');
  check('switch: "Use another ID" clears the token and shows the switcher when accounts are known', w.eval('tokenCleared') === 1 && !w.document.getElementById('loginScreenSwitch').classList.contains('hidden'));
  check('switch: chip names are escaped', (() => { w.eval("KNOWN = [{ id: 'X', name: '<b>x</b>', role: 'student' }]"); w.eval('renderSwitchAccountList()'); return w.document.querySelector('.switch-account-name b') === null; })());
}
check('menu: Switch account sits between Refresh and Log out', /\{ id: 'switchAccount', label: 'Switch account', icon: 'switchAccount', raw: 'switchAccountBtn' \}/.test(authSrc));
check('menu: its listener clears the token BEFORE requesting the switch and reloading',
  /switchAccountBtn'\)\.addEventListener\('click', \(\) => \{\n\s*clearToken\(\);\n\s*requestAccountSwitch\(\);\n\s*location\.reload\(\);/.test(authSrc));
check('router: the switch flag is checked first and only honoured with known accounts', /if\(consumeAccountSwitchRequest\(\) && getKnownAccounts\(\)\.length\)\{\n\s*showSwitchScreen\(\);/.test(authSrc));
check('boot: the signed-in account is recorded for the switcher', /rememberKnownAccount\(\{ id: profile\.id, name: profile\.name, role: profile\.role \}\)/.test(read('js/app.js')));
check('html: the switch screen and its list exist', /id="loginScreenSwitch"/.test(read('index.html')) && /id="switchAccountList"/.test(read('index.html')));
check('icons: switchAccount icon exists', /switchAccount: '<svg/.test(read('js/icons.js')));
check('worker: the summary roster query filters on role', /WHERE active = 1 AND role = \\'student\\' ORDER BY name/.test(read('worker/src/maktabLog.js')));
check('worker: handleSave\'s self-log guard is KEPT (defence in depth, deliberately)', /body\.student_id === auth\.id/.test(read('worker/src/maktabLog.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
