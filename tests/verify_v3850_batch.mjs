// ============================================================
// verify_v3850_batch.mjs — V3.85.0, items 2–4 of the user's batch
// (item 1, the standalone summary page, lives in the rewritten
// verify_v3820_student_summary.mjs).
//
//   2. Settings General to the user's schematic — label-left rows, ONE
//      Time Zone field (the lingering device-button bug gone), small
//      numeric inputs, save-status kept (a real crash the suite caught).
//   3. Attendance on a card — one card for the data, one for haidh; the
//      custom range as the user's sentence; an EMPTY period is named.
//   4. Notes history — one interleaved rail of notes + feedback per
//      card; both history buttons at the bottom below Notes; the dhor
//      Add-Juz/History swap.
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
const settingsSrc = read('js/maktabSettings.js');
const dhorSrc = read('js/dhorPage.js');

// ---------- item 2: the schematic ----------
check('settings: label-left rows exist for name, timezone, mushaf, and the two numerics',
  /class="mset-row mset-name-row"/.test(settingsSrc)
  && /class="mset-row-label">Time Zone</.test(settingsSrc)
  && /class="mset-row-label">Mushaf/.test(settingsSrc)
  && (settingsSrc.match(/mset-row mset-row-narrow/g) || []).length === 3);
check('settings: ONE timezone field; the old standing device button and toggle links are gone from the template',
  /id="mset_tz_field"/.test(settingsSrc) && !/mset_tz_other_toggle/.test(settingsSrc) && !/mset_tz_current/.test(settingsSrc));
check('settings: the save-status span survived the rebuild (its absence crashed Save)', /id="mset_status"/.test(settingsSrc));
check('settings: every stage action closes the chooser through one path', /const stage = \(v\) => \{\n\s*document\.getElementById\('mset_timezone'\)\.value = v;\n\s*chooser\.classList\.add\('hidden'\);/.test(settingsSrc));

// ---------- item 3: the attendance card ----------
check('attendance: the data block is a card and the haidh block is its own second card',
  /class="att-card att-block"/.test(html) && /id="attHaidhBlock" class="att-card"/.test(html));
check('attendance: the custom range reads as the user\'s sentence',
  /Choose a custom date range from<\/span>\s*<input type="date" id="attFrom"/.test(html)
  && />to<\/span>\s*<input type="date" id="attTo"/.test(html));
check('attendance: the worker names the threshold so the page can explain an empty period',
  /maktab_day_min: settings\.maktab_day_min,/.test(read('worker/src/maktabAttendance.js')));
check('attendance: an empty period is NAMED, with the threshold in the message',
  /No maktab days in this period \(fewer than \$\{d\.maktab_day_min \|\| '\?'\} students logged per day\)\./.test(read('js/haidhDetailScreen.js')));

// ---------- item 4: the button moves ----------
check('moves: no history rail rides any date row now', !/card-date-row"><input type="date" id="(sabaq|sabaqDhor|dhor)_date" class="card-header-date"><div class="history-container"/.test(html));
for (const t of ['sabaq', 'sabaqDhor', 'dhor']) {
  const cb = html.indexOf(`id="${t}CommentBlock"`);
  const bottom = html.indexOf('card-history-bottom', cb);
  const rail = html.indexOf(`id="${t}RecentRail"`, cb);
  const notesBtn = html.indexOf(`id="${t}NotesHistoryBtn"`, cb);
  check(`moves: ${t} — History + Notes history sit together BELOW the notes`,
    cb > 0 && bottom > cb && rail > bottom && notesBtn > rail && (notesBtn - cb) < 900);
}
{
  const dateRow = html.match(/<div class="card-date-row"><input type="date" id="dhor_date"[^\n]*/)[0];
  check('moves: the dhor swap — Plan/Add-Juz rides the date row; the old bottom Plan button is gone',
    /id="dhorViewPlanBtn"/.test(dateRow) && (html.match(/id="dhorViewPlanBtn"/g) || []).length === 1);
}

// ---------- item 4: notes history, driven ----------
{
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var ROWS = [
      { id: 3, date: '2026-08-26', student_comment: 'went well', teacher_feedback: null },
      { id: 2, date: '2026-08-25', student_comment: null, teacher_feedback: 'watch the madd', teacher_name: 'Ustadha A' },
      { id: 1, date: '2026-08-25', student_comment: 'struggled', teacher_feedback: 'good effort', teacher_name: 'Ustadha A' },
      { id: 0, date: '2026-08-20', student_comment: null, teacher_feedback: null },   // privacy-redacted / empty: contributes nothing
    ];
    function logClient(){ return { get(){ return Promise.resolve(ROWS); } }; }
    function railEscape(v){ return v == null ? '' : String(v); }
  `);
  const a = dhorSrc.indexOf('async function openNotesHistory');
  const b = dhorSrc.indexOf("['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {\n  const btn");
  w.eval(dhorSrc.slice(a, b));
  await w.eval("openNotesHistory('sabaq')");
  await new Promise(r => setTimeout(r, 0));
  const rows = [...w.document.querySelectorAll('.history-entry-row')];
  check('notes: one interleaved rail — 4 items (a row with note AND feedback yields two), date desc, redacted rows contribute nothing',
    rows.length === 4
    && /2026-08-26.*Note.*went well/.test(rows[0].textContent.replace(/\s+/g, ' '))
    && /Feedback.*watch the madd/.test(rows[1].textContent.replace(/\s+/g, ' ')));
  check('notes: a same-entry note + feedback sit adjacent, note first',
    /Note.*struggled/.test(rows[2].textContent.replace(/\s+/g, ' '))
    && /Feedback.*good effort/.test(rows[3].textContent.replace(/\s+/g, ' ')));
  check('notes: feedback rows carry the confirming teacher\'s name', /Ustadha A/.test(rows[1].textContent));
  check('notes: no edit affordance anywhere — this rail is read-only', !w.document.querySelector('.history-entry-edit-btn'));
  w.document.getElementById('notesHistoryCloseBtn').click();
  check('notes: close removes the modal', !w.document.querySelector('.modal-overlay'));
}
{ // empty state
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval("function logClient(){ return { get(){ return Promise.resolve([]); } }; } function railEscape(v){ return String(v||''); }");
  const a = dhorSrc.indexOf('async function openNotesHistory');
  const b = dhorSrc.indexOf("['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {\n  const btn");
  w.eval(dhorSrc.slice(a, b));
  await w.eval("openNotesHistory('dhor')");
  await new Promise(r => setTimeout(r, 0));
  check('notes: the empty state says so', /No notes or feedback yet\./.test(w.document.body.textContent));
}
check('notes: all three cards wire their button to the shared rail',
  /\['sabaq', 'sabaqDhor', 'dhor'\]\.forEach\(type => \{\n  const btn = document\.getElementById\(type \+ 'NotesHistoryBtn'\);/.test(dhorSrc));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
