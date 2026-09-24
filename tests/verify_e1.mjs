import { createDatabase, d1Database } from './helpers/database.mjs';
import fs from 'fs';
import { handleMaktabSummary, handleSaveMaktabSabaq, handleSaveMaktabDhor } from '../worker/src/maktabLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

// ================= WORKER SIDE =================
const db = createDatabase();
db.exec(`
  INSERT INTO students (id,name,role,created_date,active) VALUES
    ('STU1','Zayd','student','2026-01-01',1),
    ('STU2','Amina','student','2026-01-01',1),
    ('OLD1','Gone','student','2026-01-01',0),
    ('TCH1','Ustadh Ahmed','teacher','2026-01-01',1),
    ('TCH2','Ustadh Bilal','teacher','2026-01-01',1),
    ('ADM1','Admin One','admin','2026-01-01',1);`);
const DB = d1Database(db);
const env = { DB };
const TCH1 = { id: 'TCH1', role: 'teacher' }, TCH2 = { id: 'TCH2', role: 'teacher' }, STUDENT = { id: 'STU1', role: 'student' };
const post = (b) => ({ json: async () => b, url: 'https://x/?' });
const get = (qs) => ({ url: `https://x/?${qs}` });

// seed today's entries via the real save handlers
const TODAY = '2026-08-16';
await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: TODAY, sabaq_from: '2:1', sabaq_to: '2:5' }), env, TCH1);
await handleSaveMaktabDhor(post({ student_id: 'STU2', date: TODAY, segment_from: 1, segment_to: 2, ref: 'waterval' }), env, TCH1);
await handleSaveMaktabSabaq(post({ student_id: 'STU2', date: '2026-08-10', sabaq_from: '9:1', sabaq_to: '9:5' }), env, TCH1); // different date — must NOT appear
await handleSaveMaktabSabaq(post({ student_id: 'STU2', date: TODAY, sabaq_from: '3:1', sabaq_to: '3:4',
  teacher_feedback: 'only for me', teacher_feedback_visibility: 'private' }), env, TCH1);

{
  const s = await handleMaktabSummary(get(''), env, TCH1);
  check('summary: missing date → 400', s.status === 400);
  const s403 = await handleMaktabSummary(get(`date=${TODAY}`), env, STUDENT);
  check('summary: student → 403', s403.status === 403);

  const r = (await handleMaktabSummary(get(`date=${TODAY}`), env, TCH2)).data;
  // V3.77.0 (j): STUDENTS only — the teaching and admin rows (TCH1, TCH2,
  // ADM1) no longer appear as girls to be logged against. The fixture has
  // exactly two active students.
  check('roster: active STUDENTS only, ordered by name (teaching/admin rows excluded — V3.77.0)',
    r.students.length === 2 && r.students[0].name === 'Amina' && r.students[1].name === 'Zayd'
    && !r.students.find(x => x.id === 'OLD1') && !r.students.find(x => ['TCH1','TCH2','ADM1'].includes(x.id)));
  check('roster: id+name+mushaf+track_haidh+group only (no whatsapp/pin leakage; group fields added V3.78.0)', Object.keys(r.students[0]).sort().join(',') === 'group_id,group_name,id,mushaf,name,track_haidh');
  check('date filter: only today rows', r.sabaq.length === 2 && r.dhor.length === 1 && r.sabaq_dhor.length === 0);
  check('rows carry student_id for grouping', r.sabaq.every(x => x.student_id) && r.dhor[0].student_id === 'STU2');
  const privRow = r.sabaq.find(x => x.teacher_feedback_visibility === 'private');
  check("privacy: TCH1's private feedback nulled for TCH2", privRow.teacher_feedback === null);
  const r1 = (await handleMaktabSummary(get(`date=${TODAY}`), env, TCH1)).data;
  const privRow1 = r1.sabaq.find(x => x.teacher_feedback_visibility === 'private');
  check('privacy: visible to its author', privRow1.teacher_feedback === 'only for me');
  check('dhor lap_times parse hook applied (null stays null, no crash)', r.dhor[0].lap_times === null);
}

