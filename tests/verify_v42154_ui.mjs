#!/usr/bin/env node
// V4.2.15.4 — Attendance 2-way sort/reset + mobile header + Haidh popup polish + Calendar consolidation.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8');
let pass=0, fail=0;
const check=(label,cond)=>{ if(cond) pass++; else { fail++; console.log('FAIL:',label); } };
const html=read('index.html'), att=read('js/maktabAttendancePage.js'), css=read('css/detail-pages.css');
const admin=read('js/adminPage.js'), adminCss=read('css/admin.css'), auth=read('js/auth.js');
const settings=read('js/maktabSettings.js'), settingsCss=read('css/settings.css'), cal=read('js/maktabCalendarPage.js'), sw=read('js/sw.js');

const carriedVersions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m=>m[1]);
const carriedCache = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('V4.2.15.4 behaviour survives later page/cache overlays with aligned keys',
  carriedVersions.length > 0 && !!carriedCache && carriedVersions.every(v => v === carriedCache));

check('Attendance title has a small reset Sort pill and no redundant Maktab Summary button',
  /<h2>Attendance<\/h2>[\s\S]{0,260}id="mkregisterDefaultSortBtn"[^>]*>Sort<\/button>/.test(html)
  && !/id="mkweekMaktabSummaryBtn"/.test(html)
  && /id="mkweekCloseBtn"[^>]*aria-label="Return to Maktab Summary"/.test(html));

check('Student and Attendance chevrons are two-way only; reset is separate',
  /TWO-WAY only/.test(att)
  && /mkregisterSortDirection = mkregisterSortDirection === firstDirection \? secondDirection : firstDirection/.test(att)
  && /function mkregResetSort\(host, data\)[\s\S]{0,180}mkregisterSortKey = 'default'[\s\S]{0,120}mkregisterSortDirection = null/.test(att)
  && !/third tap|default -> A-Z -> Z-A -> default/.test(att));

