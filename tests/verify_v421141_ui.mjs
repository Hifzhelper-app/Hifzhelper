#!/usr/bin/env node
// V4.2.14.1 — Quick Log mobile alignment + Quick Attendance actions.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const summary = read('js/maktabSummary.js');
const day = read('js/maktabDay.js');
const journalCss = read('css/journal-table.css');
const detailCss = read('css/detail-pages.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('Quick Log type selector stays in normal flow and has the common 42px control height',
  /\.maktab-quick-log-card \.maktab-quick-type-switch \{[\s\S]*position: static;[\s\S]*min-height: 42px/.test(journalCss)
  && /\.maktab-quick-log-card \.maktab-quick-type-switch button \{[\s\S]*height: 42px/.test(journalCss));

check('Dhor places Juz selector beside Juz Portion, then Portion number on its own row',
  /maktab-quick-dhor-primary-row/.test(summary)
  && /id="mql_dhor_juz"/.test(summary)
  && /id="mql_dhor_unit" aria-label="Juz portion"/.test(summary)
  && /maktab-quick-dhor-position-row/.test(summary)
  && /id="mql_dhor_position" aria-label="Portion number"/.test(summary));

check('Quick Log Juz, Juz Portion and Portion Number controls share the same height without absolute overlap',
  /\.maktab-quick-log-card \.maktab-quick-unit-pill,[\s\S]*\.maktab-quick-log-card \.maktab-quick-position-pill \{[\s\S]*position: static;[\s\S]*min-height: 42px/.test(journalCss)
  && /\.modal-card \.maktab-quick-dhor-primary-row select \{[\s\S]*height: 42px/.test(journalCss));

check('Confirm, Save and Detail are one action row at matching height',
  /\$\{maktabQuickConfirmControl\(\)\}[\s\S]*maktabQuickLogSave[\s\S]*maktabQuickLogDetails/.test(summary)
  && /\.maktab-quick-confirm-action \{[\s\S]*height: 42px/.test(journalCss)
  && /\.maktab-quick-actions \.maktab-quick-save \{[\s\S]*height: 42px/.test(journalCss)
  && /\.maktab-quick-details \{[\s\S]*min-height: 42px/.test(journalCss));

check('Maktab Summary attendance icon opens Quick Attendance and refreshes Summary after save',
  /maktabOpenQuickAttendance\(stu, date, \{ afterSave: \(\) => renderMaktabSummaryScreen\(\) \}\)/.test(summary)
  && /aria-label', 'Quick attendance for '/.test(summary));

check('Student Summary attendance icon opens the same Quick Attendance action on its context date',
  /studentSummaryAttendanceBtn/.test(day)
  && /maktabOpenQuickAttendance\(student, logCtxDate\(\)\)/.test(day));

check('Quick Attendance offers Present, Haidh and Absent plus Save and Detail',
  /data-mqa-status="present">Present<\/button>/.test(day)
  && /data-mqa-status="haidh">\$\{future \? 'Predict Haidh' : 'Haidh'\}<\/button>/.test(day)
  && /data-mqa-status="absent">\$\{future \? 'Plan absent' : 'Absent'\}<\/button>/.test(day)
  && /id="maktabQuickAttendanceSave">Save<\/button>/.test(day)
  && /id="maktabQuickAttendanceDetails">Detail<\/button>/.test(day));

check('Quick Attendance respects future prediction semantics and activity precedence',
  /state\.choice === 'haidh'\) status = state\.future \? 'predicted-haidh' : 'haidh'/.test(day)
  && /state\.choice === 'absent'\) status = state\.future \? 'predicted-absent' : 'absent'/.test(day)
  && /lockedByActivity: currentStatus === 'activity'/.test(day)
  && /Activity is already logged and takes precedence/.test(day));

check('Quick Attendance Detail preserves the route to the full Attendance page',
  /maktabQuickAttendanceDetails[\s\S]{0,500}openMaktabAttendancePage\(snapshot\.student, snapshot\.date\)/.test(day));

check('Attendance register H/h is about 25 percent smaller than V4.2.14',
  /mkregister-status-haidh-confirmed \{[^}]*font-size: 14px/.test(detailCss)
  && /mkregister-status-haidh-predicted \{[^}]*font-size: 14px/.test(detailCss));

check('V4.2.14.1 page and service-worker cache keys agree',
  [...html.matchAll(/\?v=([0-9.]+)/g)].every(m => m[1] === '4.2.14.1')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.1'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
