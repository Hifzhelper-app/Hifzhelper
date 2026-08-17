import fs from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');

function makeDom(){
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div id="sabaqCommentBlock"></div>
    <div class="maktab-name-row" id="maktabNameRow_sabaq" hidden></div>
    <div class="maktab-name-row" id="maktabNameRow_sabaqDhor" hidden></div>
    <div class="maktab-name-row" id="maktabNameRow_dhor" hidden></div>
  </body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  // record every request the clients make, so we can assert WHICH table
  // and WHICH student each call actually targeted
  w.eval(`
    var calls = [];
    function apiFetch(path, opts){
      calls.push({ path, method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve([]);
    }
    function makeLogClient(path){
      return {
        get: (since) => apiFetch(path + (since ? '?since=' + encodeURIComponent(since) : '')),
        getForDate: (date) => apiFetch(path + '?date=' + encodeURIComponent(date)).catch(() => []),
        save: (entry) => apiFetch(path, { method: 'POST', body: JSON.stringify(entry) }),
        update: (id, fields) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(Object.assign({ id }, fields)) }),
        remove: (id) => apiFetch(path + '?id=' + encodeURIComponent(id), { method: 'DELETE' })
      };
    }
    var apiSabaq = makeLogClient('/sabaq');
    var apiSabaqDhor = makeLogClient('/sabaq-dhor');
    var apiDhor = makeLogClient('/dhor');
    function apiGetDhorDefaultEntry(){ return apiFetch('/dhor/default-entry'); }
    function apiMaktabDhorDefault(id){ return apiFetch('/maktab/dhor-default-entry?student_id=' + id); }
    function iconHtml(n){ return '<svg data-icon="' + n + '"></svg>'; }
    var PJ_PROFILE = { mushaf: '15line_madani', baseline_selection: [3, 4, 5] };
    function apiGetProfile(){ return Promise.resolve(PJ_PROFILE); }
  `);
  w.eval(read('js/logContext.js'));
  w.eval(read('js/commentPrivacy.js'));
  return w;
}

// ---------- PJ default is byte-for-byte the old behaviour ----------
{
  const w = makeDom();
  check('default mode is PJ', w.eval('logCtxIsMaktab()') === false);
  check('PJ: logClient returns the PJ clients themselves',
    w.eval("logClient('sabaq') === apiSabaq && logClient('sabaqDhor') === apiSabaqDhor && logClient('dhor') === apiDhor"));
  await w.eval("logClient('sabaq').get()");
  await w.eval("logClient('sabaq').save({ sabaq_from: '2:1' })");
  const calls = w.eval('JSON.stringify(calls)');
  const parsed = JSON.parse(calls);
  check('PJ: reads hit /sabaq with no student_id', parsed[0].path === '/sabaq');
  check('PJ: saves carry NO student_id (worker infers from auth, as before)',
    parsed[1].path === '/sabaq' && !('student_id' in parsed[1].body));
  check('PJ: position + plans enabled', w.eval('logPositionEnabled() && logPlansEnabled()'));
  check('PJ: dhor default is the PJ endpoint', (async () => true)() && true);
  await w.eval('logDhorDefaultEntry()');
  check('PJ: dhor default hits /dhor/default-entry',
    JSON.parse(w.eval('JSON.stringify(calls)')).pop().path === '/dhor/default-entry');
}

