// ============================================================
// verify_v3780_delivery3.mjs — V3.78.0, delivery 3: groups, tajweed tags
// as ID-referenced rows, the maktab timezone.
//
//   migrations: 0022 run WHOLE against real SQLite over a realistic base
//               (seed, conversion word→id with drops, groups, timezone);
//               0023 separately, proving it clears words and keeps ids.
//   worker:     the two list modules (create/rename/retire, gates), the
//               group-ordered roster with ungrouped last, group assignment
//               on update-user, the timezone setting, maktabTodayISO.
//   frontend:   the ID-vocabulary picker (no "+ add", retired handling,
//               hasMajorTajweedTag), the summary's group gaps, the
//               search-to-student flow, appTodayISO.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleGetTajweedTags, handleCreateTajweedTag, handleUpdateTajweedTag, handleGetMaktabGroups, handleCreateMaktabGroup, handleUpdateMaktabGroup } from '../worker/src/lists.js';
import { handleMaktabSummary } from '../worker/src/maktabLog.js';
import { handleUpdateUser } from '../worker/src/admin.js';
import { handleGetMaktabSettings, handleSaveMaktabSettings } from '../worker/src/maktabSettings.js';
import { maktabTodayISO } from '../worker/src/utils.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- the migrations, whole ----------
function baseDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, mushaf TEXT DEFAULT '13line', track_haidh INTEGER DEFAULT 0, whatsapp_number TEXT, gender TEXT, setup_complete INTEGER DEFAULT 0);
    CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, mushaf TEXT DEFAULT '13line', maktab_day_min INTEGER DEFAULT 1, absence_flag_days INTEGER DEFAULT 30, name TEXT DEFAULT '', updated_at TEXT);
    INSERT INTO maktab_settings (id) VALUES (1);
    CREATE TABLE sabaq_log (id INTEGER PRIMARY KEY, tajweed_tags TEXT);
    CREATE TABLE sabaq_dhor_log (id INTEGER PRIMARY KEY, tajweed_tags TEXT);
    CREATE TABLE dhor_log (id INTEGER PRIMARY KEY, tajweed_tags TEXT);
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY, student_id TEXT, date TEXT, tajweed_tags TEXT, sabaq_from TEXT, sabaq_to TEXT, line_count INTEGER, page_count INTEGER, teacher_id TEXT, teacher_name TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT, entered_by TEXT, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY, student_id TEXT, date TEXT, tajweed_tags TEXT, zone TEXT, mistakes INTEGER, from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER, teacher_id TEXT, teacher_name TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT, entered_by TEXT, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY, student_id TEXT, date TEXT, tajweed_tags TEXT, segment_from INTEGER, segment_to INTEGER, ref TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT, teacher_id TEXT, teacher_name TEXT, is_duplicate INTEGER DEFAULT 0, created_at TEXT, entered_by TEXT, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT);
    CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
  `);
  const stmt = (sql, args) => ({
    async run() { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const DB = {
    prepare(sql) { return Object.assign(stmt(sql, []), { _sql: sql, _args: [], bind(...args) { return Object.assign(stmt(sql, args), { _sql: sql, _args: args }); } }); },
    async batch(list) { for (const s of list) db.prepare(s._sql).run(...s._args); return []; },
  };
  return { db, env: { DB } };
}
const runSql = (db, file) => db.exec(read('worker/migrations/' + file));

{
  const { db } = baseDb();
  db.exec(`INSERT INTO sabaq_log VALUES (1, 'Madd,Ghunnah'), (2, 'MyCustomTag'), (3, NULL), (4, ''), (5, ' Madd , Omission ,Unknown');
           INSERT INTO maktab_dhor_log (id, tajweed_tags) VALUES (1, 'Waqf');
           INSERT INTO students (id, name, role, created_date) VALUES ('S1','A','student','2026-01-01');`);
  runSql(db, '0022_groups_tags_timezone.sql');
  check('0022: eleven tags seeded, majors right', db.prepare('SELECT COUNT(*) c FROM tajweed_tags').get().c === 11
    && db.prepare("SELECT major FROM tajweed_tags WHERE name = 'Omission'").get().major === 1
    && db.prepare("SELECT major FROM tajweed_tags WHERE name = 'Madd'").get().major === 0);
  const r = (id) => db.prepare('SELECT tajweed_tags, tajweed_tag_ids FROM sabaq_log WHERE id = ?').get(id);
  check('0022: words converted to ids (Madd,Ghunnah → their seeded ids)', r(1).tajweed_tag_ids === '6,4', JSON.stringify(r(1)));
  check('0022: a custom word matching no tag is DROPPED (row gets NULL)', r(2).tajweed_tag_ids === null);
  check('0022: NULL and empty stay NULL', r(3).tajweed_tag_ids === null && r(4).tajweed_tag_ids === null);
  check('0022: whitespace tolerated, the unknown word dropped from a mixed list', r(5).tajweed_tag_ids === '6,2', JSON.stringify(r(5)));
  check('0022: every one of the six tables got the column and the maktab one converted too',
    db.prepare('SELECT tajweed_tag_ids FROM maktab_dhor_log WHERE id = 1').get().tajweed_tag_ids === '11');
  check('0022: the WORD column is untouched (0023 is the destructive step)', r(1).tajweed_tags === 'Madd,Ghunnah');
  check('0022: groups table + students.group_id + settings.timezone exist', (() => {
    db.exec("INSERT INTO maktab_groups (name) VALUES ('Alif')");
    db.exec("UPDATE students SET group_id = 1 WHERE id = 'S1'");
    db.exec("UPDATE maktab_settings SET timezone = 'UTC' WHERE id = 1");
    return db.prepare('SELECT group_id FROM students WHERE id = ?').get('S1').group_id === 1;
  })());
  runSql(db, '0023_clear_tajweed_words.sql');
  check('0023: clears the word columns and ONLY them', r(1).tajweed_tags === null && r(1).tajweed_tag_ids === '6,4'
    && db.prepare('SELECT tajweed_tags FROM maktab_dhor_log WHERE id = 1').get().tajweed_tags === null);
}

// ---------- the list endpoints ----------
const ADMIN = { id: 'A1', role: 'admin' }, TEACHER = { id: 'T1', role: 'teacher' }, STUDENT = { id: 'S1', role: 'student' };
const post = (body) => ({ json: async () => body, url: 'https://x/' });
const get = () => ({ url: 'https://x/' });
function migratedEnv() {
  const { db, env } = baseDb();
  runSql(db, '0022_groups_tags_timezone.sql');
  runSql(db, '0024_group_descriptions.sql');   // V3.79.0: lists.js selects description now
  runSql(db, '0025_term_dates.sql');           // V3.80.0: settings selects term_from/term_to now
  runSql(db, '0026_maktab_calendar.sql');      // V3.87.0: terms + calendar tables
  return { db, env };
}
{
  const { env } = migratedEnv();
  const asStudent = await handleGetTajweedTags(get(), env, STUDENT);
  check('tags: a STUDENT can read the vocabulary (her PJ cards carry the picker)', !asStudent.error && asStudent.data.length === 11);
  check('tags: create is admin-only', (await handleCreateTajweedTag(post({ name: 'Tafkheem' }), env, TEACHER)).status === 403);
  const c = await handleCreateTajweedTag(post({ name: 'Tafkheem', major: false }), env, ADMIN);
  check('tags: created', !c.error && c.data.name === 'Tafkheem');
  check('tags: duplicate name → 409', (await handleCreateTajweedTag(post({ name: 'Tafkheem' }), env, ADMIN)).status === 409);
  check('tags: rename propagates by construction (the row changes, references hold the id)',
    !(await handleUpdateTajweedTag(post({ id: c.data.id, name: 'Tafkheem/Tarqeeq' }), env, ADMIN)).error
    && (await handleGetTajweedTags(get(), env, ADMIN)).data.find(t => t.id === c.data.id).name === 'Tafkheem/Tarqeeq');
  check('tags: retire flips, never deletes', !(await handleUpdateTajweedTag(post({ id: c.data.id, retired: true }), env, ADMIN)).error
    && (await handleGetTajweedTags(get(), env, ADMIN)).data.find(t => t.id === c.data.id).retired === 1);
  check('groups: read is teacher+, a student is refused', (await handleGetMaktabGroups(get(), env, STUDENT)).status === 403
    && !(await handleGetMaktabGroups(get(), env, TEACHER)).error);
  const g = await handleCreateMaktabGroup(post({ name: 'Alif' }), env, ADMIN);
  check('groups: created; duplicate → 409', !g.error && (await handleCreateMaktabGroup(post({ name: 'Alif' }), env, ADMIN)).status === 409);
  check('groups: retire flips', !(await handleUpdateMaktabGroup(post({ id: g.data.id, retired: true }), env, ADMIN)).error);
}

// ---------- roster order + assignment ----------
{
  const { db, env } = migratedEnv();
  db.exec(`INSERT INTO maktab_groups (name) VALUES ('Baa'), ('Alif');
    INSERT INTO students (id, name, role, created_date, group_id) VALUES
      ('S1','Zaynab','student','2026-01-01',1),
      ('S2','Amina','student','2026-01-01',2),
      ('S3','Umme','student','2026-01-01',NULL),
      ('S4','Basheera','student','2026-01-01',2),
      ('S5','Aaliyah','student','2026-01-01',NULL),
      ('T1','Ustadha','teacher','2026-01-01',NULL);`);
  const r = (await handleMaktabSummary({ url: `https://x/?date=${TODAY}` }, env, TEACHER)).data;
  check('roster: group name order, alpha within, UNGROUPED LAST, no teaching rows',
    r.students.map(s => s.name).join(',') === 'Amina,Basheera,Zaynab,Aaliyah,Umme', r.students.map(s => s.name).join(','));
  check('roster: each row carries group_name for the gap-drawing', r.students[0].group_name === 'Alif' && r.students[3].group_name === null);
  const bad = await handleUpdateUser(post({ id: 'S3', group_id: 999 }), env, ADMIN);
  check('assign: unknown group → 404', bad.status === 404);
  db.exec('UPDATE maktab_groups SET retired = 1 WHERE id = 1');
  check('assign: a RETIRED group cannot be assigned', (await handleUpdateUser(post({ id: 'S3', group_id: 1 }), env, ADMIN)).status === 400);
  check('assign: a live group can; null clears', !(await handleUpdateUser(post({ id: 'S3', group_id: 2 }), env, ADMIN)).error
    && db.prepare("SELECT group_id FROM students WHERE id='S3'").get().group_id === 2
    && !(await handleUpdateUser(post({ id: 'S3', group_id: null }), env, ADMIN)).error
    && db.prepare("SELECT group_id FROM students WHERE id='S3'").get().group_id === null);
  check('assign: students already IN the retired group keep pointing at it (retire never strands a name)',
    db.prepare("SELECT group_id FROM students WHERE id='S1'").get().group_id === 1);
}

