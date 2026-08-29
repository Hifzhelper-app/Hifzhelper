// ============================================================
// verify_v3870_calendar.mjs — V3.87.0: the MAKTAB CALENDAR.
// Worker: terms CRUD + auth (students read, never write), calendar
// CRUD, the SA holiday generator (fixed days + Easter pair + the
// Sunday→Monday rule), the idempotent prediction loader. The
// attendance default-period change (term containing today) is driven
// in verify_v3800_attendance_page.mjs.
// Frontend: the page renderer driven on a fixture (grid, dots, list),
// the settings Calendar card, and the "wherever dates appear" markers.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
import {
  ISLAMIC_PREDICTIONS, easterSunday, southAfricanHolidays,
  handleGetTerms, handleCreateTerm, handleUpdateTerm, handleDeleteTerm, termContainingToday,
  handleGetCalendar, handleCreateCalendarEntry, handleUpdateCalendarEntry, handleDeleteCalendarEntry,
  handleGetProposal, handleConfirmList,
} from '../worker/src/maktabCalendar.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

// ---------- fixture (the real migration) ----------
const runMig = (db, f) => {
  for (const st of read('worker/migrations/' + f).split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(x => x.trim()).filter(Boolean)) db.exec(st);
};
function makeEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, term_from TEXT, term_to TEXT);");
  db.exec("INSERT INTO maktab_settings (id, term_from, term_to) VALUES (1, '2026-01-14', '2026-03-25');");
  runMig(db, '0026_maktab_calendar.sql');
  runMig(db, '0027_calendar_dedupe.sql');   // V3.88.0: dedupe + the unique index
  const stmt = (sql, args) => ({
    async run() { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const DB = { prepare(sql) { return Object.assign(stmt(sql, []), { bind(...args) { return stmt(sql, args); } }); } };
  return { db, env: { DB } };
}
const post = (body) => ({ json: async () => body, url: 'https://x/y' });
const req = (q) => ({ url: 'https://x/y?' + q });
const TEACHER = { id: 'T1', role: 'teacher' };
const STUDENT = { id: 'S1', role: 'student' };

// ---------- migration ----------
{
  const { db } = makeEnv();
  const t = db.prepare('SELECT * FROM maktab_terms').all();
  check('0026: the existing General pair migrates in as Term 1', t.length === 1 && t[0].name === 'Term 1' && t[0].term_from === '2026-01-14');
  check('0026: the calendar table exists with the type CHECK', (() => {
    try { db.prepare("INSERT INTO maktab_calendar (date_from, date_to, type) VALUES ('2026-01-01', '2026-01-01', 'party')").run(); return false; }
    catch (e) { return true; }
  })());
  // V3.88.0 / 0027: the unique index refuses a repeat at the DATABASE —
  // the layer the V3.87.0 race was missing (NULL labels included).
  db.prepare("INSERT INTO maktab_calendar (date_from, date_to, label, type, source) VALUES ('2026-08-09', '2026-08-09', NULL, 'holiday', 'x')").run();
  check('0027: the unique index refuses a duplicate NULL-label holiday', (() => {
    try { db.prepare("INSERT INTO maktab_calendar (date_from, date_to, label, type, source) VALUES ('2026-08-09', '2026-08-09', NULL, 'holiday', 'x')").run(); return false; }
    catch (e) { return true; }
  })());
}
{ // 0027's DELETE half: pre-existing duplicates collapse to one each
  const db2 = new DatabaseSync(':memory:');
  db2.exec("CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, term_from TEXT, term_to TEXT); INSERT INTO maktab_settings (id) VALUES (1);");
  runMig(db2, '0026_maktab_calendar.sql');
  for (let i = 0; i < 2; i++) {
    db2.prepare("INSERT INTO maktab_calendar (date_from, date_to, label, type, source) VALUES ('2026-09-24', '2026-09-24', NULL, 'holiday', 'generated')").run();
    db2.prepare("INSERT INTO maktab_calendar (date_from, date_to, label, type, source) VALUES ('2026-02-19', '2026-02-19', 'First Fast', 'islamic', 'prediction')").run();
  }
  runMig(db2, '0027_calendar_dedupe.sql');
  check('0027: existing duplicates (the user\'s screenshot) collapse to one each, oldest kept',
    db2.prepare('SELECT COUNT(*) AS c FROM maktab_calendar').get().c === 2
    && db2.prepare('SELECT MIN(id) AS m FROM maktab_calendar').get().m === 1);
}

// ---------- terms CRUD + auth ----------
{
  const { env } = makeEnv();
  check('terms: a student can READ', !(await handleGetTerms(req(''), env, STUDENT)).error);
  check('terms: a student cannot WRITE (403)', (await handleCreateTerm(post({ name: 'X', term_from: '2026-01-01', term_to: '2026-02-01' }), env, STUDENT)).status === 403
    && (await handleUpdateTerm(post({}), env, STUDENT, 1)).status === 403
    && (await handleDeleteTerm(post({}), env, STUDENT, 1)).status === 403);
  check('terms: bad dates and reversed ranges are refused', (await handleCreateTerm(post({ name: 'X', term_from: '01/02/2026', term_to: '2026-02-01' }), env, TEACHER)).status === 400
    && (await handleCreateTerm(post({ name: 'X', term_from: '2026-03-01', term_to: '2026-02-01' }), env, TEACHER)).status === 400
    && (await handleCreateTerm(post({ name: '', term_from: '2026-01-01', term_to: '2026-02-01' }), env, TEACHER)).status === 400);
  const created = await handleCreateTerm(post({ name: 'Term 2', term_from: '2026-04-08', term_to: '2026-06-26' }), env, TEACHER);
  check('terms: create → list ordered by start', !created.error
    && (await handleGetTerms(req(''), env, TEACHER)).data.map(t => t.name).join(',') === 'Term 1,Term 2');
  await handleUpdateTerm(post({ term_to: '2026-06-30' }), env, TEACHER, created.data.id);
  check('terms: partial update holds the other fields', (await handleGetTerms(req(''), env, TEACHER)).data[1].term_to === '2026-06-30');
  check('terms: termContainingToday picks the covering term, or null outside all',
    (await termContainingToday(env, '2026-05-01')).name === 'Term 2'
    && (await termContainingToday(env, '2026-03-30')) === null);
  await handleDeleteTerm(post({}), env, TEACHER, created.data.id);
  check('terms: delete removes', (await handleGetTerms(req(''), env, TEACHER)).data.length === 1);
}

// ---------- the SA holiday generator ----------
{
  check('easter: the computus is right for 2026 and 2027', easterSunday(2026).toISOString().slice(0, 10) === '2026-04-05'
    && easterSunday(2027).toISOString().slice(0, 10) === '2027-03-28');
  const h26 = southAfricanHolidays(2026);
  check('holidays 2026: the ten fixed + Good Friday (Apr 3) + Family Day (Apr 6)',
    h26.includes('2026-04-03') && h26.includes('2026-04-06') && h26.includes('2026-06-16') && h26.includes('2026-12-26'));
  check('holidays 2026: Aug 9 falls on a SUNDAY → Aug 10 (Monday) is added, total 13',
    h26.includes('2026-08-09') && h26.includes('2026-08-10') && h26.length === 13, JSON.stringify(h26));
  const h27 = southAfricanHolidays(2027);
  check('holidays 2027: TWO Sunday collisions (Mar 21, Dec 26) → their Mondays join, total 14',
    h27.includes('2027-03-22') && h27.includes('2027-12-27') && h27.length === 14, JSON.stringify(h27));
}

// ---------- calendar CRUD + the loaders ----------
{
  const { env } = makeEnv();
  check('calendar: a student can READ', !(await handleGetCalendar(req('year=2026'), env, STUDENT)).error);
  check('calendar: a student cannot WRITE', (await handleCreateCalendarEntry(post({ type: 'holiday', date_from: '2026-01-01' }), env, STUDENT)).status === 403);
  check('calendar: a bad type is refused', (await handleCreateCalendarEntry(post({ type: 'term', date_from: '2026-01-01' }), env, TEACHER)).status === 400);
  const e = await handleCreateCalendarEntry(post({ type: 'islamic', date_from: '2026-02-19', label: 'First Fast' }), env, TEACHER);
  check('calendar: create + year-filtered read', !e.error && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.length === 1
    && (await handleGetCalendar(req('year=2027'), env, TEACHER)).data.length === 0);
  // adjust after an actual sighting — the user's core requirement
  await handleUpdateCalendarEntry(post({ date_from: '2026-02-20', date_to: '2026-02-20' }), env, TEACHER, e.data.id);
  check('calendar: an entry adjusts to the sighted date', (await handleGetCalendar(req('year=2026'), env, TEACHER)).data[0].date_from === '2026-02-20');
  await handleDeleteCalendarEntry(post({}), env, TEACHER, e.data.id);

  // ---------- V3.88.0: the propose → edit → confirm flow ----------
  const prop1 = (await handleGetProposal(req('year=2026'), env, TEACHER, 'islamic')).data;
  check('stage: a fresh year proposes the seed\'s seven days, nothing saved yet',
    prop1.current.length === 0 && prop1.proposed.length === 7
    && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.length === 0);
  // the maktab EDITS the stage: adjusts First Fast by a day (a sighting),
  // drops one day, adds one the table never had — then confirms
  const edited = prop1.proposed
    .filter(r => r.label !== "'Aashuraa")
    .map(r => r.label === 'First Fast' ? { ...r, date_from: '2026-02-20' } : r);
  edited.push({ date_from: '2026-04-15', label: 'Local observance' });
  const c1 = await handleConfirmList(post({ year: '2026', type: 'islamic', entries: edited }), env, TEACHER);
  check('stage: Confirm GENERATES the list — the confirmed rows become the year', !c1.error
    && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.filter(x => x.type === 'islamic').length === 7
    && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.some(x => x.label === 'Local observance'));
  const prop2 = (await handleGetProposal(req('year=2026'), env, TEACHER, 'islamic')).data;
  check('stage: the ADJUSTED day is never re-proposed (label dedupe — the V3.87.0 hole closed); only the dropped day returns',
    prop2.current.length === 7
    && prop2.proposed.length === 1 && prop2.proposed[0].label === "'Aashuraa"
    && prop2.current.find(x => x.label === 'First Fast').date_from === '2026-02-20');

  const hprop = (await handleGetProposal(req('year=2026'), env, TEACHER, 'holiday')).data;
  check('stage: the holiday proposal carries the 13 generated dates, label-less', hprop.proposed.length === 13
    && hprop.proposed.every(r => r.label === null));
  const c2 = await handleConfirmList(post({ year: '2026', type: 'holiday', entries: hprop.proposed.slice(0, 12) }), env, TEACHER);
  const c2again = await handleConfirmList(post({ year: '2026', type: 'holiday', entries: hprop.proposed.slice(0, 12) }), env, TEACHER);
  check('stage: holiday Confirm lands dates only and REGENERATES on repeat (no duplicates, ever)',
    !c2.error && !c2again.error
    && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.filter(x => x.type === 'holiday').length === 12
    && (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.filter(x => x.type === 'holiday').every(x => x.label === null));
  check('stage: confirming holidays leaves the islamic year UNTOUCHED (type-scoped delete)',
    (await handleGetCalendar(req('year=2026'), env, TEACHER)).data.filter(x => x.type === 'islamic').length === 7);
  check('stage: validation — a date outside the year, a nameless islamic day, a bad type all refuse',
    (await handleConfirmList(post({ year: '2026', type: 'holiday', entries: [{ date_from: '2027-01-01' }] }), env, TEACHER)).status === 400
    && (await handleConfirmList(post({ year: '2026', type: 'islamic', entries: [{ date_from: '2026-01-01', label: '' }] }), env, TEACHER)).status === 400
    && (await handleConfirmList(post({ year: '2026', type: 'term', entries: [] }), env, TEACHER)).status === 400);
  check('stage: a student can READ a proposal but never CONFIRM',
    !(await handleGetProposal(req('year=2026'), env, STUDENT, 'holiday')).error
    && (await handleConfirmList(post({ year: '2026', type: 'holiday', entries: [] }), env, STUDENT)).status === 403);
}

// ---------- the page renderer, driven ----------
const pageSrc = read('js/maktabCalendarPage.js');
{
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <button id="mcalPrevBtn"></button><span id="mcalMonthLabel"></span><button id="mcalNextBtn"></button>
    <div id="mcalWeekdays"></div><div id="mcalGrid"></div><div id="mcalList"></div></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    function appTodayISO(){ return '2026-08-28'; }
    function apiGetMaktabTerms(){ return Promise.resolve([{ id: 1, name: 'Term 3', term_from: '2026-07-14', term_to: '2026-09-25' }]); }
    function apiGetMaktabCalendar(year){ return Promise.resolve(year === '2026' ? [
      { id: 1, date_from: '2026-08-09', date_to: '2026-08-09', label: null, type: 'holiday' },
      { id: 2, date_from: '2026-08-10', date_to: '2026-08-10', label: null, type: 'holiday' },
      { id: 3, date_from: '2026-08-20', date_to: '2026-08-20', label: 'Mock day', type: 'islamic' },
    ] : []); }
  `);
  w.eval(pageSrc);
  await w.eval('renderMaktabCalendarScreen()');
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  const cells = [...w.document.querySelectorAll('.mcal-day')];
  check('page: a Monday-first 42-cell grid renders', cells.length === 42
    && w.document.getElementById('mcalWeekdays').textContent.startsWith('Mon'));
  check('page: August 2026 is labelled', /August 2026/.test(w.document.getElementById('mcalMonthLabel').textContent));
  const holidayCells = cells.filter(c => c.classList.contains('mcal-day-holiday'));
  const islamicCells = cells.filter(c => c.classList.contains('mcal-day-islamic'));
  check('page: holiday and islamic dots land on the right days', holidayCells.length === 2 && islamicCells.length === 1
    && islamicCells[0].title === 'Term 3 · Mock day');
  check('page: term days carry the term tint (Aug 2026 sits inside Term 3)', cells.filter(c => c.classList.contains('mcal-day-term')).length >= 28);
  check('page: the month list names the term and the entries (holidays as dates only)',
    /Term 3/.test(w.document.getElementById('mcalList').textContent)
    && /Mock day/.test(w.document.getElementById('mcalList').textContent)
    && /Public holiday/.test(w.document.getElementById('mcalList').textContent));
  // the marker helper the other surfaces share
  check('markers: maktabCalInfoForDate answers sync from the cache', w.eval("maktabCalInfoForDate('2026-08-20').islamic") === true
    && w.eval("maktabCalInfoForDate('2026-08-11')").term === true
    && w.eval("maktabCalInfoForDate('2027-01-01')") === null);
  check('markers: maktabCalMarkHtml emits the dot with the title', /mcal-mark-islamic/.test(w.eval("maktabCalMarkHtml('2026-08-20')"))
    && w.eval("maktabCalMarkHtml('2026-08-11')") === '');   // term alone: no dot (tint/label surfaces handle it)
}

// ---------- static pins: nav, settings card, the marker surfaces ----------
const html = read('index.html');
check('page: the screen + script + SW asset exist', /id="screen-maktabCalendar"/.test(html)
  && /js\/maktabCalendarPage\.js\?v=/.test(html) && /maktabCalendarPage\.js\?v=/.test(read('js/sw.js')));
check('nav: the Calendar item rides g3 for everyone (students read-only by construction — the page has no edit UI)',
  /const MAKTAB_CALENDAR_NAV_ITEM = \{ id: 'maktabCalendar', label: 'Calendar'/.test(read('js/auth.js'))
  && /g3\.push\(MAKTAB_CALENDAR_NAV_ITEM\);/.test(read('js/auth.js')));
const settingsSrc = read('js/maktabSettings.js');
check('settings: the Calendar card is year-picker + Terms + the TWO green popup buttons (V3.88.0)',
  /id="msetCardCalendar"/.test(html) && /id="msetTermsList"/.test(settingsSrc)
  && /id="mset_cal_islamic">Islamic Calendar</.test(settingsSrc)
  && /id="mset_cal_holidays">Public Holidays</.test(settingsSrc)
  && !/mset_cal_load_predictions|mset_cal_new_date|msetCalList/.test(settingsSrc));
check('settings: term rows put the NAME on its own line above the dates (V3.88.1)',
  /class="mset-term-name"/.test(read('js/maktabSettings.js'))
  && /class="mset-term-dates"/.test(read('js/maktabSettings.js')));
check('settings: ADD TERM is the big button only while none exist; the + takes over after',
  /mset_term_add_big'\)\.classList\.toggle\('hidden', terms\.length > 0\)/.test(settingsSrc)
  && /mset_term_add'\)\.classList\.toggle\('hidden', terms\.length === 0\)/.test(settingsSrc));
check('settings: the popup stages both types; holiday rows are DATE ONLY (no label input, no ghost text); Confirm is the only save and disables in flight',
  /function openCalStagePopup\(type\)/.test(settingsSrc)
  && /type === 'holiday'\n        \? `<input type="date"/.test(settingsSrc)
  && /btn\.disabled = true;/.test(settingsSrc)
  && /apiConfirmCalList\(year, type, rows\)/.test(settingsSrc));
check('markers: formatDateCell carries the calendar mark', /maktabCalMarkHtml === 'function' \? maktabCalMarkHtml\(iso\) : ''/.test(read('js/journal.js')));
check('markers: the haidh/attendance calendar day cells take the classes + title', /maktabCalInfoForDate\(dateISO\)/.test(read('js/haidhDetailScreen.js')));
check('markers: the day-view date headers paint the label', /t \+ '_date_info'/.test(read('js/logDetailScreen.js')));
check('worker: the attendance default reads the term containing today', /termContainingToday\(env, today\)/.test(read('worker/src/maktabAttendance.js')));

// ---------- V3.88.2: the transport-level regression net ----------
// The user's "network error" on term date edits was CORS: the editors
// are the app's FIRST PUT requests, and the worker's preflight didn't
// list PUT — the browser blocked the call before it left. Handlers
// passed every direct-call test; nothing exercised the transport. Two
// nets now: (1) every method the api clients use appears in the
// worker's Allow-Methods; (2) the :id dispatch regexes, extracted from
// index.js VERBATIM, match their real URLs.
{
  const idx = read('worker/src/index.js');
  const allow = (idx.match(/'Access-Control-Allow-Methods': '([^']+)'/) || ['', ''])[1];
  const clientMethods = [...new Set([...read('js/api.js').matchAll(/method: '(\w+)'/g)].map(m => m[1]))];
  check('transport: every method js/api.js uses is CORS-allowed (PUT was missing — the V3.88.2 bug)',
    clientMethods.length >= 4 && clientMethods.every(m => allow.includes(m)), `clients=${clientMethods} allow=${allow}`);
  const grab = (frag) => {
    const m = idx.match(new RegExp('path\\.match\\(\\/((?:[^\\/\\\\]|\\\\.)*' + frag + '(?:[^\\/\\\\]|\\\\.)*)\\/\\)'));
    return m ? new RegExp(m[1]) : null;
  };
  const termsRe = grab('terms');
  const calRe = grab('calendar');
  check('dispatch: the PUT/DELETE terms route regex matches its URL', !!termsRe && termsRe.test('/maktab/terms/12') && !termsRe.test('/maktab/terms/'), String(termsRe));
  check('dispatch: the PUT/DELETE calendar route regex matches its URL', !!calRe && calRe.test('/maktab/calendar/7') && !calRe.test('/maktab/calendarX/7'), String(calRe));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
