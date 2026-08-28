// ============================================================
// verify_v3820_student_summary.mjs — V3.82.0: the STUDENT SUMMARY card.
//
// The fourth card on the log-detail rail, maktab mode only: the PJ
// journal LAYOUT over the MAKTAB'S entries for the student ONLY — the
// maktab's own record, independent of the (k) merge. Name tap on the
// maktab summary opens it; each log cell routes to its own card.
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
const detailSrc = read('js/logDetailScreen.js');
const daySrc = read('js/maktabDay.js');
const summarySrc = read('js/maktabSummary.js');

// ---------- markup ----------
check('html: the 4th dot exists, labelled Summary, hidden by default',
  /<button type="button" class="dot" data-index="3" id="logDetailSummaryDot" hidden>Summary<\/button>/.test(html));
check('html: the 4th card exists at the rail\'s end, hidden by default, with the journal table',
  /id="card-studentSummary" hidden/.test(html) && /id="studentSummaryBody"/.test(html) && /id="maktabNameRow_studentSummary"/.test(html));
{
  const rail = html.slice(html.indexOf('id="logDetailRail"'), html.indexOf('</section>', html.indexOf('id="logDetailRail"')));
  check('html: the rail holds exactly four cards, summary last',
    (rail.match(/log-detail-card/g) || []).length === 4 && rail.indexOf('card-studentSummary') > rail.indexOf('card-dhor'));
}

// ---------- the card order + the maktab-only toggle ----------
check('order: studentSummary is the fourth entry', /const LOG_DETAIL_CARD_ORDER = \['sabaq', 'sabaqDhor', 'dhor', 'studentSummary'\];/.test(detailSrc));
check('toggle: card, dot and the has-summary class all follow the maktab context',
  /summaryCard\.hidden = !inMaktab;/.test(detailSrc) && /summaryDot\.hidden = !inMaktab;/.test(detailSrc)
  && /classList\.toggle\('has-summary', inMaktab\)/.test(detailSrc)
  && /if\(inMaktab && typeof renderStudentSummaryCard === 'function'\) await renderStudentSummaryCard\(\);/.test(detailSrc));
check('css: the desktop grid holds four when the summary shows', /\.log-detail-rail\.has-summary \{ grid-template-columns: repeat\(4, 1fr\); \}/.test(read('css/detail-pages.css')));
check('name rows: the painter covers the fourth card', /\['sabaq', 'sabaqDhor', 'dhor', 'studentSummary'\]\.forEach/.test(daySrc));

// ---------- the dots guard, driven: a hidden card can never go active ----------
{
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div id="logDetailDots"><button class="dot" data-index="0"></button><button class="dot" data-index="1"></button><button class="dot" data-index="2"></button><button class="dot" data-index="3"></button></div>
    <div id="logDetailRail"><div id="c0"></div><div id="c1"></div><div id="c2"></div><div id="c3" hidden></div></div>
    </body>`, { runScripts: 'dangerously' });
  const w = dom.window;
  // rail at x=0; visible cards at 120/240/360 (card 0 in view); the hidden
  // card rects to 0,0 — exactly the phantom that would win without the guard.
  w.document.getElementById('logDetailRail').getBoundingClientRect = () => ({ left: 100 });
  w.document.getElementById('c0').getBoundingClientRect = () => ({ left: 100 });
  w.document.getElementById('c1').getBoundingClientRect = () => ({ left: 480 });
  w.document.getElementById('c2').getBoundingClientRect = () => ({ left: 860 });
  w.document.getElementById('c3').getBoundingClientRect = () => ({ left: 0 });
  const a = detailSrc.indexOf('function updateLogDetailDots');
  const b = detailSrc.indexOf("document.getElementById('logDetailRail').addEventListener");
  w.eval(detailSrc.slice(a, b));
  w.eval('updateLogDetailDots()');
  const active = [...w.document.querySelectorAll('.dot')].map(d => d.classList.contains('active'));
  check('dots: the hidden summary card is skipped — card 0 is active, not the phantom', JSON.stringify(active) === '[true,false,false,false]', JSON.stringify(active));
}

// ---------- the renderer, driven ----------
function cardDom() {
  const dom = new JSDOM('<!DOCTYPE html><body><span id="studentSummaryHeaderIcon"></span><table><tbody id="studentSummaryBody"></tbody></table></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var calls = [], opened = [];
    var CTX = { id: 'STU2', name: 'Umme', track: true };
    var currentUser = { id: 'TCH1', name: 'Teacher' };
    function logCtxStudentId(){ return CTX.id; }
    function logCtxStudentName(){ return CTX.name; }
    function logCtxTrackHaidh(){ return CTX.track; }
    var SABAQ = [{ date: '2026-08-27', id: 1 }, { date: '2026-08-25', id: 2 }];
    var SDHOR = [{ date: '2026-08-27', id: 3 }];
    var DHOR = [{ date: '2026-08-26', id: 4 }, { date: '2026-08-26', id: 5 }];
    function apiGetMaktabSabaq(id){ calls.push(['sabaq', id]); return Promise.resolve(SABAQ); }
    function apiGetMaktabSabaqDhor(id){ calls.push(['sdhor', id]); return Promise.resolve(SDHOR); }
    function apiGetMaktabDhor(id){ calls.push(['dhor', id]); return Promise.resolve(DHOR); }
    function iconHtml(){ return 'i'; }
    function formatDateCell(d){ return d; }
    function maktabCellHtml(type, entries){ return (entries || []).length ? type + ':' + entries.length : ''; }
    function openMaktabDay(student, date, card){ opened.push([student.id, student.name, student.track_haidh, date, card]); }
  `);
  const a = daySrc.indexOf('async function renderStudentSummaryCard');
  w.eval(daySrc.slice(a));
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));

