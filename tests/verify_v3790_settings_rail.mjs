// ============================================================
// verify_v3790_settings_rail.mjs — V3.79.0: Maktab Settings as a 3-card
// (2026-08-28: a Safari-specific GitHub upload failure was chased through
// this file — the file was always clean; Chrome uploaded it fine. The
// chase left one real improvement: the device-zone stub is a plain
// msetDeviceZone reassignment now, not an Intl.DateTimeFormat patch.)
// rail; group descriptions; the option-3 timezone control; inline
// instant-commit lists (no Save on the two list cards).
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { handleGetMaktabGroups, handleUpdateMaktabGroup, handleCreateMaktabGroup } from '../worker/src/lists.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

// ---------- migration 0024 ----------
function makeEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE maktab_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, retired INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));");
  db.exec(read('worker/migrations/0024_group_descriptions.sql'));
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
const ADMIN = { id: 'A1', role: 'admin' };
const post = (body) => ({ json: async () => body, url: 'https://x/' });
const get = () => ({ url: 'https://x/' });

{
  const { db, env } = makeEnv();
  check('0024: adds description, nullable', db.prepare("SELECT name FROM pragma_table_info('maktab_groups') WHERE name='description'").get() !== undefined);
  const g = await handleCreateMaktabGroup(post({ name: 'Alif' }), env, ADMIN);
  check('groups: GET carries description (null until set)', (await handleGetMaktabGroups(get(), env, ADMIN)).data[0].description === null);
  check('groups: description saves, trimmed', !(await handleUpdateMaktabGroup(post({ id: g.data.id, description: '  the seniors  ' }), env, ADMIN)).error
    && db.prepare('SELECT description FROM maktab_groups WHERE id=?').get(g.data.id).description === 'the seniors');
  check('groups: empty description clears to NULL', !(await handleUpdateMaktabGroup(post({ id: g.data.id, description: '' }), env, ADMIN)).error
    && db.prepare('SELECT description FROM maktab_groups WHERE id=?').get(g.data.id).description === null);
  check('groups: over-long description refused', (await handleUpdateMaktabGroup(post({ id: g.data.id, description: 'x'.repeat(201) }), env, ADMIN)).status === 400);
  check('groups: description + name + retired can ride one update', !(await handleUpdateMaktabGroup(post({ id: g.data.id, name: 'Baa', description: 'd', retired: true }), env, ADMIN)).error
    && JSON.stringify(db.prepare('SELECT name, description, retired FROM maktab_groups WHERE id=?').get(g.data.id)) === JSON.stringify({ name: 'Baa', description: 'd', retired: 1 }));
}

// ---------- the rail markup ----------
const html = read('index.html');
{
  const section = (html.match(/<section class="screen hidden" id="screen-maktabSettings">[\s\S]*?<\/section>/) || [''])[0];
  check('html: dots strip with General/Tajweed/Groups + the close button', /General/.test(section) && /Tajweed/.test(section) && /Groups/.test(section) && /maktabSettingsCloseBtn/.test(section));
  check('html: the rail reuses the log-detail classes (sizing/snap/grid for free)',
    /class="log-detail-rail" id="msetRail"/.test(section) && (section.match(/log-detail-card/g) || []).length === 3);   // V3.89.0: Groups folded into General
  check('html: three card-scroll hosts (Groups lives inside General now)', ['msetCardGeneral', 'msetCardTajweed', 'msetCardCalendar'].every(id => section.includes(`id="${id}"`))
    && !/id="msetCardGroups"/.test(section));
}

