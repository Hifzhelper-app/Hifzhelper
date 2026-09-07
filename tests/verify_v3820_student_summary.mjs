// ============================================================
// verify_v3820_student_summary.mjs — carried forward through V4.2.15.5.
//
// The V3.82 idea ultimately became a standalone Maktab-only Student Summary.
// V4.2.15.5 narrows that report to the CURRENT calendar month and renders
// every same-day entry inline, comma separated (no +N/rollups/Load more).
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const html = read('index.html');
const daySrc = read('js/maktabDay.js');
const detailSrc = read('js/logDetailScreen.js');
const summarySrc = read('js/maktabSummary.js');
const appSrc = read('js/app.js');
const detailCss = read('css/detail-pages.css');

// ---------- the rail remains three cards ----------
{
  const rail = html.slice(html.indexOf('id="logDetailRail"'), html.indexOf('</section>', html.indexOf('id="logDetailRail"')));
  check('rail: exactly THREE log cards — Student Summary is not a rail card', (rail.match(/log-detail-card/g) || []).length === 3 && !/card-studentSummary/.test(rail));
}
check('rail: the fourth summary dot is absent', !/logDetailSummaryDot/.test(html));
check('rail: card order remains Sabaq, Sabaq Dhor, Dhor', /const LOG_DETAIL_CARD_ORDER = \['sabaq', 'sabaqDhor', 'dhor'\];/.test(detailSrc));

// ---------- standalone current-month page ----------
check('page: Student Summary uses the Attendance-style header with Attendance, Ajzaa, Log and close controls',
  /id="screen-studentSummary"[\s\S]{0,900}class="juz-tracker-header-row screen-cap student-summary-header-row"/.test(html)
  && /id="studentSummaryAttendanceBtn"/.test(html)
  && /id="studentSummaryAjzaaBtn"/.test(html)
  && !/id="studentSummaryMaktabSummaryBtn"/.test(html)
  && /id="studentSummaryQuickLogBtn"/.test(html)
  && /id="studentSummaryCloseBtn"/.test(html));
check('page: current month label and four-column journal table exist',
  /id="studentSummaryPeriod"/.test(html)
  && /id="studentSummaryTbody"/.test(html)
  && /data-ss-quick-type="sabaq"/.test(html)
  && /data-ss-quick-type="sabaqDhor"/.test(html)
  && /data-ss-quick-type="dhor"/.test(html));
check('page: registered as a built screen that keeps Maktab context',
  /studentSummary: true/.test(appSrc)
  && /id === 'studentSummary'/.test(appSrc.match(/const keepsMaktabCtx =[^\n]*/)[0])
  && /if\(id === 'studentSummary'\) await renderStudentSummaryScreen\(\);/.test(appSrc));