// ================= FRONTEND SIDE (jsdom, real modules) =================
{
  const { JSDOM } = await import('jsdom');
  const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <input type="date" id="maktabSummaryDatePicker"><table><tbody id="maktabSummaryBody"></tbody></table>
    <table><tbody id="maktabJournalBody"></tbody></table>
    <div id="maktabDayContent"></div></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;

  // stub the globals the modules lean on (journal.js's formatters, app.js routing, api)
  w.eval(`
    var shownScreen = null, shownParam = null;
    function showScreen(id, param){ shownScreen = id; shownParam = param; }
    function formatDateCell(d){ return '<span>' + d + '</span>'; }
    function describeDhorSegment(f, t, ref){ return 'J' + f + '-J' + t; }
    var dhorCurrentRef = 'waterval';
    function journalCellShorthand(type, entries){
      if(!entries || !entries.length) return '<span class="journal-cell-empty">—</span>';
      const e = entries[0];
      let text = '—';
      if(type === 'sabaq') text = e.sabaq_from + '–' + e.sabaq_to;
      else if(type === 'sabaqDhor') text = e.from_surah + ':' + e.from_ayah + '–' + e.to_surah + ':' + e.to_ayah;
      else if(type === 'dhor') text = describeDhorSegment(e.segment_from, e.segment_to, e.ref || dhorCurrentRef);
      const badge = entries.length > 1 ? '<button type="button" class="entry-count-badge" data-count-badge>+' + (entries.length - 1) + '</button>' : '';
      return '<span class="journal-cell-text">' + text + '</span>' + badge;
    }
  `);
  // V3.59.1: stubs mirror the WIRE shape -- respond() unwraps, the body
  // IS the payload. The V3.59.0 stubs encoded the {data:...} envelope
  // assumption and let the crash through.
  w.eval(`
    var SUMMARY_PAYLOAD = {
      students: [ { id: 'STU1', name: 'Zayd', track_haidh: 0 }, { id: 'STU2', name: 'Amina', track_haidh: 1 } ],
      sabaq: [ { student_id: 'STU1', sabaq_from: '2:1', sabaq_to: '2:5' },
               { student_id: 'STU1', sabaq_from: '2:6', sabaq_to: '2:9' } ],
      sabaq_dhor: [],
      dhor: [ { student_id: 'STU2', segment_from: 1, segment_to: 2, ref: 'waterval' } ],
      attendance: [],
    };
    function apiMaktabSummary(date){ return Promise.resolve(SUMMARY_PAYLOAD); }
    function apiGetMaktabSabaq(){ return Promise.resolve([ { date: '2026-08-16', sabaq_from: '2:1', sabaq_to: '2:5', teacher_feedback: null } ]); }
    function apiGetMaktabSabaqDhor(){ return Promise.resolve([]); }
    function apiGetMaktabDhor(){ return Promise.resolve([ { date: '2026-08-15', segment_from: 3, segment_to: 4 } ]); }
    function openMaktabHaidhCalendar(){ /* V3.76.0: the haidh icon is a link; verify_v3760_phase2 drives it */ }
    function openMaktabAttendancePage(){ }
    // V3.64.0: the row tap opens the PJ's own day view with a maktab
    // context (openMaktabDay), not a maktab screen of its own.
    var openedWith = null;
    function openMaktabDay(student, date){ openedWith = { student, date }; return Promise.resolve(); }
    function openStudentSummaryPage(student, date){ openedWith = {student, date}; }
    var setupOpenedWith = null;
    function openMaktabStudentSetup(s){ setupOpenedWith = s; return Promise.resolve(); }
    function apiGetMaktabAttendance(){ return Promise.resolve({ isMaktabDay: true, attendance: {} }); }
    function wireCustomDateDisplay(){ /* visual-only; real impl tested by V3.50.1's own harness */ }
    function iconHtml(name){ return '<svg data-icon="' + name + '"></svg>'; }
  `);
  w.eval(read('js/maktabSummary.js'));
  w.eval(read('js/maktabJournal.js'));

  // regression for the reported crash: an error-shaped response (no
  // students array) must render the error row, never throw
  w.eval(`var GOOD = SUMMARY_PAYLOAD; SUMMARY_PAYLOAD = { error: 'Not found' };`);
  let threw = false;
  try { await w.renderMaktabSummaryScreen(); } catch (e) { threw = true; }
  check('V3.59.1 regression: error-shaped summary response -> error row, no throw',
    !threw && w.document.getElementById('maktabSummaryBody').textContent.includes('Could not load'));
  w.eval('SUMMARY_PAYLOAD = GOOD;');

  await w.renderMaktabSummaryScreen();
  const rows = w.document.querySelectorAll('#maktabSummaryBody tr');
  check('summary: one row per roster student', rows.length === 2);
  // Locate by identity: current Summary sorts logged students alphabetically.
  const rowFor = name => [...w.document.querySelectorAll('#maktabSummaryBody tr')].find(r => r.querySelector('.maktab-name-pill')?.textContent === name);
  const zayd = rowFor('Zayd'), amina = rowFor('Amina');
  check('summary: logged students are alphabetical', rows[0] === amina && rows[1] === zayd);
  check('summary: every student has independent name, attendance and Log actions',
    [...rows].every(r => r.querySelector('.maktab-name-pill') && r.querySelector('.maktab-haidh-check') && r.querySelector('.maktab-mobile-log-action')));
  check('summary: Sabaq and Dhor keep the shared shorthand', zayd.cells[2].textContent.includes('2:1–2:5') && amina.cells[4].textContent.includes('J1-J2'));
  check('summary: empty cells show em-dash', amina.cells[2].textContent.includes('—'));
  const badge = zayd.querySelector('[data-entry-peek]');
  check('summary: multi-entry badge is an independent button', badge?.tagName === 'BUTTON' && badge.textContent === '+1');
  badge.click();
  check('summary: badge opens read-only entries without navigation', w.eval('openedWith') === null && w.document.querySelectorAll('.maktab-entry-peek-row').length === 2);
  w.document.body.click();
  zayd.cells[2].click();
  check('summary: activity cell stays display-only', w.eval('openedWith') === null);
  let logAction = null, attendanceAction = null;
  w.maktabOpenQuickLog = (...args) => { logAction = args; };
  w.maktabOpenQuickAttendance = (...args) => { attendanceAction = args; };
  zayd.querySelector('.maktab-mobile-log-action').click();
  check('summary: Log opens unified quick action for the selected student', logAction?.[0].id === 'STU1' && logAction[5]?.combined === true);
  amina.querySelector('.maktab-haidh-check').click();
  check('summary: attendance action uses the selected student', attendanceAction?.[0].id === 'STU2');
  amina.querySelector('.maktab-name-pill').click();
  check('summary: name opens that student summary', w.eval('openedWith').student.id === 'STU2');
  const picker = w.document.getElementById('maktabSummaryDatePicker');
  picker.value = '2026-08-01';
  picker.dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  rowFor('Amina').querySelector('.maktab-name-pill').click();
  check('summary: picked date follows the name action', w.eval('openedWith').date === '2026-08-01');
  rowFor('Zayd').querySelector('.maktab-mobile-log-action').click();
  check('summary: picked date follows the Log action', logAction?.[1] === '2026-08-01');

  await w.renderMaktabJournalScreen();
  const jrows = w.document.querySelectorAll('#maktabJournalBody tr');
  check('journal: one row per date, newest first', jrows.length === 2 && jrows[0].cells[0].textContent.includes('2026-08-16'));
  check('journal: cells non-interactive (no buttons anywhere)', w.document.querySelectorAll('#maktabJournalBody button').length === 0);
}

