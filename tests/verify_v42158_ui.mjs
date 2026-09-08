#!/usr/bin/env node
// V4.2.15.8 — global auth-band Zoom + blank-date holiday fix +
// Attendance Quick Action icon alignment + Personal Journal Summary landing +
// dedicated Maktab Summary Log column/unified Quick Log entry point.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { handleGetCalendar } from '../worker/src/maktabCalendar.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const auth = read('js/auth.js');
const app = read('js/app.js');
const summary = read('js/maktabSummary.js');
const sw = read('js/sw.js');
const journalCss = read('css/journal-table.css');
const haidhCss = read('css/haidh.css');
const workerCalendar = read('worker/src/maktabCalendar.js');

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('served asset versions and service-worker cache remain aligned after later overlays',
  versions.length > 0 && versions.every(v => v === '4.2.15.10')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.10'/.test(sw));

check('configured ZOOM is global to the authenticated band rather than screen-gated',
  /function updateAuthBandZoom\(\)/.test(auth)
  && /const show = !!MAKTAB_ZOOM_LINK/.test(auth)
  && !/allowedScreen/.test(auth)
  && /if\(typeof updateAuthBandZoom === 'function'\) updateAuthBandZoom\(\)/.test(app));

check('Personal Journal setup-complete users land on Summary while incomplete users still land on Settings',
  /showScreen\(profile\.setup_complete \? 'journal' : 'settings'\)/.test(app));

check('calendar year read treats NULL, blank and whitespace date_to as a one-day event',
  /COALESCE\(NULLIF\(TRIM\(date_to\), ''\), date_from\) >= \?2/.test(workerCalendar));

// Behavioural regression for the exact reported case: a saved 24 Sep public
// holiday with an empty-string end date must still be returned for September,
// regardless of whether a term contains that day.
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE maktab_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_from TEXT,
    date_to TEXT,
    label TEXT,
    type TEXT,
    source TEXT
  );
  INSERT INTO maktab_calendar (date_from,date_to,label,type,source)
  VALUES ('2026-09-24','','Public Holiday','holiday','test');
`);
const stmt = (sql,args=[]) => {
  const normalized = sql.replace(/\?[0-9]+/g, '?');
  return {
    bind(...next){ return stmt(sql,next); },
    async first(){ return db.prepare(normalized).get(...args) ?? null; },
    async all(){ return {results:db.prepare(normalized).all(...args)}; },
    async run(){ const r=db.prepare(normalized).run(...args); return {meta:{last_row_id:Number(r.lastInsertRowid)}}; }
  };
};
const env = {DB:{prepare(sql){ return stmt(sql); }}};
const cal = await handleGetCalendar({url:'https://x/maktab/calendar?year=2026'}, env, {id:'S1',role:'student'});
check('24 Sep 2026 blank-end public holiday is returned by the real calendar handler',
  cal.data?.some(r => r.date_from === '2026-09-24' && r.label === 'Public Holiday' && r.type === 'holiday'));

check('Attendance Quick Action gives Detail, Save and Close identical 50px icon slots',
  /\.maktab-quick-attendance-controls \{ grid-template-columns: 52px 52px 52px; align-items: start; \}/.test(haidhCss)
  && /\.maktab-quick-attendance-detail > span:first-child \{[\s\S]{0,180}width: 50px;[\s\S]{0,80}height: 50px;/.test(haidhCss)
  && /\.maktab-quick-attendance-save,[\s\S]{0,80}\.maktab-quick-attendance-close \{ width: 50px; height: 50px; \}/.test(haidhCss));

check('Maktab Summary retains a dedicated sixth Log action track while later UI makes its header/rail transparent',
  !/maktab-log-head/.test(html)
  && !/\.maktab-summary-headers > \*:nth-child\(6\)/.test(journalCss)
  && /\.maktab-summary-table td:nth-child\(6\) \{ width: 10%; \}/.test(journalCss)
  && /td\.maktab-mobile-log-col \{[\s\S]{0,120}background: transparent;/.test(journalCss));

check('each Maktab Summary row has circle-plus + Log as the unified Quick Log target',
  /mobileLogBtn\.className = 'maktab-mobile-log-action'/.test(summary)
  && /iconHtml\('circlePlus'\)/.test(summary)
  && /<span>Log<\/span>/.test(summary)
  && /maktabOpenQuickLog\(student, date, 'sabaq', entriesByType\.sabaq, entriesByType, \{ combined: true \}\)/.test(summary));

check('explicit combined option makes the three-type selector available outside mobile widths',
  /const combined = !!\(opts && opts\.combined\) \|\| maktabQuickIsMobile\(\)/.test(summary)
  && /data-mql-type="sabaq"[^>]*>Sabaq</.test(summary)
  && /data-mql-type="sabaqDhor"[^>]*>Sabaq Dhor</.test(summary)
  && /data-mql-type="dhor"[^>]*>Dhor</.test(summary));

check('Maktab Summary activity cells and row whitespace no longer open individual Quick Log cards',
  !/td\.addEventListener\('click',[\s\S]{0,420}maktabOpenQuickLog/.test(summary)
  && !/tr\.addEventListener\('click',[\s\S]{0,520}(?:maktabOpenQuickLog|openMaktabDay)/.test(summary));

check('non-log targets remain available: Student Summary, Attendance and +N entry peek',
  /nameTd\.addEventListener\('click',[\s\S]{0,260}openStudentSummaryPage/.test(summary)
  && /btn\.addEventListener\('click',[\s\S]{0,260}maktabOpenQuickAttendance/.test(summary)
  && /peekBtn\.addEventListener\('click',[\s\S]{0,180}e\.stopPropagation\(\)/.test(summary));

check('loading and empty Summary rows span all six columns',
  /colspan="6"[^>]*>Loading/.test(summary)
  && /colspan="6"[^>]*>No active students/.test(summary));

check('last-edit headers still identify V4.2.15.8 files unless a later overlay edited them',
  /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/auth\.js \*\//.test(auth)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/app\.js \*\//.test(app)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.10 \| js\/sw\.js \*\//.test(sw)
  && /^\/\* Hifzhelper build 4\.2\.15\.10 \| css\/journal-table\.css \*\//.test(journalCss)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| css\/haidh\.css \*\//.test(haidhCss)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| worker\/src\/maktabCalendar\.js \*\//.test(workerCalendar)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(read('js/maktabDay.js'))
  && /^\/\* Hifzhelper build 4\.2\.15\.5 \| js\/maktabCalendarPage\.js \*\//.test(read('js/maktabCalendarPage.js'))
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| css\/nav\.css \*\//.test(read('css/nav.css')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