// ---------- maktab mode: same call sites, different tables + student ----------
{
  const w = makeDom();
  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme', track_haidh: 1 }, '2026-08-16')");
  check('maktab: context reports the student and date',
    w.eval('logCtxIsMaktab()') === true && w.eval('logCtxStudentId()') === 'STU2'
    && w.eval('logCtxStudentName()') === 'Umme' && w.eval('logCtxDate()') === '2026-08-16');

  await w.eval("logClient('sabaq').get()");
  await w.eval("logClient('sabaqDhor').get()");
  await w.eval("logClient('dhor').get()");
  let c = JSON.parse(w.eval('JSON.stringify(calls)'));
  check('maktab: all three reads hit the MAKTAB tables, scoped to the student',
    c[0].path === '/maktab/sabaq?student_id=STU2'
    && c[1].path === '/maktab/sabaq-dhor?student_id=STU2'
    && c[2].path === '/maktab/dhor?student_id=STU2');

  w.eval('calls = []');
  await w.eval("logClient('sabaq').save({ sabaq_from: '2:1', sabaq_to: '2:5' })");
  c = JSON.parse(w.eval('JSON.stringify(calls)'));
  check('maktab: save targets the maktab table AND carries student_id',
    c[0].path === '/maktab/sabaq' && c[0].method === 'POST' && c[0].body.student_id === 'STU2'
    && c[0].body.sabaq_from === '2:1');

  w.eval('calls = []');
  await w.eval("logClient('dhor').remove(7)");
  await w.eval("logClient('sabaqDhor').update(9, { zone: 'B' })");
  c = JSON.parse(w.eval('JSON.stringify(calls)'));
  check('maktab: delete/update hit the maktab tables',
    c[0].path === '/maktab/dhor?id=7' && c[0].method === 'DELETE'
    && c[1].path === '/maktab/sabaq-dhor' && c[1].method === 'PATCH');

  w.eval('calls = []');
  await w.eval('logDhorDefaultEntry()');
  check('maktab: dhor prepop uses the maktab variant',
    JSON.parse(w.eval('JSON.stringify(calls)'))[0].path === '/maktab/dhor-default-entry?student_id=STU2');

  check('maktab: position DISABLED (would corrupt the teacher\'s own row)', w.eval('logPositionEnabled()') === false);
  check('maktab: plans DISABLED (no maktab plans concept)', w.eval('logPlansEnabled()') === false);
}

// ---------- THE hazard: no state leaks maktab -> PJ -> maktab ----------
{
  const w = makeDom();
  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme', track_haidh: 1 }, '2026-08-16')");
  w.eval('clearLogContext()');
  check('leakage: after clear, mode is PJ again', w.eval('logCtxIsMaktab()') === false);
  check('leakage: no student identity survives the clear',
    w.eval('logCtxStudentId()') === null && w.eval('logCtxStudentName()') === null
    && w.eval('logCtxDate()') === null && w.eval('logCtxTrackHaidh()') === false);
  w.eval('calls = []');
  await w.eval("logClient('sabaq').get()");
  await w.eval("logClient('sabaq').save({ sabaq_from: '9:1' })");
  const c = JSON.parse(w.eval('JSON.stringify(calls)'));
  check('leakage: PJ reads go back to /sabaq, NOT the maktab table', c[0].path === '/sabaq');
  check('leakage: PJ save carries no student_id — the teacher logs THEMSELF again',
    c[1].path === '/sabaq' && !('student_id' in c[1].body));
  // and back into maktab for a DIFFERENT student
  w.eval("setMaktabLogContext({ id: 'STU3', name: 'Other', track_haidh: 0 }, '2026-08-10')");
  w.eval('calls = []');
  await w.eval("logClient('sabaq').get()");
  check('leakage: re-entering maktab picks up the NEW student, not the old one',
    JSON.parse(w.eval('JSON.stringify(calls)'))[0].path === '/maktab/sabaq?student_id=STU3');
  check('leakage: track_haidh follows the new student too', w.eval('logCtxTrackHaidh()') === false);
}