// ---- nav gating (real auth.js visibleNavItems) ----
{
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  const authSrc = fs.readFileSync(ROOT + 'js/auth.js', 'utf8');
  // extract just the nav-items block: NAV_ITEMS const through visibleNavItems()
  const start = authSrc.indexOf('const NAV_ITEMS = [');
  const end = authSrc.indexOf('function renderNavItemsInto');
  w.eval('var currentUser = { role: "student", trackHaidh: false };');
  w.eval(authSrc.slice(start, end));
  const ids = () => w.eval('visibleNavItems().map(i => i.id)');
  let v = ids();
  // Updated twice in one day, both times to track reality rather than work
  // around it (tests/README maintenance rule). V3.69.0 hid the personal
  // journal from EVERYONE and dropped maktabJournal outright; V3.70.0
  // corrected that to teaching profiles only — "students see everything
  // except admin profiles". So the student expectation is back to what it
  // was, and the per-role detail now lives in verify_nav.mjs.
  check('nav student: has her own maktabJournal, NOT maktabSummary/admin', v.includes('maktabJournal') && !v.includes('maktabSummary') && !v.includes('admin'));
  check('nav student: keeps her personal journal screens (V3.70.0)',
    v.includes('journal') && v.includes('logDetail') && v.includes('reflections') && v.includes('settings'));
  w.eval('currentUser.role = "teacher"');
  v = ids();
  check('nav teacher: + maktabSummary, still no admin', v.includes('maktabSummary') && !v.includes('admin'));
  w.eval('currentUser.role = "admin"');
  v = ids();
  check('nav admin: maktabSummary AND admin (admin counts as teacher)', v.includes('maktabSummary') && v.includes('admin'));
  check('nav admin: Juz Tracker and Surahs in my Heart survive the hiding (V3.69.0)',
    v.includes('juzTracker') && v.includes('sih'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