const sortStart=att.indexOf('function mkregMondayOf');
const sortEnd=att.indexOf('// V4.2.11.1+',sortStart);
const ctx={}; vm.createContext(ctx); vm.runInContext(att.slice(sortStart,sortEnd),ctx);
const weeks=[
 {monday:'2026-08-31',columns:[{date:'2026-08-31'},{date:'2026-09-01'},{date:'2026-09-02'},{date:'2026-09-03'}]},
 {monday:'2026-09-07',columns:[{date:'2026-09-07'},{date:'2026-09-08'},{date:'2026-09-09'},{date:'2026-09-10'}]}
];
const students=[
 {id:'a',name:'Amina',attendance_percent:80,cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present','2026-09-07':'present'}},
 {id:'b',name:'Bilqees',attendance_percent:100,cells:{'2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
 {id:'c',name:'Celine',attendance_percent:70,cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
 {id:'h',name:'Haifa',attendance_percent:100,cells:{'2026-09-07':'haidh'}},
 {id:'z',name:'Zara',attendance_percent:100,cells:{'2026-09-07':'absent'}}
];
check('default ordering remains current-week activity count then alphabetical, Haidh, absent',
  ctx.mkregSortStudents(students,'2026-09-07',weeks).map(s=>s.id).join(',')==='b,c,a,h,z');
check('manual Attendance sort remains term-wide: active days then attendance %, alphabetical ties',
  ctx.mkregSortStudents(students,'2026-09-07',weeks,'attendance','desc','2026-08-31','2026-09-10').map(s=>s.id).slice(0,3).join(',')==='a,c,b');

check('mobile Attendance heading removes literal percent text and centres an Attendance reveal icon under the word',
  /mkregister-attendance-label-mobile">Attendance<\/span>/.test(att)
  && /mkregister-percent-toggle[\s\S]{0,220}\$\{iconHtml\('attendance'\)\}/.test(att)
  && /\.mkregister-attendance-head-inner \{ display: flex; flex-direction: column; align-items: center/.test(css)
  && /\.mkregister-attendance-label-desktop \{ display: none; \}/.test(css)
  && /\.mkregister-attendance-label-mobile \{ display: inline;/.test(css));
check('desktop/tablet still has Attendance % and the reveal icon remains mobile-only',
  /mkregister-attendance-label-desktop">Attendance %<\/span>/.test(att)
  && /\.mkregister-percent-toggle \{ display: none; \}/.test(css));

check('Haidh settings popup gives student name Haaidha heading weight and separates larger Save from X',
  /admin-haidh-settings-titles"><strong>Haaidha<\/strong><strong class="admin-haidh-settings-student">/.test(admin)
  && /admin-haidh-settings-actions/.test(admin)
  && /\.admin-haidh-settings-actions \{[^}]*gap:18px/.test(adminCss)
  && /\.admin-haidh-settings-save svg \{ width:36px; height:36px; \}/.test(adminCss)
  && /\.admin-haidh-settings-card \.admin-haidh-settings-close \{ position:static/.test(adminCss));

check('standalone Calendar is removed from menu and Home assembly',
  !/g1\.push\(MAKTAB_CALENDAR_NAV_ITEM\)/.test(auth)
  && !/g3\.push\(MAKTAB_CALENDAR_NAV_ITEM\)/.test(auth)
  && !/out\.push\(MAKTAB_CALENDAR_NAV_ITEM\)/.test(auth));

check('Maktab Settings Calendar card contains the full month viewer above Terms',
  /id="msetMcalPrevBtn"[\s\S]{0,500}id="msetMcalGrid"[\s\S]{0,400}id="msetMcalList"[\s\S]{0,400}id="msetTermsList"/.test(settings)
  && /wireMsetEmbeddedCalendar/.test(settings)
  && /renderMsetEmbeddedCalendar/.test(settings));
check('embedded month viewer supports month arrows and year-selector synchronisation',
  /function wireMsetEmbeddedCalendar\(\)/.test(cal)
  && /prev\.addEventListener\('click', \(\) => shift\(-1\)\)/.test(cal)
  && /next\.addEventListener\('click', \(\) => shift\(1\)\)/.test(cal)
  && /yearSel\.addEventListener\('change',[\s\S]{0,120}setMsetEmbeddedCalendarYear/.test(settings));

check('Public holidays and significant Islamic dates are visibly named on date cells and in the list',
  /mcal-day-events/.test(cal)
  && /mcal-day-event-\$\{e\.type\}/.test(cal)
  && /mcalEventText\(e\)/.test(cal)
  && /mcal-list-\$\{e\.type\}/.test(cal)
  && /mcal-day-event-holiday/.test(settingsCss)
  && /mcal-day-event-islamic/.test(settingsCss));
check('calendar and term edits invalidate cache and refresh the embedded viewer immediately',
  (settings.match(/renderMsetEmbeddedCalendar\(\)/g)||[]).length >= 5
  && /apiConfirmCalList\(year, type, rows\)[\s\S]{0,180}mcalInvalidate\(\)[\s\S]{0,180}renderMsetEmbeddedCalendar/.test(settings));

check('V4.2.15.4 is frontend-only: latest migration remains 0029',
  fs.readdirSync(path.join(ROOT,'worker/migrations')).sort().at(-1).startsWith('0029_'));

check('V4.2.15.4 untouched files retain their last-edit headers while Calendar carries its later fix header',
  /^\/\* Hifzhelper build 4\.2\.15\.4 \| js\/maktabAttendancePage\.js \*\//.test(att)
  && /^\/\* Hifzhelper build 4\.2\.15\.4 \| js\/adminPage\.js \*\//.test(admin)
  && /^\/\* Hifzhelper build 4\.2\.15\.4 \| js\/auth\.js \*\//.test(auth)
  && /^\/\* Hifzhelper build 4\.2\.15\.4 \| js\/maktabSettings\.js \*\//.test(settings)
  && /^\/\* Hifzhelper build 4\.2\.15\.5 \| js\/maktabCalendarPage\.js \*\//.test(cal));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
