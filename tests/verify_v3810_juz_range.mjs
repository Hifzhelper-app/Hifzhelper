// ============================================================
// verify_v3810_juz_range.mjs — V3.81.0: the dhor juz-range.
//
// One Save writes the whole range together (the student read it in one
// sitting): one entry per juz, time and mistakes DIVIDED over the range
// (remainder to the earliest), tajweed tags (and the note) DUPLICATED,
// lap times on the first entry only. New saves only; the to-select
// appears only with the unit on Full/Juz.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const dhorSrc = read('js/dhorPage.js');

// ---------- the division rule, pure ----------
{
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  const a = dhorSrc.indexOf('function divideOverRange');
  const b = dhorSrc.indexOf('function refForMushaf');
  w.eval(dhorSrc.slice(a, b));
  check('divide: even split', JSON.stringify(w.eval('divideOverRange(40, 4)')) === '[10,10,10,10]');
  check('divide: remainder to the EARLIEST entries', JSON.stringify(w.eval('divideOverRange(6, 4)')) === '[2,2,1,1]'
    && JSON.stringify(w.eval('divideOverRange(7, 3)')) === '[3,2,2]');
  check('divide: totals are preserved exactly', w.eval('divideOverRange(2400 + 137, 4).reduce((a,b)=>a+b,0)') === 2537);
  check('divide: zero splits to zeros', JSON.stringify(w.eval('divideOverRange(0, 3)')) === '[0,0,0]');
  check('divide: null divides to nulls (no timer used)', JSON.stringify(w.eval('divideOverRange(null, 3)')) === '[null,null,null]');
}

// ---------- the card, driven ----------
function cardDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <input id="dhor_date" value="2026-08-28">
    <select id="dhor_juz"></select>
    <div id="dhorJuzToField" class="hidden"><select id="dhor_juz_to"></select></div>
    <div id="dhorPositionField"><input type="hidden" id="dhor_position" value="1"><div class="switch-track" id="dhor_position_switch"><div class="switch-thumb"></div></div></div>
    <div id="dhorJuzPositionRow"></div>
    <input type="hidden" id="dhor_unit" value="quarter">
    <div id="dhor_unit_switch"><button data-value="quarter"></button><button data-value="half"></button><button data-value="full"></button></div>
    <input type="checkbox" id="dhor_confirm" checked>
    <input id="dhor_mistakes" value="6">
    <div id="dhorError"></div><span id="dhorSaveStatus"></span>
    <div id="dhorRecentRail"></div>
    </body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var saves = [], confirms = [], CONFIRM_ANSWER = true, REJECT_AT = null, DUP_AT = null;
    window.confirm = (m) => { confirms.push(m); return CONFIRM_ANSWER; };
    function logClient(){ return { save(p){
      const idx = saves.length; saves.push(JSON.parse(JSON.stringify(p)));
      if(REJECT_AT !== null && idx === REJECT_AT) return Promise.reject(new Error('boom'));
      if(DUP_AT !== null && idx === DUP_AT && !p.force){ return Promise.resolve({ isDuplicate: true }); }
      return Promise.resolve({ id: idx + 1 });
    } }; }
    function todayISO(){ return '2026-08-28'; }
    var dhorCurrentRef = 'waterval', dhorSelectedTags = ['6','1'], dhorRawRange = null, dhorActivePlanId = null, dhorEditingId = null, dhorEditPortionEditable = true;
    function segmentsPerJuz(){ return 8; }
    function unitMarkerCount(ref, unit){ return unit === 'full' ? 8 : unit === 'half' ? 4 : 2; }
    function quarterUnitWord(){ return 'Quarter'; }
    function isEditConfirmed(){ return true; }
    function computeDhorDuration(){ return { duration_seconds: 2400, lap_times: '[600,600,600,600]' }; }
    function readCommentBlock(){ return { student_note: 'read together', student_note_visibility: 'private' }; }
    function renderRecentEntries(){ return Promise.resolve(); }
    function renderDhorScreen(){ return Promise.resolve(); }
    function renderSwitch(){ } function wireSwitch(id, fn){ window['_sw_' + id] = fn; }
    function quarterUnitToJuzQuarter(){ return { juz: 1, quarterIndex: 1 }; }
  `);
  // load only what the harness drives: helpers + position options + the
  // save wiring (skip renderDhorScreen's fetches by cutting at markers)
  const parts = [
    [dhorSrc.indexOf('function renderDhorJuzToOptions'), dhorSrc.indexOf('function refForMushaf')],
    [dhorSrc.indexOf('function refForMushaf'), dhorSrc.indexOf('function describeDhorSegment')],
    [dhorSrc.indexOf('function renderDhorPositionOptions'), dhorSrc.indexOf('function updateDhorUnitSwitchLabels')],
    [dhorSrc.indexOf('function setDhorUnit'), dhorSrc.indexOf('function applyDhorPlan')],
    [dhorSrc.indexOf('async function saveDhorJuzRange'), dhorSrc.indexOf("document.getElementById('dhorSaveBtn')")],
  ];
  for (const [a, b] of parts) w.eval(dhorSrc.slice(a, b));
  // the save button handler, extracted as a callable
  const h = dhorSrc.slice(dhorSrc.indexOf("document.getElementById('dhorSaveBtn').addEventListener('click', async () => {"));
  const body = h.slice(h.indexOf('{') , h.indexOf('\n});') + 2);
  w.eval(`window.pressSave = async () => ${body}`);
  w.eval("document.getElementById('dhor_juz').innerHTML = Array.from({length:30}, (_,i) => `<option value=\"${i+1}\">Juz ${i+1}</option>`).join(''); wireDhorJuzRange();");
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 0));

