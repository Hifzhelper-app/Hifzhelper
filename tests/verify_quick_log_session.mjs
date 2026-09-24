import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, condition) {
  try { assert.ok(condition, name); pass++; }
  catch { fail++; console.log('FAIL:', name); }
}
const dom = new JSDOM('<!doctype html><body></body>', { runScripts:'dangerously', url:'https://test.local/' });
const w = dom.window;
w.eval(read('shared/data.js'));
w.eval(`
function iconHtml(){ return ''; }
function journalCellShorthand(type, rows){ return rows.map(r => r.id).join(','); }
function apiGetMaktabSabaq(){ return Promise.resolve([]); }
function loadMaktabSettings(){ return Promise.resolve({mushaf:'13line'}); }
`);
w.eval(read('js/maktabSummary.js') + '\nwindow.testState = () => maktabQuickLogState;');
let posts = [], rows = {sabaq:[],sabaq_dhor:[],dhor:[]}, refreshes = 0;
let postError = false, readError = false, duplicate = false, pending = null;
w.maktabQuickPlanningDefaults = async () => ({sabaqDefaults:{from:{surah:2,ayah:6},to:{surah:2,ayah:6}},sabaqDhorRows:[]});
w.maktabQuickSyncSabaqPosition = async () => {};
w.apiMaktabSummary = async () => {
  if(readError) throw Error('offline');
  return {students:[{id:'A'}],...rows};
};
w.renderMaktabSummaryScreen = async () => { refreshes++; };
w.apiFetch = async (path, options) => {
  const payload = JSON.parse(options.body);
  posts.push({path,payload});
  if(pending) await pending;
  if(postError) throw Error('offline');
  if(duplicate && !payload.force) return {isDuplicate:true};
  const row = {...payload,id:posts.length};
  rows[path.endsWith('sabaq-dhor') ? 'sabaq_dhor' : path.split('/').at(-1)].push(row);
  return row;
};
const student = {id:'A',name:'Student A'};
const open = opts => w.maktabOpenQuickLog(student,'2026-09-24','sabaq',[],{sabaq:[],sabaqDhor:[],dhor:[]},{combined:true,...opts});
const confirm = () => {w.document.getElementById('maktabQuickLogConfirm').checked=true;};
const sheet = () => w.document.getElementById('maktabQuickLogSheet');
try {
  await open();
  const first = sheet();
  confirm(); await w.maktabSaveQuickLog();
  check('Sabaq save keeps the same window, student and date', sheet()===first && w.testState().student.id==='A' && w.testState().date==='2026-09-24');
  check('successful save refreshes caller and shows saved status', refreshes===1 && /Sabaq saved/.test(w.document.getElementById('maktabQuickLogStatus').textContent));
  check('saved entries refresh in the open window', /Already logged/.test(w.document.getElementById('maktabQuickExisting').textContent));
  check('Sabaq planning refreshes without retaining confirmation', w.testState().drafts.sabaq.from.ayah===6 && !w.document.getElementById('maktabQuickLogConfirm').checked);
  await w.maktabSaveQuickLog();
  check('a second save needs confirmation', posts.length===1);
  confirm(); await w.maktabSaveQuickLog();
  check('multiple Sabaq entries save in one session', posts.length===2 && sheet()===first);
  w.document.querySelector('[data-mql-type="sabaqDhor"]').click();
  w.document.getElementById('mql_sd_picker_confirm').checked=true;
  await w.maktabSaveQuickLog();
  check('Sabaq Dhor saves without closing and clears its selection', posts.at(-1).path==='/maktab/sabaq-dhor' && sheet()===first && !w.document.getElementById('mql_sd_picker_confirm').checked);
  w.document.querySelector('[data-mql-type="dhor"]').click();
  const juz=w.document.getElementById('mql_dhor_juz');juz.value='2';juz.dispatchEvent(new w.Event('change'));
  confirm(); await w.maktabSaveQuickLog();
  check('Dhor saves without closing and retains the selected Juz', posts.at(-1).path==='/maktab/dhor' && sheet()===first && w.document.getElementById('mql_dhor_juz').value==='2');
  check('all entries retain student and selected date', posts.every(p=>p.payload.student_id==='A' && p.payload.date==='2026-09-24'));
  postError=true;confirm();await w.maktabSaveQuickLog();
  check('failed write keeps draft and confirmation for retry', sheet()===first && w.document.getElementById('maktabQuickLogConfirm').checked && /Couldn't save/.test(w.document.getElementById('maktabQuickLogError').textContent));
  postError=false;duplicate=true;w.confirm=()=>false;
  const count=posts.length;await w.maktabSaveQuickLog();
  check('cancelled duplicate does not force a write or close', posts.length===count+1 && sheet()===first && !w.document.getElementById('maktabQuickLogSave').disabled);
  w.confirm=()=>true;await w.maktabSaveQuickLog();
  check('confirmed duplicate preserves force-save flow', posts.at(-1).payload.force===true && sheet()===first);
  duplicate=false;readError=true;confirm();await w.maktabSaveQuickLog();
  check('refresh failure distinguishes committed save from failed write', /Entry saved, but/.test(w.document.getElementById('maktabQuickLogError').textContent) && !w.document.getElementById('maktabQuickLogConfirm').checked);
  readError=false;
  let release;pending=new Promise(resolve=>{release=resolve;});confirm();
  const active=w.maktabSaveQuickLog();const before=posts.length;
  await w.maktabSaveQuickLog();
  check('double-click cannot send another in-flight write', posts.length===before);
  check('date and type controls are locked during save; close remains usable', w.document.getElementById('maktabQuickLogDate').disabled && w.document.querySelector('[data-mql-type="sabaq"]').disabled && !sheet().querySelector('.close-btn').disabled);
  sheet().querySelector('.close-btn').click();
  check('Close independently dismisses the window', !sheet());
  await w.maktabOpenQuickLog({id:'B',name:'Student B'},'2026-09-25','sabaq',[],null,{combined:true});
  const replacement=sheet();release();pending=null;await active;
  check('old save cannot close or alter a replacement student window', sheet()===replacement && w.testState().student.id==='B' && w.document.getElementById('maktabQuickLogStatus').textContent==='');
  let callbacks=0;
  await open({afterSave:async()=>{callbacks++;}});confirm();await w.maktabSaveQuickLog();
  check('Student Summary caller callback refreshes without closing', callbacks===1 && !!sheet());
  w.maktabCloseQuickLog();
} catch(error) { fail++; console.log('FAIL:',error.stack); }
finally { dom.window.close(); }
console.log(`${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