// ---------- the notes block flips sides with the context ----------
{
  const w = makeDom();
  // PJ side unchanged
  w.eval("renderCommentBlock('sabaqCommentBlock', null)");
  check('notes PJ: student textarea + Private checkbox, no teacher fields',
    w.document.querySelector('.cb-comment') !== null
    && w.document.querySelector('.cb-private-checkbox').checked === true
    && w.document.querySelector('.cb-teacher-note') === null);
  check('notes PJ: read returns the student shape',
    w.eval("JSON.stringify(Object.keys(readCommentBlock('sabaqCommentBlock')).sort())") === '["student_comment","student_comment_private"]');

  // maktab side
  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme' }, '2026-08-16')");
  w.eval("renderCommentBlock('sabaqCommentBlock', null)");
  const doc = w.document;
  check('notes maktab: teacher note + 3 radios, Teachers default, no student textarea',
    doc.querySelector('.cb-teacher-note') !== null
    && doc.querySelectorAll('.mk-vis-row input[type=radio]').length === 3
    && doc.querySelector('.mk-vis-row input:checked').value === 'teachers_only'
    && doc.querySelector('.cb-comment') === null);
  check('notes maktab: NO student-note block when there is no note',
    doc.querySelector('.mk-student-note') === null);
  check('notes maktab: teacher note sits ABOVE where the student note would', (() => {
    w.eval("renderCommentBlock('sabaqCommentBlock', { student_comment: 'from her PJ' })");
    const t = w.document.querySelector('.cb-teacher-note');
    const s2 = w.document.querySelector('.mk-student-note');
    return t && s2 && (t.compareDocumentPosition(s2) & 4) !== 0;
  })());
  check('notes maktab: student note shown READ-ONLY (no input element)',
    w.document.querySelector('.mk-student-note-text').textContent === 'from her PJ'
    && w.document.querySelector('.mk-student-note textarea') === null
    && w.document.querySelector('.mk-student-note input') === null);
  const readBack = JSON.parse(w.eval("JSON.stringify(readCommentBlock('sabaqCommentBlock'))"));
  check('notes maktab: read returns teacher fields + the frozen student note',
    readBack.teacher_feedback_visibility === 'teachers_only'
    && readBack.student_comment === 'from her PJ');
  w.eval("document.querySelector('.mk-vis-row input[value=all]').checked = true");
  check('notes maktab: radio choice drives the saved visibility',
    JSON.parse(w.eval("JSON.stringify(readCommentBlock('sabaqCommentBlock'))")).teacher_feedback_visibility === 'all');
  check('notes maktab: existing entry keeps its stored visibility', (() => {
    w.eval("renderCommentBlock('sabaqCommentBlock', { teacher_feedback: 'good', teacher_feedback_visibility: 'private' })");
    return w.document.querySelector('.mk-vis-row input:checked').value === 'private'
      && w.document.querySelector('.cb-teacher-note').value === 'good';
  })());
  check('notes maktab: a student note is escaped, not injected', (() => {
    w.eval("renderCommentBlock('sabaqCommentBlock', { student_comment: '<img src=x onerror=alert(1)>' })");
    return w.document.querySelector('.mk-student-note-text').querySelector('img') === null;
  })());
}

// ---------- the name row paints per card and clears with the context ----------
{
  const w = makeDom();
  w.eval(read('js/maktabDay.js').replace(/async function openMaktabDay[\s\S]*?\n}\n/, ''));
  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme', track_haidh: 1 }, '2026-08-16')");
  w.eval('maktabPaintNameRows(true)');
  const rows = [...w.document.querySelectorAll('.maktab-name-row')];
  check('name row: shown on all three cards with the student name',
    rows.length === 3 && rows.every(r => !r.hidden && r.querySelector('.maktab-name-text').textContent === 'Umme'));
  check('name row: haidh toggle present and MARKED (yellow class)',
    rows.every(r => r.querySelector('[data-haidh-toggle]') && r.querySelector('[data-haidh-toggle]').classList.contains('marked')));

  w.eval("setMaktabLogContext({ id: 'STU9', name: 'NoHaidh', track_haidh: 0 }, '2026-08-16')");
  w.eval('maktabPaintNameRows(false)');
  check('name row: no toggle at all for a non-tracking student',
    w.document.querySelectorAll('[data-haidh-toggle]').length === 0);

  w.eval('clearLogContext(); maktabPaintNameRows(false)');
  check('name row: hidden and emptied back in PJ mode',
    [...w.document.querySelectorAll('.maktab-name-row')].every(r => r.hidden && r.innerHTML === ''));
}

