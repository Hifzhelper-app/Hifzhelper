#!/usr/bin/env node
// V4.2.15.7 — journal Zoom link + term-break holidays + Attendance roll-up
// + quick-action alignment + Personal Journal display/menu refinements.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { handleGetMaktabSettings, handleSaveMaktabSettings } from '../worker/src/maktabSettings.js';
import { handleGetCalendar } from '../worker/src/maktabCalendar.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const auth = read('js/auth.js');
const app = read('js/app.js');
const settings = read('js/maktabSettings.js');
const att = read('js/maktabAttendancePage.js');
const navCss = read('css/nav.css');
const adminCss = read('css/admin.css');
const detailCss = read('css/detail-pages.css');
const haidhCss = read('css/haidh.css');
const journalCss = read('css/journal-table.css');
const sw = read('js/sw.js');
const workerSettings = read('worker/src/maktabSettings.js');
const workerProfile = read('worker/src/profile.js');
const workerCalendar = read('worker/src/maktabCalendar.js');
const migration = read('worker/migrations/0030_hifz_class_zoom_link.sql');

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('served assets and service-worker cache are aligned after later overlays',
  versions.length > 0 && versions.every(v => v === '4.2.15.9')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.9'/.test(sw));

check('0030 adds only the nullable Hifz class Zoom link setting',
  /ALTER TABLE maktab_settings ADD COLUMN zoom_link TEXT;/.test(migration)
  && !/CREATE TABLE|DROP TABLE/.test(migration));

check('Maktab Settings exposes one admin-editable Hifz class Zoom URL',
  /id="mset_zoom_link"[^>]*type="url"|type="url"[^>]*id="mset_zoom_link"/.test(settings)
  && /Hifz class Zoom link/.test(settings)
  && /zoom_link: document\.getElementById\('mset_zoom_link'\)\.value\.trim\(\)/.test(settings));

check('Worker accepts only https Zoom links, supports clear, and caps length',
  /body\.zoom_link !== undefined/.test(workerSettings)
  && /parsed\.protocol !== 'https:'/.test(workerSettings)
  && /2048 characters or fewer/.test(workerSettings)
  && /updates\.push\('zoom_link = NULL'\)/.test(workerSettings));

check('Profile boot payload carries the configured Zoom link without widening Maktab Settings read access',
  /SELECT timezone, zoom_link FROM maktab_settings/.test(workerProfile)
  && /row\.maktab_zoom_link =/.test(workerProfile)
  && /handleGetMaktabSettings[\s\S]{0,220}!isTeacherOrAbove\(auth\)/.test(workerSettings));

check('auth band contains a centred blue ZOOM action with the required styling',
  /id="authBandZoom"[\s\S]{0,180}>ZOOM<\/a>/.test(html)
  && /\.auth-band-zoom \{[\s\S]{0,180}left: 50%[\s\S]{0,100}translateX\(-50%\)/.test(navCss)
  && /background: #0B5CFF/.test(navCss)
  && /color: #fff/.test(navCss));

check('ZOOM follows the authenticated band on every app screen when configured',
  /const show = !!MAKTAB_ZOOM_LINK/.test(auth)
  && !/allowedScreen/.test(auth)
  && /updateAuthBandZoom\(\)/.test(app)
  && /setMaktabZoomLink\(profile\.maktab_zoom_link \|\| null\)/.test(app));

const personalStart = auth.indexOf('if(!hidePJ){');
const personalEnd = auth.indexOf('} else {', personalStart);
const personalBlock = auth.slice(personalStart, personalEnd);
const orderTokens = ["id: 'home'", "byId('journal')", "byId('logDetail')", 'ATTENDANCE_NAV_ITEM', "byId('settings')", 'MAKTAB_JOURNAL_NAV_ITEM'];
const orderIndexes = orderTokens.map(t => personalBlock.indexOf(t));
check('Personal Journal primary menu order is Home, Summary, Detail, Attendance, Settings, Maktab Journal',
  orderIndexes.every(i => i >= 0) && orderIndexes.every((v,i,a) => i === 0 || a[i-1] < v));

check('Register a user is now a solid green User Management button',
  /id="adminRegisterOpenBtn">\+ Register a user<\/button>/.test(html)
  && /#adminRegisterOpenBtn \{[\s\S]{0,240}background: var\(--palette-evergreen\)[\s\S]{0,180}color: #fff/.test(adminCss));

check('term-break public holidays use date_from when legacy date_to is NULL or blank',
  /COALESCE\(NULLIF\(TRIM\(date_to\), ''\), date_from\) >= \?2/.test(workerCalendar));

check('collapsed mobile Attendance removes the percentage th/td from table layout',
  /mkregister-grid:not\(\.mkregister-percent-open\) \.mkregister-percent-head,[\s\S]{0,180}\.mkregister-percent-cell[\s\S]{0,180}display: none !important/.test(detailCss)
  && /width: 0 !important/.test(detailCss));

check('collapsed Attendance toggle lives in Student header; expanded toggle remains in restored Attendance header',
  /mkregister-student-head-inner[\s\S]{0,620}mkregister-percent-toggle-collapsed/.test(att)
  && /mkregister-percent-head[\s\S]{0,720}mkregister-percent-toggle-expanded/.test(att)
  && /percentToggles\.forEach\(toggle =>/.test(att));

check('Attendance Quick Action Detail, Save and Close controls share one aligned row',
  /\.maktab-quick-attendance-controls \{[\s\S]{0,180}display: grid[\s\S]{0,180}grid-template-columns: 52px 52px 42px/.test(haidhCss)
  && /align-items: start/.test(haidhCss)
  && /justify-content: end/.test(haidhCss));

check('Personal Journal non-Maktab entries use fixed-width full-control-height pills',
  /#screen-journal \.journal-table \.journal-cell-text\.pj-personal \{[\s\S]{0,220}width: 108px[\s\S]{0,160}min-height: 36px[\s\S]{0,160}border-radius: 999px/.test(journalCss));

// Behavioural Worker check: Zoom validation/save/read on the real SQL path.
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE maktab_settings (
    id INTEGER PRIMARY KEY, mushaf TEXT, maktab_day_min INTEGER, absence_flag_days INTEGER,
    name TEXT, timezone TEXT, term_from TEXT, term_to TEXT, teaching_days TEXT,
    zoom_link TEXT, updated_at TEXT
  );
  INSERT INTO maktab_settings (id,mushaf,maktab_day_min,absence_flag_days,name)
  VALUES (1,'13line',3,30,'Test Maktab');
  CREATE TABLE maktab_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date_from TEXT, date_to TEXT,
    label TEXT, type TEXT, source TEXT
  );
  INSERT INTO maktab_calendar (date_from,date_to,label,type,source)
  VALUES ('2026-09-23',NULL,'Null End Holiday','holiday','seed');
  INSERT INTO maktab_calendar (date_from,date_to,label,type,source)
  VALUES ('2026-09-24','','Heritage Day','holiday','seed');
`);
const stmt = (sql,args=[]) => {
  const normalized = sql.replace(/\?[0-9]+/g, '?');
  return {
    async run(){ const r=db.prepare(normalized).run(...args); return {meta:{last_row_id:Number(r.lastInsertRowid)}}; },
    async first(){ return db.prepare(normalized).get(...args) ?? null; },
    async all(){ return {results:db.prepare(normalized).all(...args)}; },
    bind(...next){ return stmt(sql,next); }
  };
};
const env = { DB: { prepare(sql){ return stmt(sql); } } };
const admin = {id:'A1',role:'admin'};
const teacher = {id:'T1',role:'teacher'};
const bad = await handleSaveMaktabSettings({json:async()=>({zoom_link:'http://example.com/class'})},env,admin);
const saved = await handleSaveMaktabSettings({json:async()=>({zoom_link:'https://zoom.us/j/123456'})},env,admin);
const fetched = await handleGetMaktabSettings({},env,teacher);
check('Zoom setting behaviour rejects http and round-trips https for teacher-readable settings',
  bad.status === 400 && saved.data?.zoom_link === 'https://zoom.us/j/123456' && fetched.data?.zoom_link === 'https://zoom.us/j/123456');

const calendar = await handleGetCalendar({url:'https://x/maktab/calendar?year=2026'},env,{id:'S1',role:'student'});
check('single-day public holidays are returned with NULL or blank date_to during a term break',
  calendar.data?.some(r => r.date_from === '2026-09-23' && r.type === 'holiday')
  && calendar.data?.some(r => r.date_from === '2026-09-24' && r.type === 'holiday'));

check('last-edit headers reflect the latest later edits only where those files were touched',
  /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/auth\.js \*\//.test(auth)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| js\/maktabAttendancePage\.js \*\//.test(att)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| css\/journal-table\.css \*\//.test(journalCss)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(read('js/maktabDay.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
