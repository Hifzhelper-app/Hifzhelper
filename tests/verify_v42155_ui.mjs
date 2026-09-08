#!/usr/bin/env node
// V4.2.15.5 — multi-entry Daily Report + current-month Student Summary
// + Calendar gap events/term cards + mobile Quick Action refinements.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const sw = read('js/sw.js');
const icons = read('js/icons.js');
const report = read('js/maktabDailyReport.js');
const reportCss = read('css/daily-report.css');
const day = read('js/maktabDay.js');
const detailCss = read('css/detail-pages.css');
const cal = read('js/maktabCalendarPage.js');
const settingsCss = read('css/settings.css');
const summary = read('js/maktabSummary.js');
const journalCss = read('css/journal-table.css');
const haidhCss = read('css/haidh.css');

check('page assets and service-worker cache remain aligned after later overlays',
  [...html.matchAll(/\?v=([0-9.]+)/g)].length > 0
  && [...html.matchAll(/\?v=([0-9.]+)/g)].every(m => m[1] === '4.2.15.10')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.10'/.test(sw));

check('Daily Report converts each entry separately and joins every same-activity entry with commas',
  /function maktabDailyReportSingleEntryText\(type, entry\)/.test(report)
  && /maktabCellHtml\(type, entry \? \[entry\] : \[\]\)/.test(report)
  && /entries\.map\(entry => maktabDailyReportSingleEntryText\(type, entry\)\)/.test(report)
  && /values\.join\(', '\)/.test(report));

// Drive the comma-list helper with a tiny DOM stub so this is behavioural,
// not just a source-string pin.
const reportFnsStart = report.indexOf('function maktabDailyReportSingleEntryText');
const reportFnsEnd = report.indexOf('function maktabDailyReportSetStatus', reportFnsStart);
const reportCtx = {
  document: {
    createElement(){
      return {
        textContent: '',
        set innerHTML(v){ this.textContent = String(v).replace(/<[^>]*>/g, ''); }
      };
    }
  },
  maktabCellHtml(type, entries){ return `<span>${entries[0]?.display || ''}</span>`; }
};
vm.createContext(reportCtx);
vm.runInContext(report.slice(reportFnsStart, reportFnsEnd), reportCtx);
reportCtx.__entries = [{display:'59:10–60:13'}, {display:'60:14–61:4'}, {display:'61:5–61:10'}];
const reportList = vm.runInContext("maktabDailyReportCellText('sabaq', __entries)", reportCtx);
check('Daily Report functional output contains all three entries as one comma-separated list',
  reportList === '59:10–60:13, 60:14–61:4, 61:5–61:10');

check('Daily Report preview no longer uses Summary +N compression',
  /td\.textContent = maktabDailyReportCellText\(type, entries\)/.test(report)
  && /maktab-daily-report-entry-list/.test(report)
  && /\.maktab-daily-report-entry-list[\s\S]{0,220}white-space: normal/.test(reportCss));

check('shared Daily Report PNG wraps all comma-separated activity text and grows rows instead of ellipsising extras',
  /function maktabDailyReportWrapText\(/.test(report)
  && /const preparedRows = rows\.map\(row =>/.test(report)
  && /maxLines \* activityLineHeight/.test(report)
  && /rowsHeight = preparedRows\.reduce/.test(report));

check('Student Summary is explicitly scoped to the current calendar month',
  /function studentSummaryMonthBounds\(\)/.test(day)
  && /const first = `\$\{month\}-01`/.test(day)
  && /const since = monthBounds\.first/.test(day)
  && /r\.date < monthBounds\.first \|\| r\.date > monthBounds\.last/.test(day)
  && /studentSummaryPeriod/.test(html));

check('Student Summary shows every same-day entry inline as a comma-separated list',
  /function studentSummaryEntryText\(type, entries\)/.test(day)
  && /journalCellShorthand\(type, \[entry\]\)/.test(day)
  && /\.filter\(Boolean\)\.join\(', '\)/.test(day)
  && /td\.textContent = studentSummaryEntryText\(type, days\[date\]\[type\]\)/.test(day)
  && /student-summary-entry-list/.test(detailCss));

check('Student Summary current-month view renders all activity dates and has no Load More/weekly roll-up path',
  /const allDates = Object\.keys\(days\)\.sort\(\)\.reverse\(\)/.test(day)
  && /allDates\.forEach\(date => tbody\.appendChild\(rowFor\(date\)\)\)/.test(day)
  && !/SS_LOAD_MORE_DAYS|studentSummaryRollupRow|studentSummaryLoadMore/.test(day));

check('Calendar one-day events remain visible even when date_to is blank and no term contains the date',
  /date_to: e\.date_to \|\| e\.date_from/.test(cal)
  && /const to = e\.date_to \|\| e\.date_from/.test(cal));

// Functional Sep-24 regression: holiday sits in the gap between Term 3 and 4.
const calPrefixEnd = cal.indexOf('// the small marker html shared');
const calCtx = {};
vm.createContext(calCtx);
vm.runInContext(cal.slice(0, calPrefixEnd), calCtx);
vm.runInContext(`MCAL_CACHE['2026'] = {
  entries:[{date_from:'2026-09-24', date_to:'', label:'Public Holiday', type:'holiday'}],
  terms:[
    {name:'Term 3', term_from:'2026-08-31', term_to:'2026-09-23'},
    {name:'Term 4', term_from:'2026-09-28', term_to:'2026-12-15'}
  ]
}`, calCtx);
const sep24 = vm.runInContext("maktabCalInfoForDate('2026-09-24')", calCtx);
check('24 Sep public holiday is found in the between-terms gap',
  !!sep24 && sep24.holiday === true && sep24.term === false && /Public Holiday/.test(sep24.title));

check('Settings embedded calendar omits the redundant term list but keeps event list rendering',
  /includeTermList:false/.test(cal)
  && /if\(o\.includeTermList !== false\)/.test(cal)
  && /c\.entries\.filter\(e => e\.date_from <= monthTo && \(e\.date_to \|\| e\.date_from\) >= monthFrom\)/.test(cal));

check('each term editor is a bordered card and Add another term is visually separate beneath the cards',
  /#msetCardCalendar \.mset-terms \{ display: grid; gap: 10px; \}/.test(settingsCss)
  && /#msetCardCalendar \.mset-term-row \{[\s\S]{0,260}border: 1px solid var\(--color-table-border\)/.test(settingsCss)
  && /#msetCardCalendar #mset_term_add::after \{ content: ' Add another term'; \}/.test(settingsCss));

check('Attendance Quick Action top controls are a distinct Detail + Save + Close group',
  /class="maktab-quick-attendance-controls"[\s\S]{0,900}id="maktabQuickAttendanceDetail"[\s\S]{0,900}id="maktabQuickAttendanceSave"[\s\S]{0,900}id="maktabQuickAttendanceClose"/.test(day)
  && /\.maktab-quick-attendance-controls \{[\s\S]{0,220}display: flex[\s\S]{0,180}gap: 14px/.test(haidhCss)
  && /\.maktab-quick-attendance-save svg \{ width: 36px; height: 36px; \}/.test(haidhCss)
  && /\.maktab-quick-attendance-close svg \{ width: 28px; height: 28px; \}/.test(haidhCss));

check('mobile Sabaq Dhor quarter rows retain one right-side checkbox column',
  /\.modal-card \.maktab-quick-sd-row \{[\s\S]{0,180}display: grid[\s\S]{0,120}grid-template-columns: minmax\(0, 1fr\) 34px/.test(journalCss)
  && /\.maktab-quick-sd-manual-line \{\s*grid-template-columns: minmax\(0, 1fr\) 34px/.test(journalCss));

check('mobile Maktab Summary has a large circle-plus Log target wired to the existing Quick Log action',
  /circlePlus: '[^\n]*<circle cx="12" cy="12" r="10"\/><path d="M8 12h8"\/><path d="M12 8v8"\/>[^\n]*'/.test(icons)
  && /mobileLogBtn\.className = 'maktab-mobile-log-action'/.test(summary)
  && /iconHtml\('circlePlus'\)/.test(summary)
  && /<span>Log<\/span>/.test(summary)
  && /maktabOpenQuickLog\(student, date, 'sabaq', entriesByType\.sabaq, entriesByType, \{ combined: true \}\)/.test(summary)
  && /\.maktab-mobile-log-icon svg \{ width: 52px; height: 52px; \}/.test(journalCss));

check('V4.2.15.5 remains frontend-only; the later V4.2.15.7 migration is separately identified',
  /V4\.2\.15\.7/.test(read('worker/migrations/0030_hifz_class_zoom_link.sql'))
  && !fs.readdirSync(path.join(ROOT, 'worker/src')).some(f => /^\/\* Hifzhelper build 4\.2\.15\.5/.test(read(path.join('worker/src', f)))));

check('only edited product files carry V4.2.15.5 last-edit headers while representative untouched files retain older headers',
  /^\/\* Hifzhelper build 4\.2\.15\.5 \| js\/maktabDailyReport\.js \*\//.test(report)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.15\.5 \| js\/maktabCalendarPage\.js \*\//.test(cal)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| js\/maktabAttendancePage\.js \*\//.test(read('js/maktabAttendancePage.js'))
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| js\/maktabSettings\.js \*\//.test(read('js/maktabSettings.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
