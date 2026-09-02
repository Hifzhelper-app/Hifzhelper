// ============================================================
// V3.99.1 — the Lines/Pages recompute, DRIVEN.
//
// The bug this exists for: recomputeSabaqLineCount read a `profile`
// that is declared locally inside the render function, so every call
// threw ReferenceError and the Lines box silently never filled — for
// every user, on every path, through 1132 green checks. The suites
// pinned markup and wiring; nothing ever RAN the handler. This does.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

// the calculator itself, straight from the shared dataset
const dataSrc = read('shared/data.js');
const dom = new JSDOM(`<!doctype html><html><body>
  <input id="sabaq_from_ayah" value="183"><input id="sabaq_to_ayah" value="186">
  <input id="sabaq_line_count"><input id="sabaq_page_count" class="hidden">
  <div id="sabaqUnitPill"><button data-u="lines" class="on">Lines</button><button data-u="pages">Pages</button></div>
</body></html>`, { runScripts: 'outside-only' });
const w = dom.window;
w.eval(dataSrc);

// the module's own recompute, lifted verbatim so the drive tests the
// SHIPPED code path rather than a paraphrase of it
const src = read('js/sabaqPage.js');
const fn = src.match(/function recomputeSabaqLineCount\(\)\{[\s\S]*?\n\}/)[0];
check('source: the recompute no longer reaches for a locally-scoped `profile`',
  !/pageRefForMushaf\(profile/.test(fn) && /pageRefForMushaf\(sabaqMushaf\)/.test(fn));
check('source: the mushaf is hoisted to module scope and set where the render already had it',
  /^let sabaqMushaf = null;$/m.test(src) && /sabaqMushaf = profile && profile\.mushaf;/.test(src));

// NOTE (the V3.85.1 lesson, met again): `let` inside an indirect eval is
// scoped to THAT eval, so a later `w.eval('sabaqValue = ...')` would
// write a different binding than the function closed over — and the
// drive would silently test the wrong state. The setter lives in the
// same eval as the function, so both see one variable.
w.eval(`
  let sabaqMushaf = null;                       // as the module now declares it
  let sabaqValue = { from: { surah: 3, ayah: 183 }, to: { surah: 3, ayah: 186 } };
  function sabaqSyncUnitPill(){}                 // V3.93.0 view switch, not under test here
  function __setRange(v){ sabaqValue = v; }
  ${fn}
`);
w.eval('recomputeSabaqLineCount();');
const lines = w.document.getElementById('sabaq_line_count').value;
const pages = w.document.getElementById('sabaq_page_count').value;
check('drive: the recompute RUNS and fills the Lines box (3:183-186)', lines !== '' && Number(lines) > 0, `lines="${lines}"`);
check('drive: pages derive from the line count — /13, rounded DOWN to a quarter',
  pages !== '' && Number(pages) === Math.floor((Number(lines) / 13) * 4) / 4, `lines=${lines} pages=${pages}`);

// a cross-surah span must work too (the loop branch of getLinesForSpan)
w.eval('__setRange({ from: { surah: 2, ayah: 280 }, to: { surah: 3, ayah: 5 } }); recomputeSabaqLineCount();');
check('drive: a cross-surah range also computes', Number(w.document.getElementById('sabaq_line_count').value) > 0);

// and the guard still holds: an incomplete range writes nothing new
w.document.getElementById('sabaq_line_count').value = '';
w.eval('__setRange({ from: null, to: { surah: 3, ayah: 5 } }); recomputeSabaqLineCount();');
check('drive: an incomplete range leaves the box alone (the early return survives)',
  w.document.getElementById('sabaq_line_count').value === '');

// ============================================================
// V4.0.1 — the unit follows the AMOUNT, and pages follow the MUSHAF
// ============================================================
check('v401: lines-per-page comes from the mushaf (13-line vs both 15-line prints)',
  w.eval('linesPerPageForMushaf("13line")') === 13
  && w.eval('linesPerPageForMushaf("15line_madani")') === 15
  && w.eval('linesPerPageForMushaf("15line_indopak")') === 15
  && w.eval('linesPerPageForMushaf(null)') === 13);
check('v401: the hardcoded /13 is gone from the page derivation',
  !/lineCount \/ 13/.test(src) && /result\.lineCount \/ lpp/.test(src));

const syncFn = src.match(/function sabaqSyncUnitPill\(\)\{[\s\S]*?\n\}/)[0];
const showFn = src.match(/function sabaqUnitPillShow\(unit\)\{[\s\S]*?\n\}/)[0];
w.eval(`let __m = '13line'; function __setMushaf(v){ __m = v; }
  ${showFn.replace('sabaqMushaf', '__m')}
  ${syncFn.replace(/sabaqMushaf/g, '__m')}`);
const shown = () => w.document.getElementById('sabaq_page_count').classList.contains('hidden') ? 'lines' : 'pages';

w.document.getElementById('sabaq_line_count').value = '36';
w.eval('sabaqSyncUnitPill();');
check('v401: MORE than a page (36 lines, 13/page) shows PAGES', shown() === 'pages');
w.document.getElementById('sabaq_line_count').value = '13';
w.eval('sabaqSyncUnitPill();');
check('v401: exactly one page (13) still shows LINES — the rule is "more than"', shown() === 'lines');
w.document.getElementById('sabaq_line_count').value = '5';
w.eval('sabaqSyncUnitPill();');
check('v401: less than a page shows LINES', shown() === 'lines');
w.document.getElementById('sabaq_line_count').value = '14';
w.eval('__setMushaf("15line_madani"); sabaqSyncUnitPill();');
check('v401: the SAME 14 lines stays in lines on a 15-line mushaf — the threshold moves with the print', shown() === 'lines');
w.document.getElementById('sabaq_line_count').value = '16';
w.eval('sabaqSyncUnitPill();');
check('v401: 16 lines crosses the 15-line page and flips to pages', shown() === 'pages');
w.document.getElementById('sabaq_line_count').value = '';
w.eval('sabaqSyncUnitPill();');
check('v401: an empty box falls back to LINES rather than NaN', shown() === 'lines');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