{ // teacher viewing a student: For-style calls, rows newest first, tap-through
  const w = cardDom();
  await w.eval('renderStudentSummaryCard()'); await tick();
  check('card: a teacher\'s view passes the student\'s id to all three GETs',
    JSON.stringify(w.eval('calls.map(c => c[1])')) === '["STU2","STU2","STU2"]');
  const rows = [...w.document.querySelectorAll('#studentSummaryBody tr')];
  check('card: one row per date, newest first', rows.length === 3
    && rows.map(r => r.cells[0].textContent).join(' ') === '2026-08-27 2026-08-26 2026-08-25');
  check('card: the three cells use the shared cell renderer (counts visible)',
    rows[0].cells[1].innerHTML === 'sabaq:1' && rows[0].cells[2].innerHTML === 'sabaqDhor:1'
    && rows[1].cells[3].innerHTML === 'dhor:2' && rows[2].cells[2].innerHTML === '');
  rows[1].click();
  check('card: tapping a row opens that DAY\'s cards for the ctx student',
    JSON.stringify(w.eval('opened[0]')) === JSON.stringify(['STU2', 'Umme', true, '2026-08-26', 'sabaq']));
}
{ // the student's own read-only path: no id passed (own-scoped endpoints)
  const w = cardDom();
  w.eval("currentUser = { id: 'STU2', name: 'Umme' };");
  await w.eval('renderStudentSummaryCard()'); await tick();
  check('card: her own view calls WITHOUT a student_id', w.eval('calls.every(c => c[1] === undefined)') === true);
}
{ // empty state
  const w = cardDom();
  w.eval('SABAQ = []; SDHOR = []; DHOR = [];');
  await w.eval('renderStudentSummaryCard()'); await tick();
  check('card: the empty state reads as the maktab journal\'s does', /No maktab entries yet\./.test(w.document.getElementById('studentSummaryBody').textContent));
}

// ---------- routing pins ----------
check('summary: the NAME tap opens the summary card with the picked date',
  /nameTd\.addEventListener\('click', \(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*openMaktabDay\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date, 'studentSummary'\);/.test(summarySrc));
check('summary: each log cell routes to its OWN card', /td\.addEventListener\('click', \(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*openMaktabDay\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date, type\);/.test(summarySrc));
check('summary: the whole-row tap keeps its old target (day view, default card)',
  /tr\.addEventListener\('click', \(\) => openMaktabDay\(\{ id: stu\.id, name: stu\.name, mushaf: stu\.mushaf \|\| null, track_haidh: !!stu\.track_haidh \}, date\)\);/.test(summarySrc));
check('day: openMaktabDay takes initialCard, defaulting to sabaq',
  /async function openMaktabDay\(student, date, initialCard\)\{/.test(daySrc)
  && /await showScreen\('logDetail', initialCard \|\| 'sabaq'\);/.test(daySrc));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