// ---------- the timezone ----------
{
  const { db, env } = migratedEnv();
  const before = (await handleGetMaktabSettings(get(), env, TEACHER)).data;
  check('settings: GET carries timezone (null while unset)', before.timezone === null);
  check('settings: an unknown zone is refused', (await handleSaveMaktabSettings(post({ timezone: 'Mars/OlympusMons' }), env, ADMIN)).status === 400);
  check('settings: a real zone saves', !(await handleSaveMaktabSettings(post({ timezone: 'Asia/Karachi' }), env, ADMIN)).error
    && db.prepare('SELECT timezone FROM maktab_settings WHERE id=1').get().timezone === 'Asia/Karachi');
  const t = await maktabTodayISO(env);
  check('worker today: matches the maktab zone\'s own calendar day', t === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()), t);
  check('settings: empty clears back to not-set', !(await handleSaveMaktabSettings(post({ timezone: '' }), env, ADMIN)).error
    && db.prepare('SELECT timezone FROM maktab_settings WHERE id=1').get().timezone === null);
  check('worker today: unset → UTC day (the pre-V3.78.0 behaviour)', (await maktabTodayISO(env)) === TODAY);
  db.exec("UPDATE maktab_settings SET timezone = 'Not/AZone'");
  check('worker today: a bad STORED zone falls back to UTC rather than throwing', (await maktabTodayISO(env)) === TODAY);
}

