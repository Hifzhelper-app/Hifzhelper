// ============================================================
// verify_v3820_student_summary.mjs — REWRITTEN for V3.85.0.
//
// V3.82.0 built the student summary as a fourth rail card; the user's
// feedback revised it to a STANDALONE page ("copied from the student's
// PJ" — the PJ Journal PAGE's layout; "the maktab only sees maktab
// data"). This harness now pins the revised world: the rail is back to
// THREE cards, the page exists with the PJ layout (expanded days +
// rollups + Load more), the name tap opens the PAGE, the attendance
// icon navigates, and rows tap through to the day view.
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

// ---------- the rail is back to three ----------
{
  const rail = html.slice(html.indexOf('id="logDetailRail"'), html.indexOf('</section>', html.indexOf('id="logDetailRail"')));
  check('rail: exactly THREE cards again — the summary card is gone', (rail.match(/log-detail-card/g) || []).length === 3 && !/card-studentSummary/.test(rail));
}
check('rail: the fourth dot is gone', !/logDetailSummaryDot/.test(html));
check('rail: the card order is back to three', /const LOG_DETAIL_CARD_ORDER = \['sabaq', 'sabaqDhor', 'dhor'\];/.test(detailSrc));
check('rail: the dots hidden-card guard STAYS (correct in general)', /if\(card\.hidden\) return;/.test(detailSrc));
check('rail: the name-row painter is back to three', /\['sabaq', 'sabaqDhor', 'dhor'\]\.forEach\(type => \{   \/\/ V3\.85\.0/.test(daySrc));

// ---------- the standalone page ----------
// V3.85.1 (user): the header is ONE single-row grid at the journal's
// width, and the attendance icon is sized to read (30px, not 22).
check('page: the header is a single-row grid sharing the journal\'s 70% centering — attendance icon DIRECTLY after the name since V3.90.0',
  /class="ss-header"/.test(html)
  && /grid-template-columns: auto auto auto 1fr;/.test(read('css/detail-pages.css'))
  && /\.ss-header \.screen-close-btn \{ justify-self: end; \}/.test(read('css/detail-pages.css'))
  && /@media \(min-width: 768px\)\{[^}]*\n  \.ss-header \{ width: 70%; margin-left: auto; margin-right: auto; \}/.test(read('css/detail-pages.css')));
check('page: the attendance icon is sized to read (30px)', /\.att-nav-btn svg, \.att-nav-btn \.icon \{ width: 30px; height: 30px;/.test(read('css/detail-pages.css')));
check('page: the screen exists with header, attendance icon, close, and the PJ table shape',
  /id="screen-studentSummary"/.test(html) && /id="studentSummaryTitle"/.test(html)
  && /id="studentSummaryAttendanceBtn"/.test(html) && /id="studentSummaryCloseBtn"/.test(html)
  && /id="studentSummaryTbody"/.test(html));
check('page: registered as a built screen that KEEPS the maktab context',
  /studentSummary: true, maktabCalendar: true \}/.test(appSrc)   // maktabCalendar joined in V3.87.0
  && /id === 'studentSummary'/.test(appSrc.match(/const keepsMaktabCtx =[^\n]*/)[0])
  && /if\(id === 'studentSummary'\) await renderStudentSummaryScreen\(\);/.test(appSrc));
check('summary: the NAME tap opens the standalone PAGE now',
  /nameTd\.addEventListener\('click', \(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*openStudentSummaryPage\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date\);/.test(summarySrc));
check('summary: each log cell still routes to its OWN card', /openMaktabDay\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date, type\);/.test(summarySrc));

// ---------- the page renderer, driven ----------
function pageDom(dates) {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <span id="studentSummaryHeaderIcon"></span><h2 id="studentSummaryTitle"></h2>
    <button id="studentSummaryAttendanceBtn"></button><button id="studentSummaryCloseBtn"></button>
    <table><tbody id="studentSummaryTbody"></tbody></table></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var calls = [], opened = [], attOpened = [], screens = [];
    var currentUser = { id: 'TCH1' };
    function logCtxStudentId(){ return 'STU2'; }
    function logCtxStudentName(){ return 'Umme'; }
    function logCtxTrackHaidh(){ return true; }
    function logCtxDate(){ return '2026-08-27'; }
    var DATES = ${JSON.stringify(dates)};
    function rowsFor(){ return DATES.map((d, i) => ({ date: d, id: i + 1, sabaq_from: '2:1', sabaq_to: '2:5' })); }
    function apiGetMaktabSabaq(id, since){ calls.push(['sabaq', id, since]); return Promise.resolve(rowsFor()); }
    function apiGetMaktabSabaqDhor(id, since){ calls.push(['sdhor', id, since]); return Promise.resolve([]); }
    function apiGetMaktabDhor(id, since){ calls.push(['dhor', id, since]); return Promise.resolve([]); }
    function iconHtml(n){ return '[' + n + ']'; }
    function formatDateCell(d){ return d; }
    function journalCellShorthand(type, entries){ return (entries || []).length ? type + ':' + entries.length : '—'; }
    function renderJournalRollupRow(from, to){ const tr = document.createElement('tr'); tr.className = 'journal-rollup-row'; tr.textContent = from + '..' + to; return tr; }
    function openMaktabDay(stu, date){ opened.push([stu.id, date]); }
    function openMaktabAttendancePage(stu, date){ attOpened.push([stu.id, date]); }
    function showScreen(id){ screens.push(id); return Promise.resolve(); }
    function setMaktabLogContext(){}
    function maktabTodayISO(){ return '2026-08-28'; }
  `);
  const a = daySrc.indexOf('const SS_EXPANDED_DAYS');
  w.eval(daySrc.slice(a));
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const manyDates = Array.from({ length: 24 }, (_, i) => {
  const d = new Date('2026-08-28T00:00:00Z'); d.setUTCDate(d.getUTCDate() - i * 2); return d.toISOString().slice(0, 10);
});

{ // teacher view: For-calls with a window, 10 expanded + rollups + Load more
  const w = pageDom(manyDates);
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: teacher fetches pass the student id AND a since window',
    w.eval('calls').every(c => c[1] === 'STU2' && /^\d{4}-\d{2}-\d{2}$/.test(c[2])));
  check('page: the header carries her name and the attendance icon', w.document.getElementById('studentSummaryTitle').textContent === 'Umme'
    && w.document.getElementById('studentSummaryAttendanceBtn').innerHTML === '[attendance]');
  const rows = [...w.document.querySelectorAll('#studentSummaryTbody tr')];
  const expanded = rows.filter(r => r.querySelector('.cell-date'));
  const rollups = rows.filter(r => r.className === 'journal-rollup-row');
  check('page: the PJ layout — 10 expanded days, the rest rolled up, newest first',
    expanded.length === 10 && rollups.length >= 2
    && expanded[0].querySelector('.cell-date').textContent === manyDates[0], `${expanded.length}/${rollups.length}`);
  check('page: Load more exists and widens the window on tap', !!w.document.getElementById('studentSummaryLoadMore'));
  const before = w.eval('calls.length');
  w.document.getElementById('studentSummaryLoadMore').click(); await tick(); await tick();
  check('page: Load more refetches with an older since', w.eval('calls.length') === before + 3
    && w.eval('calls')[before][2] < w.eval('calls')[0][2]);
  expanded[1].click();
  check('page: a row tap opens that DAY\'s log cards', JSON.stringify(w.eval('opened[0]')) === JSON.stringify(['STU2', manyDates[1]]));
  w.document.getElementById('studentSummaryAttendanceBtn').click();
  check('page: the attendance icon opens her attendance page on the ctx date', JSON.stringify(w.eval('attOpened[0]')) === '["STU2","2026-08-27"]');
  w.document.getElementById('studentSummaryCloseBtn').click();
  check('page: close returns to the maktab summary', w.eval('screens').includes('maktabSummary'));
}
{ // her own read-only path: no student_id
  const w = pageDom(['2026-08-27']);
  w.eval("currentUser = { id: 'STU2' };");
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: her own view calls WITHOUT a student_id', w.eval('calls').every(c => c[1] === undefined));
}
{ // empty state
  const w = pageDom([]);
  await w.eval('renderStudentSummaryScreen()'); await tick();
  check('page: the empty state names the maktab record', /No maktab entries yet\./.test(w.document.getElementById('studentSummaryTbody').textContent));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