// ---------- the screen, driven ----------
const src = read('js/maktabSettings.js');
function dom(settings, groups, tags) {
  const d = new JSDOM(`<!DOCTYPE html><body>
    <div id="msetDots"><button class="dot" data-index="0"></button><button class="dot" data-index="1"></button><button class="dot" data-index="2"></button></div>
    <div id="msetRail"><div><div id="msetCardGeneral"></div></div><div><div id="msetCardTajweed"></div></div><div><div id="msetCardCalendar"></div></div></div><!-- V3.89.0: Groups renders inside General's template -->
    </body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = d.window;
  w.eval(`
    function appTodayISO(){ return '2026-08-28'; }
    function apiGetMaktabTerms(){ return Promise.resolve([]); }
    function apiCreateMaktabTerm(){ return Promise.resolve({ id: 1 }); }
    function apiUpdateMaktabTerm(){ return Promise.resolve({ ok: true }); }
    function apiDeleteMaktabTerm(){ return Promise.resolve({ ok: true }); }
    function apiGetMaktabCalendar(){ return Promise.resolve([]); }
    function apiCreateMaktabCalEntry(){ return Promise.resolve({ id: 1 }); }
    function apiUpdateMaktabCalEntry(){ return Promise.resolve({ ok: true }); }
    function apiDeleteMaktabCalEntry(){ return Promise.resolve({ ok: true }); }
    function apiLoadCalPredictions(){ return Promise.resolve({ added: 0 }); }
    function apiLoadCalHolidays(y){ return Promise.resolve({ added: 0, year: y }); }
    function mcalInvalidate(){}
    var calls = [];
    var SETTINGS = ${JSON.stringify(settings)};
    var GROUPS = ${JSON.stringify(groups)};
    var TAGS = ${JSON.stringify(tags)};
    var REJECT_NEXT = null;
    function maybeReject(){ if(REJECT_NEXT){ const m = REJECT_NEXT; REJECT_NEXT = null; return Promise.reject(new Error(m)); } return null; }
    function apiGetMaktabSettings(){ return Promise.resolve(SETTINGS); }
    function apiSaveMaktabSettings(p){ calls.push(['save', p]); return Promise.resolve({}); }
    function apiGetMaktabGroups(){ return Promise.resolve(GROUPS); }
    function apiGetTajweedTags(){ return Promise.resolve(TAGS); }
    function apiUpdateMaktabGroup(id, f){ const r = maybeReject(); if(r) return r; calls.push(['group', id, f]); const g = GROUPS.find(g => g.id === id); if(f.name) g.name = f.name; if(f.description !== undefined) g.description = f.description; if(f.retired !== undefined) g.retired = f.retired ? 1 : 0; return Promise.resolve({}); }
    function apiCreateMaktabGroup(name){ calls.push(['newgroup', name]); GROUPS.push({ id: 99, name, description: null, retired: 0 }); return Promise.resolve({ id: 99 }); }
    function apiUpdateTajweedTag(id, f){ const r = maybeReject(); if(r) return r; calls.push(['tag', id, f]); const t = TAGS.find(t => t.id === id); if(f.name) t.name = f.name; if(f.major !== undefined) t.major = f.major ? 1 : 0; if(f.retired !== undefined) t.retired = f.retired ? 1 : 0; return Promise.resolve({}); }
    function apiCreateTajweedTag(name, major){ calls.push(['newtag', name, major]); TAGS.push({ id: 88, name, major: major ? 1 : 0, retired: 0 }); return Promise.resolve({ id: 88 }); }
    function loadTajweedVocabulary(){ return Promise.resolve(); }
    function invalidateMaktabSettings(){ } function loadMaktabSettings(){ return Promise.resolve(); }
    var MAKTAB_TIMEZONE = null;
    function iconHtml(){ return ''; }
  `);
  w.eval(src);
  // deterministic device zone: msetDeviceZone is a top-level function
  // declaration in the module source, so it can simply be reassigned
  // after the eval — no constructor patching needed.
  w.eval("msetDeviceZone = function(){ return 'Asia/Karachi'; };");
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const S = { name: 'M', mushaf: '13line', maktab_day_min: 1, absence_flag_days: 30, timezone: null };
const G = [{ id: 1, name: 'Alif', description: 'seniors', retired: 0 }, { id: 2, name: 'Baa', description: null, retired: 1 }];
const T = [{ id: 1, name: 'Substitution', major: 1, retired: 0 }, { id: 6, name: 'Madd', major: 0, retired: 0 }];

{ // V3.85.0: the ONE-FIELD timezone control — field shows the staged
  // zone; tapping opens the chooser; every stage action closes it and
  // repaints the field (the user's lingering-device-button bug gone by
  // construction). Staging semantics unchanged: Save commits.
  const w = dom(S, JSON.parse(JSON.stringify(G)), JSON.parse(JSON.stringify(T)));
  await w.eval('renderMaktabSettingsScreen()'); await tick(); await tick();
  // V3.94.0 regression net (the user's dead-card bug): a SECOND render
  // must leave the Calendar card alive — the run-once wire guard left
  // rebuilt elements unpopulated and listener-less. Render again and
  // assert the year still has its options and the popup opener works.
  await w.eval('renderMaktabSettingsScreen()'); await tick(); await tick();
  check('v3940: the year select survives a SECOND render (the wire-once guard is gone)',
    w.document.getElementById('mset_cal_year').options.length >= 8
    && w.document.getElementById('mset_cal_year').value !== '');
  const field = () => w.document.getElementById('mset_tz_field');
  const chooser = () => w.document.getElementById('mset_tz_chooser');
  check('tz: unset shows "Not set" in the single field; chooser closed', field().textContent === 'Not set' && chooser().classList.contains('hidden'));
  field().click();
  check('tz: tapping the field opens the chooser with the device offer and a filled datalist',
    !chooser().classList.contains('hidden')
    && /Asia\/Karachi/.test(w.document.getElementById('mset_tz_device').textContent)
    && !w.document.getElementById('mset_tz_device').classList.contains('hidden')
    && w.document.getElementById('mset_tz_zones').children.length > 0
    && w.document.getElementById('mset_tz_clear').classList.contains('hidden'));   // nothing staged yet → no clear
  w.document.getElementById('mset_tz_device').click();
  check('tz: the device option STAGES (no write) and the chooser CLOSES — nothing lingers on screen',
    w.document.getElementById('mset_timezone').value === 'Asia/Karachi'
    && field().textContent === 'Asia/Karachi'
    && chooser().classList.contains('hidden')
    && w.eval('calls.filter(c => c[0] === "save").length') === 0);
  field().click();
  check('tz: reopened with the device zone already staged, the device offer is HIDDEN and clear shows',
    w.document.getElementById('mset_tz_device').classList.contains('hidden')
    && !w.document.getElementById('mset_tz_clear').classList.contains('hidden'));
  w.document.getElementById('mset_save').click(); await tick(); await tick(); await tick();
  const saved = w.eval('calls.find(c => c[0] === "save")');
  check('tz: Save commits the staged zone with the other fields', saved && saved[1].timezone === 'Asia/Karachi' && saved[1].mushaf === '13line' && saved[1].name === 'M', JSON.stringify(saved));
  check('tz: MAKTAB_TIMEZONE updated for the session', w.eval('MAKTAB_TIMEZONE') === 'Asia/Karachi');
  w.document.getElementById('mset_tz_clear').click();
  check('tz: clear stages empty and closes; the field reads Not set', w.document.getElementById('mset_timezone').value === '' && field().textContent === 'Not set' && chooser().classList.contains('hidden'));
  field().click();
  w.document.getElementById('mset_tz_other').value = 'Europe/London';
  w.document.getElementById('mset_tz_other').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('tz: typing a zone stages it, closes the chooser, repaints the field',
    w.document.getElementById('mset_timezone').value === 'Europe/London'
    && field().textContent === 'Europe/London'
    && chooser().classList.contains('hidden'));
}

{ // the lists: inline instant commit, no Save anywhere near them
  const w = dom(S, JSON.parse(JSON.stringify(G)), JSON.parse(JSON.stringify(T)));
  await w.eval('renderMaktabSettingsScreen()'); await tick(); await tick();
  check('cards: General holds the ONLY save button', w.document.querySelectorAll('#msetCardGeneral #mset_save').length === 1
    && w.document.querySelector('#msetCardTajweed #mset_save, #msetCardGroups #mset_save') === null);
  const tagName = w.document.querySelector('#msetTagsList .mset-name-input');
  tagName.value = 'Tabdeel';
  tagName.dispatchEvent(new w.Event('blur'));
  await tick(); await tick();
  check('tags: name commits on blur', JSON.stringify(w.eval('calls.find(c => c[0] === "tag")')) === JSON.stringify(['tag', 1, { name: 'Tabdeel' }]));
  const pills = [...w.document.querySelectorAll('#msetTagsList .mset-major-pill')];
  check('tags: the pill shows the stored side active', pills[0].children[0].className === 'active' && pills[1].children[1].className === 'active');
  pills[1].children[0].click(); await tick(); await tick();
  check('tags: tapping the other side commits major instantly', JSON.stringify(w.eval('calls[calls.length - 1]')) === JSON.stringify(['tag', 6, { major: true }]));
  const cb = w.document.querySelector('#msetTagsList .mset-retire-cb');
  cb.checked = true; cb.dispatchEvent(new w.Event('change'));
  await tick(); await tick();
  check('tags: the retire checkbox commits on tap', JSON.stringify(w.eval('calls[calls.length - 1]')) === JSON.stringify(['tag', 1, { retired: true }]));
  const desc = w.document.querySelector('#msetGroupsList .mset-desc-input');
  check('groups: description input shows the stored text', desc.value === 'seniors');
  desc.value = 'the senior girls';
  desc.dispatchEvent(new w.Event('blur'));
  await tick(); await tick();
  check('groups: description commits on blur', JSON.stringify(w.eval('calls[calls.length - 1]')) === JSON.stringify(['group', 1, { description: 'the senior girls' }]));
  w.document.getElementById('mset_tag_new').value = 'Tafkheem';
  w.document.getElementById('mset_tag_add').click(); await tick(); await tick();
  check('tags: Add commits instantly, new tags start minor', JSON.stringify(w.eval('calls.find(c => c[0] === "newtag")')) === JSON.stringify(['newtag', 'Tafkheem', false]));
  check('groups: a retired row is struck through', w.document.querySelectorAll('#msetGroupsList .mset-list-row.retired').length >= 1);
}

{ // failure: the rejection lands on the card and the stored value returns
  const w = dom(S, JSON.parse(JSON.stringify(G)), JSON.parse(JSON.stringify(T)));
  await w.eval('renderMaktabSettingsScreen()'); await tick(); await tick();
  w.eval('REJECT_NEXT = "A tag named \\"Madd\\" already exists"');
  const tagName = w.document.querySelector('#msetTagsList .mset-name-input');
  tagName.value = 'Madd';
  tagName.dispatchEvent(new w.Event('blur'));
  await tick(); await tick(); await tick();
  check('failure: the error shows against the tags card', /already exists/.test(w.document.getElementById('mset_tag_error').textContent));
  check('failure: the re-render restores the stored name', w.document.querySelector('#msetTagsList .mset-name-input').value === 'Substitution');
  const before = w.eval('calls.length');
  const n2 = w.document.querySelector('#msetTagsList .mset-name-input');
  n2.value = '   ';
  n2.dispatchEvent(new w.Event('blur'));
  await tick();
  check('failure: an emptied name restores itself without a write', n2.value === 'Substitution' && w.eval('calls.length') === before);
}

// ---------- wiring assertions ----------
check('rail: the dots driver mirrors the day view (scroll listener + dot taps + rAF update)',
  /rail\.addEventListener\('scroll', \(\) => \{ window\.requestAnimationFrame\(updateMsetDots\); \}\);/.test(src)
  && /rail\.scrollTo\(\{ left: card\.offsetLeft, behavior: 'smooth' \}\)/.test(src));
check('rail: opens on General', /rail\.scrollLeft = 0;/.test(src));
check('no browser prompt survives in the settings module', !/\bprompt\(/.test(src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