// ---------- frontend: the picker ----------
const tajweedSrc = read('js/tajweed.js');
{
  const dom = new JSDOM('<!DOCTYPE html><body><div id="picker"></div></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`var VOCAB = [
    { id: 1, name: 'Substitution', major: 1, retired: 0 },
    { id: 6, name: 'Madd', major: 0, retired: 0 },
    { id: 12, name: 'Old & <Custom>', major: 0, retired: 1 },
  ];
  function apiGetTajweedTags(){ return Promise.resolve(VOCAB); }`);
  w.eval(tajweedSrc);
  await w.eval('loadTajweedVocabulary()');
  w.eval("var selected = ['6', '12']; renderTajweedPicker('picker', selected)");
  check('picker: the trigger shows NAMES resolved from ids', w.document.querySelector('.tajweed-trigger-btn').textContent === 'Madd, Old & <Custom>');
  w.document.querySelector('.tajweed-trigger-btn').click();
  const rows = [...w.document.querySelectorAll('.tajweed-checkbox-row')];
  check('picker: popup offers live tags + the retired one THIS entry already has', rows.length === 3);
  check('picker: names set as text, not markup', w.document.querySelector('.tajweed-checkbox-row b') === null && rows[2].textContent.includes('Old & <Custom>') && rows[2].textContent.includes('(retired)'));
  const tajweedCode = tajweedSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  check('picker: NO "+ add" — additions are admin work on Maktab Settings now (code, not comments)', w.document.getElementById('tajweedPopupAddBtn') === null && !/hh_tajweed_custom|addCustomTajweedTag/.test(tajweedCode));
  rows[0].querySelector('.tajweed-cb').click();
  check('picker: checking pushes the ID string', JSON.stringify(w.eval('selected')) === JSON.stringify(['6', '12', '1']));
  check('picker: hasMajorTajweedTag works on ids', w.eval("hasMajorTajweedTag(['6'])") === false && w.eval("hasMajorTajweedTag(['6','1'])") === true);
  // a retired tag not on the entry is not offered
  const dom2 = new JSDOM('<!DOCTYPE html><body><div id="picker"></div></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w2 = dom2.window;
  w2.eval(`function apiGetTajweedTags(){ return Promise.resolve([
    { id: 1, name: 'Substitution', major: 1, retired: 0 }, { id: 12, name: 'Gone', major: 0, retired: 1 } ]); }`);
  w2.eval(tajweedSrc);
  await w2.eval('loadTajweedVocabulary()');
  w2.eval("renderTajweedPicker('picker', [])");
  w2.document.querySelector('.tajweed-trigger-btn').click();
  check('picker: a retired tag is NOT offered on an entry that lacks it', [...w2.document.querySelectorAll('.tajweed-checkbox-row')].length === 1);
}

// ---------- frontend: the summary's gaps + search ----------
const summarySrc = read('js/maktabSummary.js');
function summaryDom(students) {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <input type="date" id="maktabSummaryDatePicker">
    <div class="journal-header-cell maktab-search-cell"><button type="button" id="maktabSummarySearchToggle">Student</button><input type="search" id="maktabSummarySearch" class="hidden"><div id="maktabSummarySearchResults" class="hidden"></div></div><!-- V3.84.0: the search lives in the header cell now -->
    <table><tbody id="maktabSummaryBody"></tbody></table></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    function showScreen(){ } function formatDateCell(d){ return d; } function describeDhorSegment(f,t){ return 'x'; }
    var dhorCurrentRef = 'waterval';
    function journalCellShorthand(){ return '<span class="journal-cell-text">-</span>'; }
    var SUMMARY_PAYLOAD = { students: ${JSON.stringify(students)}, sabaq: [], sabaq_dhor: [], dhor: [], attendance: [] };
    function apiMaktabSummary(){ return Promise.resolve(SUMMARY_PAYLOAD); }
    var openedWith = null;
    function openMaktabDay(student, date){ openedWith = { student, date }; return Promise.resolve(); }
    function openMaktabHaidhCalendar(){ }
    function apiGetMaktabAttendance(){ return Promise.resolve({ isMaktabDay: true, attendance: {} }); }
    function wireCustomDateDisplay(){ } function iconHtml(){ return ''; }
  `);
  w.eval(summarySrc);
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
{
  const roster = [
    { id: 'S2', name: 'Amina', track_haidh: 0, group_id: 2, group_name: 'Alif' },
    { id: 'S4', name: 'Basheera', track_haidh: 0, group_id: 2, group_name: 'Alif' },
    { id: 'S1', name: 'Zaynab', track_haidh: 0, group_id: 1, group_name: 'Baa' },
    { id: 'S5', name: 'Aaliyah', track_haidh: 0, group_id: null, group_name: null },
    { id: 'S3', name: 'Umme', track_haidh: 0, group_id: null, group_name: null },
  ];
  const w = summaryDom(roster);
  await w.renderMaktabSummaryScreen();
  const rows = [...w.document.querySelectorAll('#maktabSummaryBody tr')];
  const kinds = rows.map(r => r.className.includes('maktab-group-gap') ? 'GAP' : r.className.includes('maktab-summary-row') ? 'ROW' : '?');
  check('summary: a gap row exactly where the group changes (Alif|Baa|ungrouped)',
    kinds.join(',') === 'ROW,ROW,GAP,ROW,GAP,ROW,ROW', kinds.join(','));
  check('summary: no gap before the first group and none inside one', kinds[0] === 'ROW' && kinds[1] === 'ROW');
  // search
  const input = w.document.getElementById('maktabSummarySearch');
  input.value = 'um';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  const results = [...w.document.querySelectorAll('.maktab-search-result')];
  check('search: typing lists matching students with their group', results.length === 1 && /Umme/.test(results[0].textContent));
  results[0].click();
  await tick();
  const o = w.eval('openedWith');
  check('search: picking opens her DAY VIEW, carrying the summary\'s date', !!o && o.student.id === 'S3' && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
    && o.date === w.document.getElementById('maktabSummarySearch')._date);
  check('search: the box clears and the results close after picking', input.value === '' && w.document.getElementById('maktabSummarySearchResults').classList.contains('hidden'));
  input.value = 'zzz';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  check('search: no match says so', /No matching student/.test(w.document.getElementById('maktabSummarySearchResults').textContent));
}

