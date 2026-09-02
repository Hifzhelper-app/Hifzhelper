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
check('settings: label-left rows exist for name, timezone, mushaf, and the two numerics (V3.88.0: the Current term row is gone — terms live on the Calendar card)',
  /class="mset-row mset-name-row"/.test(settingsSrc)
  && /class="mset-row-label">Time Zone</.test(settingsSrc)
  && /class="mset-row-label">Mushaf/.test(settingsSrc)
  && (settingsSrc.match(/mset-row mset-row-narrow/g) || []).length === 3   // V3.98.0: + the teaching-day row
  && !/mset_term_from/.test(settingsSrc));
check('settings: ONE timezone field; the old standing device button and toggle links are gone from the template',
  /id="mset_tz_field"/.test(settingsSrc) && !/mset_tz_other_toggle/.test(settingsSrc) && !/mset_tz_current/.test(settingsSrc));
check('settings: the save-status span survived the rebuild (its absence crashed Save)', /id="mset_status"/.test(settingsSrc));
check('settings: every stage action closes the chooser through one path', /const stage = \(v\) => \{\n\s*document\.getElementById\('mset_timezone'\)\.value = v;\n\s*chooser\.classList\.add\('hidden'\);/.test(settingsSrc));

// ---------- item 3: the attendance card ----------
check('attendance: both blocks are cards, now width-capped (V4.0.0)',
  /class="att-card att-block screen-cap"/.test(html) && /id="attHaidhBlock" class="att-card screen-cap"/.test(html));
check('attendance: the range row comes FIRST and reads From … to … ✓ on one line (V4.0.0 — the "Calculate for another period" label is gone; the term dates are the pills\' values)',
  !/Calculate for another period/.test(html)
  && html.indexOf('id="attFrom"') < html.indexOf('id="attCardTitle"')
  && />From<\/span>\s*<input type="date" id="attFrom"/.test(html)
  && />to<\/span>\s*<input type="date" id="attTo"/.test(html));
check('attendance: the cards cap at 50% centered on larger screens (user, V3.85.2)',
  /@media \(min-width: 768px\) \{\n  \.att-card \{ width: 50%; margin-left: auto; margin-right: auto; \}/.test(read('css/detail-pages.css')));
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

// ---------- V3.86.0: the six-comment batch ----------
check('v3860: Apply is a small check beside the dates (id kept, wiring untouched)',
  /class="att-apply-check" id="attApply" aria-label="Apply range">&#10003;<\/button>/.test(read('index.html'))
  && /\.att-apply-check \{\n  flex: 0 0 34px;/.test(read('css/detail-pages.css')));
check('v3860: absent days is a green history-style button; the inline list is gone',
  /class="history-btn" id="attAbsentBtn"/.test(read('index.html')) && !/attAbsentList/.test(read('index.html')));
check('v3860: the haidh history button exists; the inline ranges block is gone',
  /class="history-btn hidden" id="attHaidhHistoryBtn">Haidh history</.test(read('index.html')) && !/attHaidhRanges/.test(read('index.html')));
check('v3860: both buttons open the shared read-only popup',
  /function attListPopup\(title, lines\)/.test(read('js/haidhDetailScreen.js'))
  && /attListPopup\('Absent days'/.test(read('js/haidhDetailScreen.js'))
  && /attListPopup\('Last haidh'/.test(read('js/haidhDetailScreen.js')));
check('v3860: history buttons are standard buttons, not pills (padding restored, no height:100%)',
  /\.history-btn \{\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  padding: 8px 14px;/.test(read('css/detail-pages.css')));
check('v3860: the tag/group add-rows — wide input, icon Add, ids kept',
  /id="mset_tag_new"[^\n]*\n\s*<button type="button" class="mset-add-btn" id="mset_tag_add"/.test(read('js/maktabSettings.js'))
  && /class="mset-add-btn" id="mset_group_add"/.test(read('js/maktabSettings.js'))
  && /\.mset-list-add input\[type="text"\] \{ flex: 1 1 auto;/.test(read('css/settings.css')));
check('v3860: SAVE sits on its own top row; the name row no longer holds it',
  /class="mset-save-row">\n      <button type="button" class="mset-save-btn" id="mset_save"/.test(read('js/maktabSettings.js'))
  && !/mset-name-row">\n      <span class="mset-row-label">Maktab Name<\/span>\n      <input[^\n]*\n      <button/.test(read('js/maktabSettings.js')));
check('v3860: wider inputs — the label column shrank to 28% (32% on phones)',
  /\.mset-row-label \{ flex: 0 0 28%;/.test(read('css/settings.css'))
  && /flex-basis: 32%;/.test(read('css/settings.css')));

// ---------- V3.90.0: the queued polish batch ----------
const dcss = read('css/detail-pages.css');
check('v3900/v3901: the date row breathes — margin below AND auto height so a tall pill can never spill over it; the calendar-info label rides its own line above',
  /height: auto;\n  min-height: var\(--dhor-row2-h\);\n  margin: var\(--space-sm\) 0 var\(--space-md\);/.test(dcss)
  && /\.card-date-row \.card-header-date \{ height: var\(--dhor-row2-h\); \}/.test(dcss)
  && /\.card-date-row \.card-date-info \{ grid-column: 1 \/ -1; order: -1;/.test(dcss));
check('v3901: the dhor From and To selects share one height rule', /#dhor_juz,\n#dhor_juz_to \{/.test(dcss));
check('v3900: the pill-selector trial rides the ONE shared class', /\.verse-ref-field \{ border-radius: 999px; \}/.test(dcss));
check('v3900: air between notes and the history buttons', /\.card-history-bottom \{ margin-top: var\(--space-md\); \}/.test(dcss)
  && /#sabaqCommentBlock, #sabaqDhorCommentBlock, #dhorCommentBlock \{ margin-top: var\(--space-md\); \}/.test(dcss));
check('v3900: dhor From/To labels above the selector boxes',
  /class="dhor-sel-label">From<\/label><select id="dhor_juz"/.test(read('index.html'))
  && /class="dhor-sel-label">To<\/label><select id="dhor_juz_to"/.test(read('index.html')));
check('v3900: the maktab summary toprow aligns to the table width on wide screens',
  /\.screen-top-close-row\.maktab-summary-toprow \{ width: 70%; margin-left: auto; margin-right: auto; \}/.test(read('css/journal-table.css')));
check('v3900: terms — quiet name, pill dates, air',
  /\.mset-term-row \.mset-term-name:focus \{ border-color/.test(read('css/settings.css'))
  && /\.mset-term-row \.mset-term-dates input\[type="date"\] \{\n  border: none; background/.test(read('css/settings.css')));

// ---------- V3.91.0: the second queued batch ----------
const jcss = read('css/journal-table.css');
check('v3910: the header row no longer clips — corners round on the cells; the dropdown stacks above the table',
  !/border-radius: var\(--radius-md\) var\(--radius-md\) 0 0;\n  overflow: hidden;/.test(jcss)
  && /\.journal-header-cell:first-child \{ border-top-left-radius/.test(jcss)
  && /z-index: 60;/.test(read('css/detail-pages.css')));
check('v3910: the magnifier rides the LEFT of Student', /\.maktab-search-cell-label::before \{/.test(read('css/detail-pages.css'))
  && !/\.maktab-search-cell-label::after \{/.test(read('css/detail-pages.css')));
check('v3910/v3990: the calendar page header is now the shared header CARD (icon, title, close X); compact month nav',
  /<div class="juz-tracker-header-row screen-cap">\s*<span class="card-header-icon" id="mcalHeaderIcon"><\/span>\s*<h2>Maktab Calendar<\/h2>/.test(read('index.html'))
  && /id="mcalCloseBtn"/.test(read('index.html'))
  && /\.mcal-month-row \.secondary \{ width: auto; flex: 0 0 auto;/.test(read('css/detail-pages.css'))
  && /#mcalMonthLabel \{ flex: 1 1 auto; text-align: center; white-space: nowrap; \}/.test(read('css/detail-pages.css')));
check('v3910: the selector family wears the palette blue', /\.verse-ref-field \{ background: var\(--color-accent-soft/.test(read('css/detail-pages.css'))
  && /#dhor_juz, #dhor_juz_to \{ background: var\(--color-accent-soft/.test(read('css/detail-pages.css'))
  && /\.sabaq-dhor-row \{ background: var\(--color-accent-soft/.test(read('css/detail-pages.css')));
check('v3910: the scribbles — heading reads "Sabaq Dhor"; Plan rides the far right',
  /sabaq-dhor-group-label">Sabaq Dhor</.test(read('index.html'))
  && /\.card-date-row #dhorViewPlanBtn \{ justify-self: end; \}/.test(read('css/detail-pages.css')));

// ---------- V3.93.0: the day-card set + the setup popup ----------
const dcss2 = read('css/detail-pages.css');
const ihtml = read('index.html');
check('v3930: the search CELL is visible (the second clipper — pinned as a rule, jsdom cannot see pixels)',
  /\.journal-header-cell\.maktab-search-cell \{ overflow: visible; \}/.test(read('css/journal-table.css')));
check('v3930: the Calendar card content centres', /#msetCardCalendar \.mset-cal-head \{ justify-content: center; \}/.test(read('css/settings.css')));
check('v3930: the timer is boxed with space before it', /\.card-header-timer-btn \{\n  margin-left: var\(--space-md\);\n  border: 1\.5px solid/.test(dcss2));
check('v3930: ONE Lines\/Pages box with the unit pill inside; Tajweed beside it; both inputs keep their ids',
  /<label>Lines\/Pages<\/label>/.test(ihtml)
  && /id="sabaqUnitPill"/.test(ihtml)
  && /id="sabaq_page_count" class="hidden"/.test(ihtml)
  && /Lines\/Pages<\/label>[\s\S]{0,900}?<div><label>Tajweed<\/label><div id="sabaqTajweedPicker"><\/div><\/div>/.test(ihtml)
  && /function sabaqSyncUnitPill\(\)/.test(read('js/sabaqPage.js')));
check('v3930: Duration\/Mistakes\/Tajweed ride one row; the ss box is gone everywhere',
  /dhor-triple-row/.test(ihtml)
  && !/dhor_duration_sec/.test(ihtml) && !/dhor_duration_sec/.test(read('js/dhorPage.js'))
  && /return mins \* 60;/.test(read('js/dhorPage.js')));
check('v3930: the position switch rides the juz line; the suggestion rows are pills',
  /#dhorJuzPositionRow \{ flex-wrap: nowrap;/.test(dcss2)
  && /\.sabaq-dhor-row \{ border-radius: 999px; \}/.test(dcss2));
check('v3930: history symmetry — matched min-width, centred', /\.card-history-bottom \.history-btn[^{]*\{\n  min-width: 150px; justify-content: center;/.test(dcss2));
check('v3930: the setup popup — no paragraph, save ICON head, 3\u00d710 selectable chips',
  !/Tick every juz/.test(read('js/maktabSetup.js'))
  && /maktab-setup-head/.test(read('js/maktabSetup.js'))
  && /id="maktabSetupSaveIcon"/.test(read('js/maktabSetup.js'))
  && /\.maktab-setup-grid \{ display: grid; grid-template-columns: repeat\(3, 1fr\);/.test(dcss2)
  && /\.maktab-setup-juz:has\(input:checked\)/.test(dcss2));

// ---------- V3.94.0 pins ----------
const dcss3 = read('css/detail-pages.css');
check('v3940: the setup popup — title, X in the LEFT corner, smaller centred pills',
  /class="maktab-setup-title">Ajzaa completed</.test(read('js/maktabSetup.js'))
  && /\.maktab-setup-card \.maktab-setup-close \{ left: var\(--space-md\); right: auto; \}/.test(dcss3)
  && /\.maktab-setup-juz \{ padding: 8px 5px; font-size: 13px; text-align: center; \}/.test(dcss3));
check('v3940/v3961: the pill lands on the element that carries the border (sabaq-dhor-row-text); the switch honours its OWN contract — equal flex slots, one width, NO forced height (both debris rules gone)',
  /\.sabaq-dhor-row-wrap \.sabaq-dhor-row-text \{\n  border-radius: 999px;/.test(dcss3)
  && /#dhorPositionField \.switch-track \{ width: 140px; \}/.test(dcss3)
  && /#dhor_position_switch \.switch-option \{ flex: 1 1 0;/.test(dcss3)
  && !/switch-track \{ width: 84px/.test(dcss3));
check('v3940/v3950: triple-row labels share one line; the history pair SPREADS end-to-end (the boxed mock superseded the flex-end arrows); placeholder reads Select tags',
  /\.dhor-triple-row \{ align-items: flex-start; \}/.test(dcss3)
  && /\.card-history-bottom \{ justify-content: space-between; \}/.test(dcss3)
  && !/justify-content: flex-end; \}\n\/\* 41e/.test(dcss3)
  && /: 'Select tags';/.test(read('js/tajweed.js')));
check('v3950: the Hijri rides UNDER the name box (name+hijri share a column); Calendar wears its border; the space set landed',
  /class="mset-cal-namecol"/.test(read('js/maktabSettings.js'))
  && /\.mset-cal-namecol \{ display: flex; flex-direction: column;/.test(read('css/settings.css'))
  && /#msetCardCalendar \{ border: 1\.5px solid var\(--color-table-border\);/.test(read('css/settings.css'))
  && /#sabaqCommentBlock, #sabaqDhorCommentBlock, #dhorCommentBlock \{ margin-top: var\(--space-lg, 24px\); \}/.test(dcss3)
  && /\.card-history-bottom \{ margin-top: var\(--space-lg, 24px\); \}/.test(dcss3));
check('v3950/v3961: the row bottom-aligns (the switch stands level with the select, not in the label gap); the triple boxes stay equal',
  /#dhorJuzPositionRow \{ flex-wrap: nowrap; align-items: flex-end; \}/.test(dcss3)
  && /\.dhor-triple-row input,\n\.dhor-triple-row \.tajweed-trigger-btn \{ height: var\(--dhor-row2-h\); box-sizing: border-box; \}/.test(dcss3));
check('v3950: Notes History capitalised on all three cards', (read('index.html').match(/>Notes History</g) || []).length === 3);
check('v3940: Calendar is a header, Terms label gone, bigger +, content down a notch',
  /\.mset-cal-head \.mset-list-label \{ font-size: 18px; font-weight: 700; \}/.test(read('css/settings.css'))
  && !/mset-list-label">Terms</.test(read('js/maktabSettings.js'))
  && /#msetCardCalendar \.mset-add-btn \{ padding: 8px 20px; font-size: 18px;/.test(read('css/settings.css'))
  && /#msetCardCalendar \{ padding-top: var\(--space-lg, 22px\); \}/.test(read('css/settings.css')));

// ---------- V3.96.0: the Haidh settings tweaks (the V3.51.2 trap honoured) ----------
check('v3960: heading text first, checkbox to its RIGHT at 2x; Ruling label and hint element GONE from the markup',
  /<h2>Haaidha<\/h2>\n            <input type="checkbox" id="haaidha_checkbox">/.test(read('index.html'))
  && !/haidh-ruling-label/.test(read('index.html'))
  && !/haidhRulingHint/.test(read('index.html'))
  && /\.haidh-heading-check input\[type="checkbox"\] \{ width: 32px; height: 32px;/.test(read('css/settings.css')));
check('v3960: the hint writers and constant died WITH the element (the V3.51.2 trap) — the ruling machinery all KEPT',
  !/haidhRulingHint/.test(read('js/settingsScreen.js'))
  && !/HAIDH_RULING_HINTS/.test(read('js/settingsScreen.js'))
  && /setupSelectedRuling = value;/.test(read('js/settingsScreen.js'))
  && /haidhOfficialMaxDuration\(setupSelectedRuling\)/.test(read('js/settingsScreen.js'))
  && /haidh_ruling: setupSelectedRuling/.test(read('js/settingsScreen.js')));

// ---------- V3.97.1: the API base auto-select (the dev-stream seam) ----------
const apiSrc = read('js/api.js');
check('v3971: the API base is an auto-select — override first, dev by hostname, production the default',
  /const API_BASE = \(\(\) => \{/.test(apiSrc)
  && /localStorage\.getItem\('hh_api_base'\)/.test(apiSrc)
  && /h\.includes\('-dev'\) \|\| h === 'localhost'/.test(apiSrc)
  && /return 'https:\/\/hifzhelper-api-dev\.hifzhelper-app\.workers\.dev';/.test(apiSrc)
  && apiSrc.indexOf("hifzhelper-api-dev") < apiSrc.indexOf("return 'https://hifzhelper-api.hifzhelper-app.workers.dev';"));

// ---------- V3.98.0: the Attendance screen's wiring ----------
check('v3980: teaching days — the setting, the chips, and the Save payload',
  /ALTER TABLE maktab_settings ADD COLUMN teaching_days TEXT;/.test(read('worker/migrations/0029_teaching_days_and_predicted_absent.sql'))
  && /teaching_days = \?/.test(read('worker/src/maktabSettings.js'))
  && /id="mset_teaching_days"/.test(read('js/maktabSettings.js'))
  && /teaching_days: msetTeachingDays\.slice\(\)/.test(read('js/maktabSettings.js')));
check('v3980: predicted-absent is admitted by the CHECK rebuild and the validator',
  /'present','absent','haidh','predicted-haidh','predicted-absent'/.test(read('worker/migrations/0029_teaching_days_and_predicted_absent.sql'))
  && /'predicted-absent'\]\.includes\(body\.status\)/.test(read('worker/src/utils.js')));
check('v3980: the screen is registered, routed, and reached under the SAME label by role',
  /id="screen-maktabAttendance"/.test(read('index.html'))
  && /maktabAttendance: true/.test(read('js/app.js'))
  && /if\(id === 'maktabAttendance'\) await renderMaktabAttendanceScreen\(\);/.test(read('js/app.js'))
  && /if\(isTeachingProfile\(\)\) g3\.push\(MAKTAB_ATTENDANCE_NAV_ITEM\);/.test(read('js/auth.js'))
  && /MAKTAB_ATTENDANCE_NAV_ITEM = \{ id: 'maktabAttendance', label: 'Attendance'/.test(read('js/auth.js')));
check('v3980/v422: the teacher\'s marking writes through the EXISTING teacher paths — the single-student popup became the REGISTER SHEET in V4.2.2',
  /apiSetAttendanceFor\(id, date, status\)/.test(read('js/maktabAttendancePage.js'))
  && /apiClearAttendanceFor\(id, date\)/.test(read('js/maktabAttendancePage.js'))
  && /'predicted-absent'/.test(read('js/maktabAttendancePage.js')));
check('v422: the register sheet ADAPTS to the day — Absent is offered only ahead of today; a past day offers haidh + clear and shows the derived state',
  /\$\{past \? '' : '<button type="button" class="mkreg-btn" data-set="absent">Absent<\/button>'\}/.test(read('js/maktabAttendancePage.js'))
  && /const status = what === 'haidh' \? \(past \? 'haidh' : 'predicted-haidh'\) : 'predicted-absent';/.test(read('js/maktabAttendancePage.js'))
  && /class="mkreg-state">\$\{STATE_TEXT\[stateOf\(s\.name\)\] \|\| ''\}/.test(read('js/maktabAttendancePage.js')));

check('v3981: Calendar carries its OWN icon; the check-calendar is left to the two Attendance items',
  /calendar: '<svg viewBox="0 0 24 24"[^']*M8 13h\.01/.test(read('js/icons.js'))
  && /MAKTAB_CALENDAR_NAV_ITEM = \{ id: 'maktabCalendar', label: 'Calendar', icon: 'calendar' \}/.test(read('js/auth.js'))
  && /ATTENDANCE_NAV_ITEM = \{ id: 'attendancePage', label: 'Attendance', icon: 'attendance' \}/.test(read('js/auth.js'))
  && /MAKTAB_ATTENDANCE_NAV_ITEM = \{ id: 'maktabAttendance', label: 'Attendance', icon: 'attendance' \}/.test(read('js/auth.js')));

// ---------- V3.99.0 ----------
check('v3990: Attendance and Calendar carry the same header card as the puzzle, icons wired',
  /id="mkweekHeaderIcon"/.test(read('index.html')) && /id="mkweekCloseBtn"/.test(read('index.html'))
  && /mkIcon\.innerHTML = iconHtml\('attendance'\)/.test(read('js/app.js'))
  && /mcIcon\.innerHTML = iconHtml\('calendar'\)/.test(read('js/app.js')));
check('v3990: ONE shared width cap covers all three wide screens',
  /\.screen-cap \{ max-width: 1100px; margin-left: auto; margin-right: auto; \}/.test(read('css/detail-pages.css'))
  && (read('index.html').match(/screen-cap/g) || []).length >= 6);
check('v3990: air between the header card and the content on both maktab screens',
  /#screen-maktabAttendance \.juz-tracker-header-row,\n#screen-maktabCalendar \.juz-tracker-header-row \{ margin-bottom: var\(--space-lg, 24px\); \}/.test(read('css/detail-pages.css')));
check('v3990: the puzzle is "Kaaba puzzle" for teaching profiles only — label AND heading',
  /return isTeachingProfile\(\) \? 'Kaaba puzzle' : 'Juz Tracker';/.test(read('js/auth.js'))
  && /label: juzTrackerLabel\(\)/.test(read('js/auth.js'))
  && /heading\.textContent = juzTrackerLabel\(\)/.test(read('js/juzTrackerScreen.js')));

// ---------- V4.0.0: the student Attendance page ----------
check('v400: the shared header card and the width cap',
  /<div class="juz-tracker-header-row screen-cap">\s*<span class="card-header-icon" id="attendanceHeaderIcon">/.test(html));
check('v400: the date row holds on ONE line (no wrap) with pill inputs that shrink',
  /\.att-custom-row \{ display: flex; flex-wrap: nowrap;/.test(read('css/detail-pages.css'))
  && /\.att-custom-row input\[type="date"\] \{\n  flex: 1 1 0; min-width: 0;/.test(read('css/detail-pages.css')));
check('v400: Days absent sits on its own line beneath the sentence',
  html.indexOf('id="attSentence"') < html.indexOf('att-absent-row')
  && /<div class="att-absent-row">\s*<button type="button" class="history-btn" id="attAbsentBtn">/.test(html));
check('v400: the selection is a full-width band (count left, bare X right); the actions sit centred BELOW the calendar',
  /id="haidhRangeBar">\s*<span id="haidhRangeBarText"><\/span>\s*<button type="button" class="haidh-range-cancel-btn"[^>]*>&times;/.test(html)
  && /<div class="haidh-range-actions hidden" id="haidhRangeActions">/.test(html)
  && /\.haidh-range-actions \{ display: flex; justify-content: center;/.test(read('css/detail-pages.css'))
  && /#attHaidhBlock \.haidh-range-bar \{\n  display: flex; align-items: center; justify-content: space-between;/.test(read('css/detail-pages.css')));
check('v400: "Mark absent" is maktab-only and future-only, and routes through the context client — never excusing',
  /id="haidhRangeAbsentBtn">Mark absent<\/button>/.test(html)
  && /absentBtn\.classList\.toggle\('hidden', !maktabCtx \|\| haidhRangeTouchesPastOrToday\(bounds\)\)/.test(read('js/haidhDetailScreen.js'))
  && /client\.setDay\(d, 'predicted-absent'\)/.test(read('js/haidhDetailScreen.js'))
  && !/setDay:.*apiSetAttendance\(/.test(read('js/haidhDetailScreen.js')));

check('v402: the student summary wires its +N pill like the maktab summary — retargeted badge, own listener, stopPropagation',
  /data-entry-peek="\$\{type\}"/.test(read('js/maktabDay.js'))
  && /td\._peekEntries = days\[date\]\[type\];/.test(read('js/maktabDay.js'))
  && /e\.stopPropagation\(\);\s*\n\s*maktabOpenEntryPeek\(peekBtn, type, td\._peekEntries\);/.test(read('js/maktabDay.js')));
check('v402: the derivation takes today and explicit absents; today falls through unresolved',
  /if \(todayISO && date >= todayISO\) continue;/.test(read('worker/src/maktabAttendance.js'))
  && /explicitAbsent\.has\(date\)/.test(read('worker/src/maktabAttendance.js'))
  && (read('worker/src/maktabAttendance.js').match(/today, absent/g) || []).length >= 2);

// ---------- V4.1.0: the admin table, inline editing ----------
{
  const adminSrc = read('js/adminPage.js');
  check('v410/v421: every column has its header cell; the Teacher-profile column is GONE (user: the Role select promotes directly)',
    /<th class="admin-th-id">Unique ID<\/th>/.test(adminSrc)
    && ['Name', 'WhatsApp', 'Role', 'Group', 'Status'].every(h => adminSrc.includes(`<th>${h}</th>`))
    && /<th class="admin-th-actions">Actions<\/th>/.test(adminSrc)
    && !/Teacher profile/.test(adminSrc) && !/data-create-teaching/.test(adminSrc));
  check('v410: existing rows AUTOSAVE per field — no Save control anywhere in the table',
    /async function adminSaveField\(user, fields, describe\)/.test(adminSrc)
    && /nameEl\.addEventListener\('change'/.test(adminSrc)
    && /waEl\.addEventListener\('change'/.test(adminSrc)
    && /groupEl\.addEventListener\('change'/.test(adminSrc)
    && !/data-save-row|admin-save-btn/.test(adminSrc));
  check('v410: the create path keeps its explicit commit and its duplicate-name guard',
    /adminShowAddRow\(true\)/.test(adminSrc)
    && /function cancelAdminMatch\(\)/.test(adminSrc)
    && /attemptAdminRegister/.test(adminSrc));
  check('v410/v421: NOTHING the user kept was dropped — copy, share, reset PIN, delete-with-confirm, role confirm, inactive confirm (teaching-profile creation RETIRED by the user in V4.2.1)',
    /data-copy-url/.test(adminSrc) && /data-share-url/.test(adminSrc)
    && /apiAdminResetPin/.test(adminSrc) && /apiAdminDeleteUser/.test(adminSrc)
    && /Delete \$\{u\.id\} \(\$\{u\.name\}\) permanently\?/.test(adminSrc)
    && /Change \$\{u\.id\}'s role to/.test(adminSrc)
    && /Mark \$\{u\.id\} inactive\?/.test(adminSrc)
    && !/apiAdminCreateTeachingProfile\(/.test(adminSrc));
  check('v410: mobile gets a SECOND row carrying every action; desktop hides it',
    /admin-row-actions/.test(adminSrc)
    && /\.admin-row-actions \{ display: none; \}/.test(read('css/admin.css'))
    && /@media \(max-width: 767px\)[\s\S]*\.admin-row-actions \{ display: block; \}/.test(read('css/admin.css')));
  check('v410/v421: the table wears the APP palette (sage id column, mauve header); header and body share ONE width and ONE colgroup',
    /\.admin-table-head thead th \{\n  background: var\(--color-table-header-log\);/.test(read('css/admin.css'))
    && /admin-th-id \{ background: var\(--color-table-header-date\);/.test(read('css/admin.css'))
    && /\.admin-toolbar, \.admin-table-head, \.admin-wrap, \.admin-status-line \{ width: 80%; margin-left: auto; margin-right: auto; \}/.test(read('css/admin.css'))
    && (adminSrc.match(/\$\{ADMIN_COLGROUP\}/g) || []).length === 2
    && !/adminRegisterBox/.test(read('index.html')));
}

check('v411: closing lands a teaching profile on the maktab summary, a student on Home',
  /function homeScreenFor\(\)\{\n  return \(typeof isTeachingProfile === 'function' && isTeachingProfile\(\)\) \? 'maktabSummary' : 'home';/.test(read('js/app.js'))
  && /btn\.addEventListener\('click', \(\) => showScreen\(homeScreenFor\(\)\)\);/.test(read('js/app.js'))
  && /logDetailClose'\)\.addEventListener\('click', \(\) => showScreen\(typeof homeScreenFor === 'function' \? homeScreenFor\(\) : 'home'\)\)/.test(read('js/logDetailScreen.js')));
check('v411: the menu\'s HOME button still goes HOME — the V3.74.1 lesson kept',
  /showScreen\('home'\);/.test(read('js/auth.js')));

check('v420/v428: the maktab summary\'s student names are light-blue pills; V4.2.8 makes every pill the same cell width and ellipsises long names',
  /nameSpan\.className = 'maktab-name-pill';/.test(read('js/maktabSummary.js'))
  && /nameSpan\.title = stu\.name;/.test(read('js/maktabSummary.js'))
  && /\.maktab-student-name \.maktab-name-pill \{\n  display: block;\n  width: 100%;[\s\S]*text-overflow: ellipsis;[\s\S]*background: var\(--color-accent-soft/.test(read('css/journal-table.css')));
check('v420/v421: the admin table has the summary\'s two-part shape — a header table over a white scrolling body table',
  /<table class="admin-table admin-table-head">/.test(read('js/adminPage.js'))
  && /<div class="admin-wrap"><table class="admin-table admin-table-body">/.test(read('js/adminPage.js'))
  && /\.admin-wrap \{\n  background: var\(--color-surface\);/.test(read('css/admin.css')));

// ---------- V4.2.2: the mobile pass ----------
check('v422: the maktab summary becomes one CARD PER STUDENT on mobile, in CSS over the existing rows — so every tap target survives',
  /@media \(max-width: 767px\) \{\n  \.maktab-summary-headers \{ display: none; \}/.test(read('css/journal-table.css'))
  && /\.maktab-summary-table \.journal-cell::before \{\n    content: attr\(data-label\);/.test(read('css/journal-table.css'))
  && /td\.setAttribute\('data-label', CELL_LABEL\[type\]\);/.test(read('js/maktabSummary.js')));
check('v422: the summary sheds its grey panel — SCOPED to that screen, the app-wide V3.44 rule untouched',
  /#screen-maktabSummary \{ background: none;/.test(read('css/detail-pages.css'))
  && /\.screen \{\n  background: var\(--surface-track\);/.test(read('css/base.css')));
check('v422: the attendance week shows ONE DAY PER SCREEN on mobile, swiped by snap',
  /\.mkweek-cols \{\n    display: flex; flex-wrap: nowrap;\n    overflow-x: auto; scroll-snap-type: x mandatory;/.test(read('css/detail-pages.css'))
  && /\.mkweek-col \{ flex: 0 0 100%; scroll-snap-align: center; \}/.test(read('css/detail-pages.css')));
check('v422: the student attendance page titles ABOVE the card; the card carries only her name, one line',
  /<div class="att-page-title screen-cap">Attendance<\/div>/.test(read('index.html'))
  && /textContent = inMaktab \? logCtxStudentName\(\) : 'Mine';/.test(read('js/haidhDetailScreen.js'))
  && /#screen-attendancePage \.juz-tracker-header-row h2 \{\n  font-size: 17px;\n  white-space: nowrap;/.test(read('css/detail-pages.css')));
check('v429: admin mobile is a four-row CARD: name heading / id+WhatsApp / role+group+status / actions',
  /'name name name name name name'\n      'id id id wa wa wa'\n      'role role group group status status'/.test(read('css/admin.css'))
  && /td\[data-label="Name"\]::before \{ display: none; \}/.test(read('css/admin.css'))
  && /\.admin-row-fields td::before \{[\s\S]{0,80}content: attr\(data-label\);/.test(read('css/admin.css')));

// V4.2.3: a live context for the shared dataset, so the picker's numbers
// are asserted rather than assumed
import vm from 'vm';
const dataCtx = {};
vm.createContext(dataCtx);
vm.runInContext(read('shared/data.js'), dataCtx);

// ---------- V4.2.3: the Sabaq Dhor juz + quarter picker ----------
{
  const sdSrc = read('js/sabaqDhorPage.js');
  check('v424: the picker IS the rows block\'s empty state — rendered only when there are no rows, and NOT a child of the flex row (the V4.2.3 defect: a third flex sibling stole the sections list\'s width)',
    /sabaqDhorRows\.length === 0\n    \? sabaqDhorQuarterPickerHtml\(\)/.test(sdSrc)
    && !/sabaqDhorQuarterPicker/.test(read('index.html'))
    && /id="sabaqDhorManual_from_ayah"/.test(sdSrc)
    && /\.sdq-picker \{ grid-column: 1(?: \/ -1)?; min-width: 0;/.test(read('css/detail-pages.css')));
  check('v428: the picker is a real composite source — its checkbox contributes the selected structural quarter without changing storage shape',
    /const sdqConfirm = document\.getElementById\('sdq_confirm'\);/.test(sdSrc)
    && /const picked = sdqConfirm && sdqConfirm\.checked \? sdqBounds\(\) : null;/.test(sdSrc)
    && /fromSurah: picked\.startSurah/.test(sdSrc));
  check('v423: the conversion reuses the app\'s own proven helper, not a second copy',
    /structuralQuarterBounds\(juz, q, sdqRef\(\)\)/.test(sdSrc)
    // scoped to the picker's own code: the file mentions RUB_BOUNDARIES in
    // a pre-existing COMMENT, which a blanket negative wrongly caught
    && !/RUB_BOUNDARIES\s*\[|QUARTER_BOUNDARIES\w*\s*\[/.test(sdSrc));
  check('v423/v428: the unit WORD follows her mushaf as the field label; the position itself is the Dhor-style 1|2|3|4 switch',
    /quarterUnitWord\(sdqRef\(\)\)/.test(sdSrc)
    && /<label class="dhor-sel-label">\$\{word\}<\/label>/.test(sdSrc)
    && /id="sdq_quarter_switch"/.test(sdSrc)
    && /Array\.from\(\{ length: 4 \}/.test(sdSrc));
  // the numbers themselves, both prints
  const wq11 = dataCtx.structuralQuarterBounds(1, 1, 'waterval');
  const uq11 = dataCtx.structuralQuarterBounds(1, 1, 'uthmani');
  const w304 = dataCtx.structuralQuarterBounds(30, 4, 'waterval');
  check('v423: juz 1 quarter 1 starts at 1:1 in both prints, and their ends DIFFER by mushaf',
    wq11.startSurah === 1 && wq11.startAyah === 1 && uq11.startSurah === 1 && uq11.startAyah === 1
    && `${wq11.endSurah}:${wq11.endAyah}` === '2:46' && `${uq11.endSurah}:${uq11.endAyah}` === '2:43');
  check('v423: juz 30 quarter 4 ends the Qur\'an at 114:6', `${w304.endSurah}:${w304.endAyah}` === '114:6');
}

check('v424: with NO rows the picker appears in their place; with rows it does not appear at all',
  /sabaqDhorRows\.length === 0\n    \? sabaqDhorQuarterPickerHtml\(\)/.test(read('js/sabaqDhorPage.js'))
  && /No history yet — choose the portion she is revising\./.test(read('js/sabaqDhorPage.js'))
  && !/Nothing to revise yet/.test(read('js/sabaqDhorPage.js')));
check('v428: the picker is wired per render and uses the shared switch helper; the old Use button is gone',
  /wireSabaqDhorQuarterPicker\(\);   \/\/ V4\.2\.8: no-op unless the picker is on screen/.test(read('js/sabaqDhorPage.js'))
  && /wireSwitch\('sdq_quarter_switch'/.test(read('js/sabaqDhorPage.js'))
  && /id="sdq_confirm"/.test(read('js/sabaqDhorPage.js'))
  && !/id="sdq_apply"|>Use<|class="secondary sdq-apply"/.test(read('js/sabaqDhorPage.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