check('summary: the student NAME tap opens the standalone page',
  /nameTd\.addEventListener\('click', \(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*openStudentSummaryPage\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date\);/.test(summarySrc));
check('V4.2.15.5: month bounds + comma-entry helpers are present; old rollup/load-more state is gone',
  /function studentSummaryMonthBounds\(\)/.test(daySrc)
  && /function studentSummaryEntryText\(type, entries\)/.test(daySrc)
  && /\.filter\(Boolean\)\.join\(', '\)/.test(daySrc)
  && !/SS_EXPANDED_DAYS|SS_LOAD_MORE_DAYS|studentSummaryLoadMore/.test(daySrc));
check('V4.2.15.5: month label and wrapped entry list are styled',
  /#screen-studentSummary \.student-summary-period/.test(detailCss)
  && /#screen-studentSummary td\.student-summary-entry-list[\s\S]{0,120}white-space: normal/.test(detailCss));

// ---------- drive the page renderer ----------
function pageDom(dates) {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <span id="studentSummaryHeaderIcon"></span><h2 id="studentSummaryTitle"></h2>
    <button id="studentSummaryAttendanceBtn"></button><button id="studentSummaryAjzaaBtn"></button>
    <button id="studentSummaryQuickLogBtn"></button><button id="studentSummaryCloseBtn"></button>
    <div id="studentSummaryPeriod"></div>
    <button data-ss-quick-type="sabaq"></button><button data-ss-quick-type="sabaqDhor"></button><button data-ss-quick-type="dhor"></button>
    <table><tbody id="studentSummaryTbody"></tbody></table></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var calls = [], opened = [], attOpened = [], screens = [], quickOpened = [];
    var currentUser = { id: 'TCH1' };
    function logCtxStudentId(){ return 'STU2'; }
    function logCtxStudentName(){ return 'Umme'; }
    function logCtxTrackHaidh(){ return true; }
    function logCtxDate(){ return '2026-08-27'; }
    var DATES = ${JSON.stringify(dates)};
    function rowsFor(){ return DATES.map((d, i) => ({ date: d, id: i + 1, sabaq_from: '2:' + (i+1), sabaq_to: '2:' + (i+2) })); }
    function apiGetMaktabSabaq(id, since){ calls.push(['sabaq', id, since]); return Promise.resolve(rowsFor()); }
    function apiGetMaktabSabaqDhor(id, since){ calls.push(['sdhor', id, since]); return Promise.resolve([]); }
    function apiGetMaktabDhor(id, since){ calls.push(['dhor', id, since]); return Promise.resolve([]); }
    function iconHtml(n){ return '[' + n + ']'; }
    function formatDateCell(d){ return d; }
    function journalCellShorthand(type, entries){ return (entries || []).length ? type + ':' + entries[0].id : '—'; }
    function openMaktabDay(stu, date){ opened.push([stu.id, date]); }
    function maktabOpenQuickAttendance(stu, date){ attOpened.push([stu.id, date]); }
    function maktabOpenQuickLog(stu,date,type,entries){ quickOpened.push([stu.id,date,type,entries.length]); }
    function openMaktabStudentSetup(){}
    function showScreen(id){ screens.push(id); return Promise.resolve(); }
    function setMaktabLogContext(){}
    function maktabTodayISO(){ return '2026-08-28'; }
  `);
  const a = daySrc.indexOf('function studentSummaryMonthBounds');
  w.eval(daySrc.slice(a));
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));

{ // teacher: current month only, duplicate same-day rows displayed inline
  const dates = ['2026-07-31', '2026-08-03', '2026-08-27', '2026-08-27', '2026-08-28', '2026-09-01'];
  const w = pageDom(dates);
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: teacher fetches the selected student from the first day of the current month',
    w.eval('calls').every(c => c[1] === 'STU2' && c[2] === '2026-08-01'));
  check('page: period label is August 2026', w.document.getElementById('studentSummaryPeriod').textContent.includes('August')
    && w.document.getElementById('studentSummaryPeriod').textContent.includes('2026'));
  const rows = [...w.document.querySelectorAll('#studentSummaryTbody tr')];
  check('page: only current-month activity dates render, newest first, one row per date',
    rows.length === 3
    && rows[0].querySelector('.cell-date').textContent === '2026-08-28'
    && rows[2].querySelector('.cell-date').textContent === '2026-08-03', String(rows.length));
  const aug27 = rows.find(r => r.querySelector('.cell-date')?.textContent === '2026-08-27');
  check('page: multiple same-day Sabaq entries are all shown as a comma-separated list',
    !!aug27 && aug27.querySelector('.student-summary-entry-list').textContent === 'sabaq:3, sabaq:4');
  check('page: there is no Load more or roll-up row',
    !w.document.getElementById('studentSummaryLoadMore') && !w.document.querySelector('.journal-rollup-row'));
  rows[1].click();
  check('page: row tap opens that date\'s log cards', JSON.stringify(w.eval('opened[0]')) === JSON.stringify(['STU2', '2026-08-27']));
  w.document.getElementById('studentSummaryAttendanceBtn').click();
  check('page: attendance opens Quick Attendance on the carried context date', JSON.stringify(w.eval('attOpened[0]')) === '["STU2","2026-08-27"]');
  w.document.getElementById('studentSummaryCloseBtn').click();
  check('page: close returns to Maktab Summary', w.eval('screens').includes('maktabSummary'));
}
{ // own read-only path: no student_id
  const w = pageDom(['2026-08-27']);
  w.eval("currentUser = { id: 'STU2' };");
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: own view calls without a student_id but still starts at month-begin', w.eval('calls').every(c => c[1] === undefined && c[2] === '2026-08-01'));
}
{ // empty state
  const w = pageDom([]);
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: empty current month shows the Maktab empty state', /No maktab entries yet\./.test(w.document.getElementById('studentSummaryTbody').textContent));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