// ---------- frontend: appTodayISO ----------
{
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  const src = read('js/logContext.js');
  const a = src.indexOf('let MAKTAB_TIMEZONE');
  const b = src.indexOf('async function loadMaktabSettings');
  // 2026-08-28: a `let` at the top level of an indirect eval scopes to
  // THAT eval — a later eval's bare assignment writes a global property
  // the closure never sees. The old two-eval drive therefore never
  // exercised the maktab branch at all, and the check only "passed"
  // while the device-UTC day happened to equal Karachi's (it flipped
  // the moment Karachi crossed midnight at 19:00Z). The setter is
  // defined in the SAME eval so it closes over the real binding. In the
  // browser the file loads as one classic script — production was
  // always fine; only this drive was wrong.
  w.eval(src.slice(a, b) + "\nwindow.__ssSetTZ = (z) => { MAKTAB_TIMEZONE = z; };");
  w.eval("__ssSetTZ('Asia/Karachi')");
  check('appTodayISO: the maktab zone\'s day when set', w.eval('appTodayISO()') === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()));
  w.eval('__ssSetTZ(null)');
  check('appTodayISO: the device day when unset (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(w.eval('appTodayISO()')));
  check('maktabTodayISO (frontend) delegates to appTodayISO', /return appTodayISO\(\);/.test(read('js/maktabDay.js')));
  check('haidhTodayISO uses appTodayISO when present', /if\(typeof appTodayISO === 'function'\) return appTodayISO\(\);/.test(read('js/haidhDetailScreen.js')));
}