{ // the to-select's lifecycle
  const w = cardDom();
  w.eval("setDhorUnit('full')");
  check('ui: Full/Juz reveals the to-select with only later juz offered',
    !w.document.getElementById('dhorJuzToField').classList.contains('hidden')
    && w.document.querySelector('#dhor_juz_to option').value === ''
    && w.document.querySelectorAll('#dhor_juz_to option').length === 30);   // dash + 29 (from=1)
  w.document.getElementById('dhor_juz').value = '28';
  w.document.getElementById('dhor_juz').dispatchEvent(new w.Event('change'));
  check('ui: changing the from-juz rebuilds the to-options (28 → only 29, 30)',
    [...w.document.querySelectorAll('#dhor_juz_to option')].map(o => o.value).join(',') === ',29,30');
  w.eval("setDhorUnit('quarter')");
  check('ui: any other unit hides the to-select and clears it',
    w.document.getElementById('dhorJuzToField').classList.contains('hidden') && w.document.getElementById('dhor_juz_to').value === '');
}

{ // the range save: 11–14 in one sitting
  const w = cardDom();
  w.eval("setDhorUnit('full')");
  w.document.getElementById('dhor_juz').value = '11';
  w.document.getElementById('dhor_juz').dispatchEvent(new w.Event('change'));
  w.document.getElementById('dhor_juz_to').value = '14';
  await w.pressSave(); await tick();
  const saves = w.eval('saves');
  check('range: four entries, one per juz, correct segments (8/juz fixture)',
    saves.length === 4 && saves.map(s => `${s.segment_from}-${s.segment_to}`).join(' ') === '81-88 89-96 97-104 105-112', JSON.stringify(saves.map(s => [s.segment_from, s.segment_to])));
  check('range: time divided evenly (2400/4 = 600 each)', saves.every(s => s.duration_seconds === 600));
  check('range: mistakes divided, remainder to the earliest (6 → 2,2,1,1)', saves.map(s => s.mistakes).join(',') === '2,2,1,1');
  check('range: tags duplicated onto every juz', saves.every(s => s.tajweed_tag_ids === '6,1'));
  check('range: the note duplicated onto every juz', saves.every(s => s.student_note === 'read together'));
  check('range: lap times ride the FIRST entry only', saves[0].lap_times === '[600,600,600,600]' && saves.slice(1).every(s => s.lap_times === null));
  check('range: same date on all, no plan_id ever attaches', saves.every(s => s.date === '2026-08-28' && !('plan_id' in s)));
}

