// ============================================================
// verify_v3840_header_search.mjs — V3.84.0: the maktab summary search
// moves INTO the green Student header cell (user, 2026-08-28: no
// full-width bar — "make the green section of the header column the
// search"). Tap-to-reveal (Claude's settled choice, reported for veto):
// label until tapped; Esc / outside tap / picking a result restore it.
// V3.78.0 semantics untouched: a result opens her day view with the
// summary's picked date.
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
const src = read('js/maktabSummary.js');

// ---------- markup ----------
check('html: the full-width .maktab-search-row is GONE', !/maktab-search-row/.test(html));
{
  const cell = html.match(/<div class="journal-header-cell col-date maktab-search-cell"[\s\S]*?<\/div>\n\s*<div class="journal-header-cell col-log"/);
  check('html: the Student header cell hosts label + input + results, in the green col-date cell',
    cell && /id="maktabSummarySearchToggle">Student</.test(cell[0])
    && /<input type="search" id="maktabSummarySearch" class="hidden"/.test(cell[0])
    && /id="maktabSummarySearchResults"/.test(cell[0]));
}
{
  const css = read('css/detail-pages.css');
  check('css: the cell anchors the dropdown; the input is sized to the cell; old row rules retired',
    /\.maktab-search-cell \{ position: relative; \}/.test(css)
    && /\.maktab-search-cell input\[type="search"\] \{\n  width: 100%;/.test(css)
    && !/\.maktab-search-row \{ position: relative/.test(css));
}

// ---------- driven ----------
function dom() {
  const d = new JSDOM(`<!DOCTYPE html><body>
    <div class="journal-header-cell maktab-search-cell">
      <button type="button" id="maktabSummarySearchToggle">Student</button>
      <input type="search" id="maktabSummarySearch" class="hidden">
      <div id="maktabSummarySearchResults" class="hidden"></div>
    </div>
    <div id="outside">elsewhere</div>
    </body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = d.window;
  w.eval('var opened = []; function openMaktabDay(stu, date){ opened.push([stu.id, date]); }');
  const a = src.indexOf('let maktabSearchWired = false;');
  const b = src.indexOf('// V3.75.0 (item 4)');
  w.eval(src.slice(a, b));
  w.eval(`wireMaktabSummarySearch([{ id: 'S1', name: 'Umme Salamah' }, { id: 'S2', name: 'Zaynab' }], '2026-08-27')`);
  return w;
}

{ // reveal on tap, search, pick → day view + label restored
  const w = dom();
  const input = w.document.getElementById('maktabSummarySearch');
  const toggle = w.document.getElementById('maktabSummarySearchToggle');
  check('reveal: the cell starts as the label, input hidden', input.classList.contains('hidden') && !toggle.classList.contains('hidden'));
  toggle.click();
  check('reveal: tapping the label swaps in the input', !input.classList.contains('hidden') && toggle.classList.contains('hidden'));
  input.value = 'umm';
  input.dispatchEvent(new w.Event('input'));
  const results = w.document.getElementById('maktabSummarySearchResults');
  check('search: typing lists the match under the cell', !results.classList.contains('hidden') && /Umme Salamah/.test(results.textContent));
  results.querySelector('.maktab-search-result').click();
  check('pick: opens her day view with the summary\'s picked date', JSON.stringify(w.eval('opened')) === '[["S1","2026-08-27"]]');
  check('pick: the input clears AND the label comes back', input.value === '' && input.classList.contains('hidden') && !toggle.classList.contains('hidden'));
}
{ // Esc restores
  const w = dom();
  w.document.getElementById('maktabSummarySearchToggle').click();
  const input = w.document.getElementById('maktabSummarySearch');
  input.value = 'zay';
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  check('esc: clears the text and restores the label', input.value === '' && input.classList.contains('hidden'));
}
{ // outside tap restores
  const w = dom();
  w.document.getElementById('maktabSummarySearchToggle').click();
  w.document.getElementById('maktabSummarySearch').value = 'z';
  w.document.getElementById('outside').dispatchEvent(new w.Event('click', { bubbles: true }));
  check('outside: a tap anywhere else restores the label and closes results',
    w.document.getElementById('maktabSummarySearch').classList.contains('hidden')
    && w.document.getElementById('maktabSummarySearchResults').classList.contains('hidden'));
}
{ // a tap INSIDE the cell does not restore
  const w = dom();
  w.document.getElementById('maktabSummarySearchToggle').click();
  const input = w.document.getElementById('maktabSummarySearch');
  input.dispatchEvent(new w.Event('click', { bubbles: true }));
  check('inside: tapping the input itself leaves it open', !input.classList.contains('hidden'));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
