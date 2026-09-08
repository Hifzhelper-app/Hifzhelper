#!/usr/bin/env node
// V4.2.15.11 — mobile roster search + Quick Log selector ergonomics.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const summary = read('js/maktabSummary.js');
const css = read('css/journal-table.css');
const sw = read('js/sw.js');

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('release/cache keys are V4.2.15.11',
  /^<!-- Hifzhelper build 4\.2\.15\.11 \| index\.html -->/m.test(html)
  && versions.length > 0 && versions.every(v => v === '4.2.15.11')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.11'/.test(sw));

check('mobile student search sits directly below the Maktab date/actions row',
  /maktab-summary-toprow[\s\S]{0,1600}maktab-summary-mobile-search-row[\s\S]{0,500}id="maktabSummaryMobileSearch"[\s\S]{0,500}maktab-summary-headers/.test(html)
  && /@media \(max-width: 767px\)[\s\S]{0,3500}\.maktab-summary-mobile-search-row \{[\s\S]{0,80}display: block/.test(css));

check('mobile search filters rendered student rows rather than navigating away',
  /function maktabSummaryApplyMobileSearch\(\)/.test(summary)
  && /row\.classList\.toggle\('maktab-mobile-search-hidden', !show\)/.test(summary)
  && /tr\.dataset\.maktabStudentName = String\(stu\.name/.test(summary)
  && /#maktabSummaryBody tr\.maktab-mobile-search-hidden \{ display: none !important; \}/.test(css));

check('circle-plus graphic is about 20% smaller while action target containers remain unchanged',
  /\.maktab-mobile-log-icon \{ display: inline-flex; width: 38px; height: 38px;/.test(css)
  && /\.maktab-mobile-log-icon svg \{ width: 29px; height: 29px; \}/.test(css)
  && /width: 54px;[\s\S]{0,120}height: 54px/.test(css)
  && /\.maktab-mobile-log-icon svg \{ width: 42px; height: 42px; \}/.test(css));

check('Dhor Juz selector is a wider box consistently across viewports',
  /\.maktab-quick-dhor-primary-row \{[\s\S]{0,120}grid-template-columns: 128px minmax\(0, 1fr\)/.test(css)
  && /\.modal-card \.maktab-quick-dhor-primary-row select \{[\s\S]{0,260}border-radius: var\(--radius-sm\)/.test(css)
  && /@media \(max-width: 767px\)[\s\S]{0,1500}\.maktab-quick-dhor-primary-row \{ grid-template-columns: 128px minmax\(0, 1fr\); \}/.test(css));

check('large-screen Ayah number keeps only the custom chevrons',
  /@media \(min-width: 768px\)[\s\S]{0,700}input\[type=number\]::\-webkit-inner-spin-button[\s\S]{0,240}-webkit-appearance: none/.test(css)
  && /data-mql-step="\$\{side\}:1"/.test(summary)
  && /data-mql-step="\$\{side\}:-1"/.test(summary));

check('Ayah stepper is moved inward and given a larger reaction area on every screen',
  /\.maktab-quick-log-card \.maktab-quick-verse-field \{[\s\S]{0,180}grid-template-columns: 38px minmax\(0, 1fr\) minmax\(72px, 30%\) 52px/.test(css)
  && /\.verse-ref-ayah-stepper \{[\s\S]{0,120}justify-self: start;[\s\S]{0,80}width: 40px/.test(css)
  && /\.verse-ref-ayah-stepper button \{[\s\S]{0,100}width: 40px;[\s\S]{0,100}padding: 3px 8px/.test(css));

check('Quick Log Surah picker has search and displays each Surah Ayah count',
  /class="maktab-quick-surah-search"[^>]*placeholder="Search Surah"/.test(summary)
  && /SURAHS\.filter\(\(\[num, name\]\) => !q/.test(summary)
  && /maktab-quick-surah-ayah-count/.test(summary)
  && /\$\{maxAyahForSurah\(num\)\} ayahs/.test(summary));

check('last-edit headers are updated only on edited product files',
  /^\/\* Hifzhelper build 4\.2\.15\.11 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.11 \| css\/journal-table\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.15\.11 \| js\/sw\.js \*\//.test(sw)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(read('js/maktabDay.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
