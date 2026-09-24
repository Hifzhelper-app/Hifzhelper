#!/usr/bin/env node
// V4.2.15.11 — Sabaq Dhor Quick Action fixed RHS checkbox track.
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

// Release identity and last-edit headers are checked centrally by verify_build_stamp.mjs.

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

// Release identity and last-edit headers are checked centrally by verify_build_stamp.mjs.

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
