#!/usr/bin/env node
// V4.2.15.10 — Sabaq Dhor Quick Action fixed RHS checkbox track.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const css = read('css/journal-table.css');
const sw = read('js/sw.js');
const components = read('css/components.css');
const summary = read('js/maktabSummary.js');

check('release cache/version is V4.2.15.10',
  /^<!-- Hifzhelper build 4\.2\.15\.10 \| index\.html -->/m.test(html)
  && /journal-table\.css\?v=4\.2\.15\.10/.test(html)
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.10'/.test(sw));

check('Sabaq Dhor quarter markup keeps pill and checkbox as siblings in one row',
  /<label class="maktab-quick-sd-row"[\s\S]{0,260}<span class="maktab-quick-sd-row-pill">[\s\S]{0,260}<input type="checkbox" class="mql-sd-row-cb"/.test(summary));

check('global modal quarter row overrides later generic modal label display block',
  /\.modal-card label\.maktab-quick-sd-row \{[\s\S]{0,220}display: grid;[\s\S]{0,180}grid-template-columns: minmax\(0, 1fr\) var\(--maktab-quick-sd-check-col\)/.test(css)
  && /\.modal-card label \{\s*display: block;/.test(components));

check('quarter pills cannot consume the checkbox track',
  /\.maktab-quick-sd-row-pill \{[\s\S]{0,120}width: 100%;[\s\S]{0,120}box-sizing: border-box;/.test(css));

check('quarter checkboxes are pinned to grid column 2',
  /\.modal-card \.maktab-quick-sd-row > input \{ grid-column: 2; \}/.test(css)
  && /justify-self: center;[\s\S]{0,80}align-self: center;/.test(css));

check('manual To checkbox uses the same fixed RHS grid track',
  /\.maktab-quick-sd-manual-line \{[\s\S]{0,180}grid-template-columns: minmax\(0, 1fr\) var\(--maktab-quick-sd-check-col\)/.test(css)
  && /\.maktab-quick-sd-manual-line > input \{ grid-column: 2; \}/.test(css)
  && /\.maktab-quick-sd-check-spacer \{[\s\S]{0,120}grid-column: 2;[\s\S]{0,80}justify-self: center;/.test(css));

check('mobile retains its proven compact 34px RHS checkbox track',
  /\.modal-card \.maktab-quick-sd-row \{[\s\S]{0,180}grid-template-columns: minmax\(0, 1fr\) 34px/.test(css)
  && /\.maktab-quick-sd-manual-line \{\s*grid-template-columns: minmax\(0, 1fr\) 34px/.test(css));

check('last-edit headers changed only on product files edited for V4.2.15.10',
  /^\/\* Hifzhelper build 4\.2\.15\.10 \| css\/journal-table\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.15\.10 \| js\/sw\.js \*\//.test(sw)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(read('js/maktabDay.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