// ---------- the wiring that is asserted, not driven ----------
check('cards: all three send tajweed_tag_ids, none sends the word field',
  ['js/sabaqPage.js', 'js/sabaqDhorPage.js', 'js/dhorPage.js'].every(f => /tajweed_tag_ids:/.test(read(f)) && !/tajweed_tags:/.test(read(f))));
check('worker: all four log modules whitelist tajweed_tag_ids, none the old field',
  ['worker/src/sabaqLog.js', 'worker/src/sabaqDhorLog.js', 'worker/src/dhorLog.js', 'worker/src/maktabLog.js'].every(f => /tajweed_tag_ids/.test(read(f)) && !/'tajweed_tags'/.test(read(f))));
check('boot: the vocabulary and the timezone load at login for every role',
  /MAKTAB_TIMEZONE = profile\.maktab_timezone \|\| null;/.test(read('js/app.js')) && /await loadTajweedVocabulary\(\);/.test(read('js/app.js')));
check('settings screen: timezone select + both list managers exist',
  /mset_timezone/.test(read('js/maktabSettings.js')) && /msetGroupsList/.test(read('js/maktabSettings.js')) && /msetTagsList/.test(read('js/maktabSettings.js')));
check('admin card: the group select saves through update-user', /fields\.group_id = groupSel\.value === '' \? null : Number\(groupSel\.value\);/.test(read('js/adminPage.js')));
check('migration 0023 exists, separate, and touches ONLY the word columns',
  read('worker/migrations/0023_clear_tajweed_words.sql').match(/UPDATE \w+\s+SET tajweed_tags = NULL/g).length === 6
  && !/tajweed_tag_ids\s*=/.test(read('worker/migrations/0023_clear_tajweed_words.sql')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
