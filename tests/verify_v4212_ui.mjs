#!/usr/bin/env node
// V4.2.12 — Maktab Summary Quick Log trial.
// Static/structural pins only so this runs in the bare checkout without jsdom.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra='') => { if(cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const js = read('js/maktabSummary.js');
const css = read('css/journal-table.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('cell taps open Quick Log rather than navigating directly to a detail card',
  /td\.addEventListener\('click',[\s\S]{0,420}maktabOpenQuickLog/.test(js));
check('the +N entry peek remains a separate stop-propagating target',
  /peekBtn\.addEventListener\('click',[\s\S]{0,180}e\.stopPropagation\(\)/.test(js));
check('full detail cards remain reachable from the Quick Log sheet',
  /id="maktabQuickLogDetails"/.test(js) && /maktabQuickLogDetails[\s\S]{0,500}openMaktabDay/.test(js));

check('Sabaq and Sabaq Dhor expose only Ayah From / Ayah To range controls',
  /maktabQuickVerseField\('from', 'Ayah From'\)/.test(js)
  && /maktabQuickVerseField\('to', 'Ayah To'\)/.test(js)
  && !/maktab-quick-[\s\S]{0,200}tajweed/i.test(js));
check('Sabaq Quick Log posts the existing minimal maktab fields',
  /path = '\/maktab\/sabaq';[\s\S]{0,280}sabaq_from:[\s\S]{0,120}sabaq_to:/.test(js));
check('Sabaq Dhor Quick Log posts the existing minimal maktab fields',
  /path = '\/maktab\/sabaq-dhor';[\s\S]{0,320}from_surah:[\s\S]{0,180}to_ayah:/.test(js));

check('Dhor has Juz plus Quarter / Half / Juz controls',
  /id="mql_dhor_juz"/.test(js)
  && /data-unit="quarter"[^>]*>Quarter</.test(js)
  && /data-unit="half"[^>]*>Half</.test(js)
  && /data-unit="full"[^>]*>Juz</.test(js));
check('Dhor range uses the shared segment arithmetic and existing maktab endpoint',
  /segmentRangeForUnitIndex\(juz, position, state\.ref/.test(js)
  && /path = '\/maktab\/dhor'/.test(js));

check('one confirmation checkbox gates one Save action',
  /id="maktabQuickLogConfirm"/.test(js)
  && /id="maktabQuickLogSave">Save<\/button>/.test(js)
  && /Please confirm the selection before saving/.test(js));
check('existing logs are made visible before adding another',
  /Already logged/.test(js) && /maktabQuickExistingText\(type, entries\)/.test(js));
check('duplicate protection is preserved with the established abortable force flow',
  /result\.isDuplicate && !result\.id/.test(js)
  && /confirm\(`\$\{duplicateLabel\} has already been saved/.test(js)
  && /force: true/.test(js));
check('successful Quick Log refreshes the current summary/date instead of changing screens',
  /maktabCloseQuickLog\(\);\n\s*await renderMaktabSummaryScreen\(\);/.test(js));
check('Sabaq keeps its best-effort maktab position metadata sync after a quick save',
  /maktabQuickSyncSabaqPosition/.test(js)
  && /apiGetMaktabPosition\(studentId\)/.test(js)
  && /apiSaveMaktabPosition\(studentId/.test(js));

check('Quick Log has compact responsive sheet styling',
  /\.maktab-quick-log-card \{ max-width: 520px; \}/.test(css)
  && /@media \(max-width: 767px\)[\s\S]*\.maktab-quick-log-card/.test(css));
check('page/cache release key is 4.2.13',
  [...html.matchAll(/\?v=([0-9.]+)/g)].every(m => m[1] === '4.2.13.1')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.13\.1'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