{ // the dash = the single save, byte-for-byte the old shape
  const w = cardDom();
  w.eval("setDhorUnit('full')");
  w.document.getElementById('dhor_juz').value = '11';
  await w.pressSave(); await tick();
  const saves = w.eval('saves');
  check('single: no to-juz → ONE save, the pre-V3.81.0 payload (laps included)',
    saves.length === 1 && saves[0].segment_from === 81 && saves[0].segment_to === 88 && saves[0].mistakes === 6 && saves[0].duration_seconds === 2400 && saves[0].lap_times === '[600,600,600,600]');
}

{ // a mid-range failure names what saved and what did not
  const w = cardDom();
  w.eval("setDhorUnit('full'); REJECT_AT = 2;");
  w.document.getElementById('dhor_juz').value = '11';
  w.document.getElementById('dhor_juz').dispatchEvent(new w.Event('change'));
  w.document.getElementById('dhor_juz_to').value = '14';
  await w.pressSave(); await tick();
  check('failure: the loop stops and the message names saved vs failed',
    w.eval('saves').length === 3 && /Saved Juz 11, 12\. Juz 13 failed: boom/.test(w.document.getElementById('dhorError').textContent), w.document.getElementById('dhorError').textContent);
}

{ // a duplicate mid-range gets the per-juz confirm; cancel stops cleanly
  const w = cardDom();
  w.eval("setDhorUnit('full'); DUP_AT = 1; CONFIRM_ANSWER = false;");
  w.document.getElementById('dhor_juz').value = '11';
  w.document.getElementById('dhor_juz').dispatchEvent(new w.Event('change'));
  w.document.getElementById('dhor_juz_to').value = '13';
  await w.pressSave(); await tick();
  check('duplicate: CANCEL stops before the duplicate juz and says where',
    /Juz 12/.test(w.eval('confirms')[0]) && /Saved Juz 11\. Stopped before Juz 12\./.test(w.document.getElementById('dhorError').textContent));
  const w2 = cardDom();
  w2.eval("setDhorUnit('full'); DUP_AT = 1; CONFIRM_ANSWER = true;");
  w2.document.getElementById('dhor_juz').value = '11';
  w2.document.getElementById('dhor_juz').dispatchEvent(new w2.Event('change'));
  w2.document.getElementById('dhor_juz_to').value = '13';
  await w2.pressSave(); await tick();
  check('duplicate: OK forces that juz and the range completes (3 juz + 1 forced retry)',
    w2.eval('saves').length === 4 && w2.eval('saves')[2].force === true && w2.eval('saves').filter(s => !s.force).length === 3);
}

// ---------- wiring assertions ----------
check('save path: the range branch sits in the NEW-save handler only (edit path untouched)',
  /if\(rangeTo && rangeTo > rangeFrom\)\{\n\s*return saveDhorJuzRange\(rangeFrom, rangeTo, errEl\);/.test(dhorSrc)
  && !/saveDhorJuzRange/.test(dhorSrc.slice(dhorSrc.indexOf('async function saveDhorEdit'), dhorSrc.indexOf('async function saveDhorJuzRange'))));
check('save path: raw-range mode never fans out', /!dhorRawRange && document\.getElementById\('dhor_unit'\)\.value === 'full'/.test(dhorSrc));
check('html: the to-select exists inside the juz row', /id="dhorJuzToField"/.test(read('index.html')) && /id="dhor_juz_to"/.test(read('index.html')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