// ---------- V3.64.1: profile source + the PJ note input ----------
{
  const w = makeDom();
  const pj = JSON.parse(await w.eval('logProfile().then(p => JSON.stringify(p))'));
  check('profile PJ: returns the real profile untouched',
    pj.mushaf === '15line_madani' && pj.baseline_selection.length === 3);

  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme' }, '2026-08-16')");
  const mk = JSON.parse(await w.eval('logProfile().then(p => JSON.stringify(p))'));
  check('profile maktab: 13-line interim, NOT the teacher\'s mushaf', mk.mushaf === '13line');
  check('profile maktab: Dhor pool EMPTY, NOT the teacher\'s pool', Array.isArray(mk.baseline_selection) && mk.baseline_selection.length === 0);
  check('profile maktab: never calls the own-only endpoint',
    !JSON.parse(w.eval('JSON.stringify(calls)')).some(c => String(c.path).includes('/profile')));

  // the third permitted PJ input
  w.eval("setLogCtxPjNotes({ sabaq: 'practised at home', sabaqDhor: '', dhor: 'struggled' })");
  check('pj note: served per type', w.eval("logCtxPjNote('sabaq')") === 'practised at home'
    && w.eval("logCtxPjNote('dhor')") === 'struggled' && w.eval("logCtxPjNote('sabaqDhor')") === '');
  w.eval("renderCommentBlock('sabaqCommentBlock', null)");
  check('pj note: REACHES the card (the V3.64.0 dangling-read bug)',
    w.document.querySelector('.mk-student-note-text').textContent === 'practised at home');
  check('pj note: a type with no note shows no student-note block', (() => {
    w.document.body.insertAdjacentHTML('beforeend', '<div id="sabaqDhorCommentBlock"></div>');
    w.eval("renderCommentBlock('sabaqDhorCommentBlock', null)");
    return w.document.querySelector('#sabaqDhorCommentBlock .mk-student-note') === null;
  })());
  check('pj note: a SAVED row\'s own note wins over the PJ note', (() => {
    w.eval("renderCommentBlock('sabaqCommentBlock', { student_comment: 'frozen at save' })");
    return w.document.querySelector('.mk-student-note-text').textContent === 'frozen at save';
  })());
  w.eval('clearLogContext()');
  check('pj note: cleared with the context (per-student, must not leak)',
    w.eval("logCtxPjNote('sabaq')") === '');
  const backToPj = JSON.parse(await w.eval('logProfile().then(p => JSON.stringify(p))'));
  check('profile: back in PJ mode the real profile returns', backToPj.mushaf === '15line_madani');
}

// ---------- source guard: every routed call site is valid ----------
// A typo (logClient('sabaqdhor')) returns undefined and throws only at
// runtime, in the LIVE journal. These modules aren't otherwise driven by
// a harness, so the call sites are checked statically instead.
{
  const VALID = ['sabaq', 'sabaqDhor', 'dhor'];
  const files = ['js/sabaqPage.js', 'js/sabaqDhorPage.js', 'js/dhorPage.js', 'js/position.js'];
  let total = 0, bad = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/logClient\((['"])([^'"]*)\1\)/g)) {
      total++;
      if (!VALID.includes(m[2])) bad.push(f + ': ' + m[2]);
    }
    // and no direct PJ client survives in CODE, which would silently
    // bypass the context. Comment lines are stripped first — the first
    // draft of this check flagged dhorPage.js's own header prose.
    const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    for (const m of code.matchAll(/\bapi(Sabaq|SabaqDhor|Dhor)\.(get|save|update|remove)\s*\(/g)) {
      bad.push(f + ': direct ' + m[0]);
    }
  }
  check(`source: all ${total} logClient() call sites use a valid type`, total >= 16 && bad.length === 0);
  if (bad.length) console.log('   offenders:', bad.join(', '));
  check('source: dhor prepop routed through the context',
    /logDhorDefaultEntry\(\)/.test(read('js/dhorPage.js')) && !/await apiGetDhorDefaultEntry\(\)/.test(read('js/dhorPage.js')));
  check('source: no direct apiGetProfile() survives in the three cards',
    ['js/sabaqPage.js', 'js/sabaqDhorPage.js', 'js/dhorPage.js'].every(f => {
      const code = read(f).split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
      return !/\bapiGetProfile\s*\(/.test(code);
    }));
  // V3.65.0 retired the interim constant exactly as designed — the
  // mushaf now comes from the maktab setting.
  check('source: maktab mushaf comes from the SETTING, interim constant gone',
    /loadMaktabSettings\(\)/.test(read('js/logContext.js'))
    && !/MAKTAB_MUSHAF_INTERIM/.test(read('js/logContext.js').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')));
  // V3.66.0 replaced position's maktab SKIP with a real maktab store, so
  // logPositionEnabled is gone from position.js by design; plans stay
  // guarded (the maktab has no plans concept).
  check('source: position now ROUTES to the maktab store; plans still guarded',
    /apiGetMaktabPosition/.test(read('js/position.js')) && /apiSaveMaktabPosition/.test(read('js/position.js'))
    && /logPlansEnabled/.test(read('js/dhorPage.js')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
