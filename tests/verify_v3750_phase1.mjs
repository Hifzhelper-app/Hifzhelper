// ============================================================
// verify_v3750_phase1.mjs — the V3.75.0 Phase 1 batch (items 1, 2, 3, 4,
// 6, 10, 11 of the 2026-08-26 list of eleven).
//
// Behaviour is DRIVEN through the real modules wherever the change is
// behavioural (2, 4, 6, 10); cascade is asserted where the change is CSS
// (1, 3, 11). Two of the seven fix V3.74.x changes that never took effect
// because a lower-specificity rule lost to a later or wider one — so the
// CSS checks here assert SPECIFICITY relationships, not just that text
// exists. "The rule is present" is exactly the check that passed while
// the pill stayed 42px tall.
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
const base = read('css/base.css');
const dp = read('css/detail-pages.css');
const adminCss = read('css/admin.css');
const settingsCss = read('css/settings.css');
const summary = read('js/maktabSummary.js');
const day = read('js/maktabDay.js');
const sd = read('js/sabaqDhorPage.js');
const dhor = read('js/dhorPage.js');

// A crude specificity counter: (ids, classes+attrs+pseudo-classes, elements).
// :has(X) counts as X's most specific argument, per the spec.
function specificity(sel) {
  let s = sel.replace(/:has\(([^)]*)\)/g, (_, inner) => inner);
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elems = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(\([^)]*\))?/g, ' ').match(/\b[a-z][\w-]*\b/g) || []).length;
  return [ids, classes, elems];
}
const beats = (a, b) => { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };

// ---------- 1: Admin header ----------
{
  check('1: .card-header-row-left is gone — no rule, no class attribute (comments may still name it)',
    !/^\.card-header-row-left/m.test(dp) && !/class="[^"]*card-header-row-left/.test(html));
  check('1: the Admin header no longer carries the dead class', /id="screen-admin">[\s\S]{0,700}<div class="card-header-row">/.test(html));
  check('1: Admin has an id-scoped three-column rule',
    /#screen-admin \.card-header-row \{ grid-template-columns: auto 1fr auto; \}/.test(adminCss));
  check('1: the base :has() rule no longer forces columns on every card-screen header',
    !/\.screen:has\(> \.screen-content\) \.card-header-row \{[^}]*grid-template-columns/.test(base));
  check('1: but its heading-wrap fix survives — that was the part that fixed truncation',
    /\.screen:has\(> \.screen-content\) \.card-header-row h2 \{ white-space: normal; \}/.test(base));
  check('1: the Admin rule outranks the base rule by specificity, not by file order',
    beats(specificity('#screen-admin .card-header-row'), specificity('.screen:has(> .screen-content) .card-header-row')));
  check('1: Maktab Settings keeps its own 1fr/auto rule (two-child header)',
    /#screen-maktabSettings \.card-header-row \{ grid-template-columns: 1fr auto; \}/.test(settingsCss));

  // The collateral: every .screen with a DIRECT .screen-content child and
  // a THREE-child header row was broken the same way. Prove, from the real
  // index.html, that no such header is left depending on the base rule.
  const d = new JSDOM(html).window.document;
  const threeChild = [];
  for (const s of d.querySelectorAll('.screen')) {
    const direct = [...s.children].some(c => c.classList.contains('screen-content'));
    if (!direct) continue;
    for (const h of s.querySelectorAll('.card-header-row')) if (h.children.length >= 3) threeChild.push(s.id);
  }
  check('1: the three-child headers on card screens are exactly Admin, Tadabbur, Haidh (the collateral set)',
    threeChild.sort().join(',') === 'screen-admin,screen-haidhDetail,screen-reflections', threeChild.join(','));
}

// ---------- 2: Move to Dhor hidden until eligible ----------
{
  check('2: the render filters to ENABLED options only', /sabaqDhorMoveOptions\.filter\(o => o\.enabled\)\.map\(/.test(sd));
  check('2: no disabled attribute, no "(n of 4 complete)" count in the template',
    !/' disabled'/.test(sd) && !/\$\{o\.completeQuarters\} of 4 complete/.test(sd));
  check('2: the label is "Move <label> to Dhor" with nothing appended', /Move \$\{o\.label\} to Dhor\n/.test(sd));
  check('2: the handler still re-checks eligibility — hiding is not the only guard', /if\(!opt \|\| !opt\.enabled\) return;/.test(sd));
  // Drive the real render through its module-level state: two juz, one
  // eligible, one not. Only the eligible one may produce a button.
  const dom = new JSDOM('<!DOCTYPE html><body><div id="sabaqDhorRowsHost"></div></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  const fnSrc = sd.slice(sd.indexOf('function renderSabaqDhorRows'), sd.indexOf('\n}\n', sd.indexOf('function renderSabaqDhorRows')) + 3);
  // Find the host id the real function writes to, then give it that host.
  const hostId = (fnSrc.match(/getElementById\('([^']+)'\)/) || [])[1];
  check('2: renderSabaqDhorRows resolves a host element by id', !!hostId, fnSrc.slice(0, 200));
  w.document.body.innerHTML = `<div id="${hostId}"></div>`;
  w.eval(`
    var sabaqDhorRows = [{ id: 'q1', label: 'Quarter 1', fromSurah: 2, fromAyah: 1, toSurah: 2, toAyah: 40 }];
    var sabaqDhorMoveOptions = [
      { juz: 1, label: 'Juz 1', enabled: false, completeQuarters: 2, units: [1,2,3,4] },
      { juz: 3, label: 'Juz 3', enabled: true,  completeQuarters: 4, units: [9,10,11,12] },
    ];
    var sabaqDhorRollupLevel = 'quarter', sabaqDhorPosition = {}, sabaqDhorRef = 'waterval', sabaqDhorBaselineSelection = [];
    var sabaqDhorEditingId = null;
    function readSabaqDhorManualField(){ return null; }
    function renderSabaqDhorManualField(){ }
    function openSurahPickerForSabaqDhorManual(){ }
    function iconHtml(){ return ''; }
    function renderRecentEntries(){ }
    function wireSabaqDhorRows(){ }
    function moveJuzToDhor(){ }
    function logCtxIsMaktab(){ return true; }
  `);
  let rendered = true;
  try { w.eval(fnSrc); w.eval('renderSabaqDhorRows()'); } catch (e) { rendered = false; console.log('  render threw:', e.message); }
  const btns = [...w.document.querySelectorAll('.move-to-dhor-btn')];
  check('2: driven render — the ineligible juz produces NO button at all', rendered && !btns.some(b => b.dataset.juz === '1'));
  check('2: driven render — the eligible juz produces one, reading "Move Juz 3 to Dhor"',
    rendered && btns.length === 1 && btns[0].dataset.juz === '3' && btns[0].textContent.trim() === 'Move Juz 3 to Dhor' && !btns[0].disabled,
    btns.map(b => b.outerHTML).join(' '));
}

// ---------- 3: the pill ----------
{
  check('3: the pill rule is now .cb-note-box .mk-vis-switch', /^\.cb-note-box \.mk-vis-switch \{/m.test(dp));
  check('3: still exactly ONE rule for it (no stacked generations)', (dp.match(/\.mk-vis-switch \{/g) || []).length === 1);
  check('3: still an explicit width and height, no max-width',
    /\.cb-note-box \.mk-vis-switch \{[\s\S]{0,140}width: 240px;/.test(dp)
    && /\.cb-note-box \.mk-vis-switch \{[\s\S]{0,140}height: 20px;/.test(dp)
    && !/\.cb-note-box \.mk-vis-switch \{[\s\S]{0,140}max-width/.test(dp));
  // The actual bug: base .switch-track (settings.css, loaded LATER) had
  // equal specificity, so source order gave it the height. Assert the
  // pill rule now outranks it regardless of order.
  const baseTrack = settingsCss.match(/^\.switch-track \{[^}]*height: (\d+)px/m);
  check('3: base .switch-track still sets a height (the thing that was winning)', !!baseTrack);
  check('3: the pill rule outranks base .switch-track by specificity, so load order cannot undo it',
    beats(specificity('.cb-note-box .mk-vis-switch'), specificity('.switch-track')));
  const order = (html.match(/href="css\/([\w-]+)\.css/g) || []).map(s => s.replace(/.*css\//, '').replace('.css', ''));
  check('3: (and load order really is detail-pages BEFORE settings — the trap is real, not hypothetical)',
    order.indexOf('detail-pages') < order.indexOf('settings'), order.join(','));
  check('3: the option/thumb sub-rules already had two classes and still do',
    /\.mk-vis-switch \.switch-option \{/.test(dp) && /\.mk-vis-switch \.switch-thumb \{/.test(dp));
}

// ---------- 4: +1 badge wired directly ----------
{
  check('4: the badge is wired on the button itself, inside the render', /const peekBtn = td\.querySelector\('\[data-entry-peek\]'\);/.test(summary)
    && /peekBtn\.addEventListener\('click'/.test(summary));
  check('4: the document listener only closes now — no delegated open', !/e\.target\.closest\('\[data-entry-peek\]'\)/.test(summary));
  // Drive the REAL summary render (stubs mirror verify_e1) and click the badge.
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <input type="date" id="maktabSummaryDatePicker"><table><tbody id="maktabSummaryBody"></tbody></table></body>`,
    { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    function showScreen(){ }
    function formatDateCell(d){ return d; }
    function describeDhorSegment(f, t){ return 'J' + f + '-J' + t; }
    var dhorCurrentRef = 'waterval';
    function journalCellShorthand(type, entries){
      if(!entries || !entries.length) return '<span class="journal-cell-empty">—</span>';
      const e = entries[0];
      const text = type === 'sabaq' ? e.sabaq_from + '–' + e.sabaq_to : 'x';
      const badge = entries.length > 1 ? '<button type="button" class="entry-count-badge" data-count-badge>+' + (entries.length - 1) + '</button>' : '';
      return '<span class="journal-cell-text">' + text + '</span>' + badge;
    }
    var SUMMARY_PAYLOAD = {
      students: [ { id: 'STU1', name: 'Zayd', track_haidh: 0 } ],
      sabaq: [ { student_id: 'STU1', sabaq_from: '2:1', sabaq_to: '2:5' }, { student_id: 'STU1', sabaq_from: '2:6', sabaq_to: '2:9' } ],
      sabaq_dhor: [], dhor: [], attendance: [],
    };
    function apiMaktabSummary(){ return Promise.resolve(SUMMARY_PAYLOAD); }
    function openMaktabHaidhCalendar(){ }
    var openedWith = null;
    function openMaktabDay(student, date){ openedWith = { student, date }; return Promise.resolve(); }
    function apiGetMaktabAttendance(){ return Promise.resolve({ isMaktabDay: true, attendance: {} }); }
    function wireCustomDateDisplay(){ }
    function iconHtml(name){ return '<svg></svg>'; }
  `);
  w.eval(summary);
  await w.renderMaktabSummaryScreen();
  const badge = w.document.querySelector('#maktabSummaryBody [data-entry-peek]');
  check('4: driven render — the +1 badge is present as a button', !!badge && badge.tagName === 'BUTTON');
  badge.dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
  check('4: driven — tapping the badge does NOT open the day view (the row handler never fires)', w.eval('openedWith') === null);
  check('4: driven — and DOES open the peek', !!w.document.getElementById('maktabEntryPeek'));
  check('4: driven — the peek lists every entry in the cell (2)', w.document.querySelectorAll('#maktabEntryPeek .maktab-entry-peek-row').length === 2);
  // click-away closes; the row still opens the day view
  w.document.body.dispatchEvent(new w.Event('click', { bubbles: true }));
  check('4: driven — clicking away closes the peek', !w.document.getElementById('maktabEntryPeek'));
  const cellText = w.document.querySelector('#maktabSummaryBody .journal-cell-text');
  cellText.dispatchEvent(new w.Event('click', { bubbles: true }));
  const o = w.eval('openedWith');
  check('4: driven — tapping the row (not the badge) still opens the day view', !!o && o.student.id === 'STU1');
}

// ---------- 6: the worker's real error is shown ----------
{
  // V3.76.0 (Phase 2) superseded the two haidh alerts this block used to
  // drive: the single-day toggle flow was deleted with them. The surviving
  // haidh error path is the calendar's own #haidhCalError, which has always
  // shown e.message verbatim — verify_v3760_phase2.mjs drives it in maktab
  // mode. What stays here is the summary load failure, which is unchanged.
  check('6: the deleted flow left no fixed-sentence alert behind', !/alert\('Could not/.test(day));
  check('6: the summary load failure carries the message', /Could not load the maktab summary: ' \+ \(\(loadErr && loadErr\.message\)/.test(summary));
  // and the summary: a rejecting API renders the message into the error row
  const dom2 = new JSDOM('<!DOCTYPE html><body><input id="maktabSummaryDatePicker"><table><tbody id="maktabSummaryBody"></tbody></table></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w2 = dom2.window;
  w2.eval(`
    function apiMaktabSummary(){ return Promise.reject(new Error('Unauthorized: teacher role required')); }
    function wireCustomDateDisplay(){ } function iconHtml(){ return ''; } function journalCellShorthand(){ return ''; }
    function apiGetMaktabAttendance(){ return Promise.resolve({}); } function maktabTodayISO(){ return '2026-08-26'; }
  `);
  w2.eval(summary);
  let threw = false;
  try { await w2.renderMaktabSummaryScreen(); } catch (e) { threw = true; }
  const txt = w2.document.getElementById('maktabSummaryBody').textContent;
  check('6: driven — summary load failure shows the worker\'s message, no throw', !threw && /Unauthorized: teacher role required/.test(txt), txt);
  check('6: driven — and a message containing markup renders as text', (() => {
    w2.eval("apiMaktabSummary = function(){ return Promise.reject(new Error('<b>x</b>')); }");
    return w2.renderMaktabSummaryScreen().then(() => w2.document.querySelector('#maktabSummaryBody b') === null
      && w2.document.getElementById('maktabSummaryBody').textContent.includes('<b>x</b>'));
  })());
}

// ---------- 10: teacher name in the History rail ----------
{
  check('10: the rail renders teacher_name when present', /r\.teacher_name \? `<div class="rail-card-teacher">\$\{railEscape\(r\.teacher_name\)\}<\/div>` : ''/.test(dhor));
  check('10: escaped — the name is free text', /function railEscape\(v\)\{/.test(dhor));
  check('10: styled', /\.rail-card-teacher \{/.test(dp));
  // Drive the REAL renderRecentEntries: one row with teacher_name (maktab
  // shape), one without (PJ shape). Only the first may show a name.
  const dom = new JSDOM('<!DOCTYPE html><body><div id="rail"></div></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var HISTORY_BTN_LABEL = { sabaq: 'History' };
    var EDIT_HANDLERS = {};
    function iconHtml(){ return ''; }
    function logClient(){ return { get: () => Promise.resolve([
      { id: 2, date: '2026-08-25', sabaq_from: '2:1', sabaq_to: '2:5', teacher_name: 'Ustadha <Maryam>' },
      { id: 1, date: '2026-08-24', sabaq_from: '1:1', sabaq_to: '1:7' },
    ]) }; }
  `);
  const start = dhor.indexOf('async function renderRecentEntries');
  const end = dhor.indexOf('\n}\n', dhor.indexOf('function describeEntryForRail')) + 3;
  w.eval(dhor.slice(start, end));
  await w.eval("renderRecentEntries('sabaq', 'rail', null)");
  w.document.getElementById('rail_historyBtn').click();
  const rows = [...w.document.querySelectorAll('.history-entry-row')];
  check('10: driven — the maktab-shaped row shows the teacher under the entry',
    rows.length === 2 && rows[0].querySelector('.rail-card-teacher') && rows[0].querySelector('.rail-card-teacher').textContent === 'Ustadha <Maryam>');
  check('10: driven — escaped, not injected', rows[0].querySelector('.rail-card-teacher').innerHTML.includes('&lt;Maryam&gt;'));
  check('10: driven — the PJ-shaped row shows none', rows[1].querySelector('.rail-card-teacher') === null);
}

// ---------- 11: spacing above the note box ----------
{
  check('11: .cb-note-box carries a margin-top', /\.cb-note-box \{[^}]*margin-top: var\(--space-md/.test(dp));
  check('11: the same token the PJ notes header uses, so both modes sit their notes at one height',
    /\.notes-header-row \{[^}]*margin-top: var\(--space-md\)/.test(dp));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
