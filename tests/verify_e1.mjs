import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { handleMaktabSummary, handleSaveMaktabSabaq, handleSaveMaktabDhor } from '../worker/src/maktabLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

// ================= WORKER SIDE =================
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, mushaf TEXT, track_haidh INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
  INSERT INTO students (id,name,role,created_date,active) VALUES
    ('STU1','Zayd','student','2026-01-01',1),
    ('STU2','Amina','student','2026-01-01',1),
    ('OLD1','Gone','student','2026-01-01',0),
    ('TCH1','Ustadh Ahmed','teacher','2026-01-01',1),
    ('TCH2','Ustadh Bilal','teacher','2026-01-01',1),
    ('ADM1','Admin One','admin','2026-01-01',1);`);
const mig = fs.readFileSync(ROOT + 'worker/migrations/0019_maktab_tables.sql', 'utf8');
const noC = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
for (const st of noC.split(';').map(s => s.trim()).filter(Boolean)) db.exec(st);

const DB = { prepare(sql) { return { bind(...args) { return {
  async run() { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
}; },
// summary's roster query has no bind params — support bare .all()
async all() { return { results: db.prepare(sql).all() }; },
async run() { const i = db.prepare(sql).run(); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
async first() { return db.prepare(sql).get() ?? null; } }; } };
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
  check('roster: active only, ordered by name', r.students.length === 5 && r.students[0].name === 'Admin One' && !r.students.find(x => x.id === 'OLD1'));
  check('roster: id+name+mushaf+track_haidh only (no whatsapp/pin leakage)', Object.keys(r.students[0]).sort().join(',') === 'id,mushaf,name,track_haidh');
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
    function maktabMarkHaidhFlow(){ /* exercised in verify_e2 */ }
    function maktabToggleHaidh(){ /* exercised in verify_e2 */ }
    // V3.64.0: the row tap opens the PJ's own day view with a maktab
    // context (openMaktabDay), not a maktab screen of its own.
    var openedWith = null;
    function openMaktabDay(student, date){ openedWith = { student, date }; return Promise.resolve(); }
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
  check('V3.61.0: leading haidh col — control ONLY for track_haidh student, empty cell otherwise',
    rows[0].cells[0].querySelector('.maktab-haidh-check') === null
    && rows[1].cells[0].querySelector('.maktab-haidh-check') !== null);
  check('V3.61.0/V3.66.0: names in the SECOND cell, with the Setup control beside them',
    rows[0].cells[1].textContent.startsWith('Zayd') && rows[1].cells[1].textContent.startsWith('Amina')
    && rows[0].cells[1].querySelector('.maktab-setup-btn') !== null
    && rows[0].cells[1].querySelector('.maktab-haidh-check') === null);
  check('summary: sabaq cell shows PJ shorthand', rows[0].cells[2].textContent.includes('2:1–2:5'));
  check('summary: multi-entry badge DOWNGRADED to plain span', rows[0].cells[2].querySelector('button[data-count-badge]') === null && rows[0].cells[2].textContent.includes('+1'));
  check('summary: dhor cell uses describeDhorSegment', rows[1].cells[4].textContent.includes('J1-J2'));
  check('summary: empty cells show em-dash', rows[1].cells[2].textContent.includes('—'));

  rows[1].dispatchEvent(new w.Event('click', { bubbles: true }));
  check('V3.64.0: row tap opens the SHARED day view with the student + date',
    (() => {
      const o = w.eval('openedWith');
      return o && o.student.id === 'STU2' && o.student.name === 'Amina'
        && 'mushaf' in o.student && o.student.track_haidh === true
        && /^\d{4}-\d{2}-\d{2}$/.test(o.date);
    })());

  // V3.61.1: header/table alignment — the reported bug was the 5-column
  // grid inheriting the PJ's 4-column nth-child widths. Assert the CSS
  // actually defines a width for EVERY column on BOTH sides, and that
  // the two sets match; a purely-visual check jsdom can't do, but a
  // missing/mismatched rule is exactly what broke it.
  {
    const css = fs.readFileSync(ROOT + 'css/journal-table.css', 'utf8');
    const grab = (re) => { const out = {}; let m; const r = new RegExp(re, 'g');
      while ((m = r.exec(css))) out[m[1]] = m[2]; return out; };
    const hdr = grab('\\.maktab-summary-headers > \\*:nth-child\\((\\d)\\)\\s*\\{[^}]*?(\\d+)%');
    const tbl = grab('\\.maktab-summary-table td:nth-child\\((\\d)\\)\\s*\\{[^}]*?(\\d+)%');
    const cols = ['1','2','3','4','5'];
    check('V3.61.1: all 5 header columns have an explicit width', cols.every(c => hdr[c]));
    check('V3.61.1: all 5 table columns have an explicit width', cols.every(c => tbl[c]));
    check('V3.61.1: header and table widths MATCH column-for-column', cols.every(c => hdr[c] === tbl[c]));
    check('V3.61.1: widths sum to 100% (no overflow pushing the header out)',
      cols.reduce((n, c) => n + Number(tbl[c] || 0), 0) === 100);
    check('V3.61.1: table is table-layout:fixed so it obeys those widths', /\.maktab-summary-table\s*\{[^}]*table-layout:\s*fixed/.test(css));
    // V3.63.0: the pill is constrained the way the PJ constrains its
    // own (.card-date-row: grid, auto 1fr) -- NOT by overriding the
    // shared wrap's width. Assert the structure, and assert the two
    // V3.61.1 hacks are actually gone rather than merely overridden.
    check('V3.63.0: top row is the PJ auto/1fr grid so the pill self-sizes',
      /\.maktab-summary-toprow\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*auto 1fr/.test(css));
    check('V3.63.0: no width override on the shared date wrap, no % indent hack',
      !/\.maktab-summary-toprow \.custom-date-wrap/.test(css) && !/\.maktab-summary-toprow\s*\{[^}]*padding-left:\s*7%/.test(css));
    check('V3.63.0: marked haidh is bright yellow, not the old muted pink',
      /\.maktab-haidh-check\.marked\s*\{[^}]*#FFD400/i.test(css));
  }

  // date picker: change re-renders for the picked date and threads it
  const picker = w.document.getElementById('maktabSummaryDatePicker');
  picker.value = '2026-08-01';
  picker.dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  const rows2 = w.document.querySelectorAll('#maktabSummaryBody tr');
  rows2[1].dispatchEvent(new w.Event('click', { bubbles: true }));
  check('V3.61.0: picked past date flows to the day view', w.eval('openedWith').date === '2026-08-01');

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
  check('nav student: has maktabJournal, NOT maktabSummary/admin', v.includes('maktabJournal') && !v.includes('maktabSummary') && !v.includes('admin'));
  w.eval('currentUser.role = "teacher"');
  v = ids();
  check('nav teacher: + maktabSummary, still no admin', v.includes('maktabSummary') && !v.includes('admin'));
  w.eval('currentUser.role = "admin"');
  v = ids();
  check('nav admin: maktabSummary AND admin (admin counts as teacher)', v.includes('maktabSummary') && v.includes('admin') && v.includes('maktabJournal'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
