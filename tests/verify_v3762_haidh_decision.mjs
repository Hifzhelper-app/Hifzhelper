#!/usr/bin/env node
// V4.2.14 supersession of V3.76.2: the teacher purity-gap override/decision
// bar is retired. Purity is global; explicit teacher Absent remains supported.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { handleMarkHaidhRange } from '../worker/src/attendance.js';
import { haidhAddDaysISO } from '../shared/haidhRules.js';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
let pass=0,fail=0;
const check=(l,c,x='')=>{if(c)pass++;else{fail++;console.log('FAIL:',l,x);}};
const TODAY=new Date().toISOString().slice(0,10);
const day=n=>haidhAddDaysISO(TODAY,n);

function makeDb(){
  const db=new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY,role TEXT,gender TEXT,track_haidh INTEGER DEFAULT 0,haidh_ruling TEXT DEFAULT 'hanafi',haidh_cycle_length INTEGER,haidh_period_length INTEGER,haidh_next_expected TEXT);
    CREATE TABLE attendance (student_id TEXT,date TEXT,status TEXT,PRIMARY KEY(student_id,date));
    CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
    CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
    CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
    INSERT INTO students (id,role,haidh_cycle_length,haidh_period_length) VALUES ('STU1','student',28,5),('TCH1','teacher',NULL,NULL);
  `);
  const stmt=(sql,args)=>({
    async run(){const r=db.prepare(sql).run(...args);return{meta:{last_row_id:Number(r.lastInsertRowid)}};},
    async first(){return db.prepare(sql).get(...args)??null;},
    async all(){return{results:db.prepare(sql).all(...args)};},
  });
  const DB={prepare(sql){return{bind(...args){return Object.assign(stmt(sql,args),{_sql:sql,_args:args});}};},async batch(list){for(const s of list)db.prepare(s._sql).run(...s._args);return[];}};
  const put=(d,status)=>db.prepare('INSERT INTO attendance VALUES (?,?,?)').run('STU1',d,status);
  const rows=()=>db.prepare('SELECT date,status FROM attendance WHERE student_id=? ORDER BY date').all('STU1');
  return {env:{DB},put,rows};
}
const T={id:'TCH1',role:'teacher'}, S={id:'STU1',role:'student'};
const req=(body)=>({json:async()=>body,url:'https://x/'});

{
  const {env,put,rows}=makeDb();
  for(let n=-12;n<=-10;n++)put(day(n),'haidh');
  const plain=await handleMarkHaidhRange(req({student_id:'STU1',startDate:day(-2),endDate:day(0)}),env,T);
  const over=await handleMarkHaidhRange(req({student_id:'STU1',startDate:day(-2),endDate:day(0),override_gap:true}),env,T);
  check('gap refusal still carries haidh_gap',plain.error&&plain.code==='haidh_gap');
  check('teacher override_gap is ignored/retired',over.error&&over.code==='haidh_gap'&&rows().filter(r=>r.status==='haidh').length===3,JSON.stringify(over));
}
{
  const {env,put,rows}=makeDb();
  for(let n=-12;n<=-10;n++)put(day(n),'haidh');
  const r=await handleMarkHaidhRange(req({student_id:'STU1',startDate:day(-2),endDate:day(0),status:'absent'}),env,T);
  check('teacher may still explicitly mark the selected range Absent',!r.error&&r.data.status==='absent'&&rows().filter(x=>x.status==='absent').length===3,JSON.stringify(r));
}
{
  const {env,put,rows}=makeDb();
  for(let n=-12;n<=-10;n++)put(day(n),'haidh');
  const r=await handleMarkHaidhRange(req({startDate:day(-2),endDate:day(0),status:'absent'}),env,S);
  check('student cannot use teacher Absent mode to bypass Haidh validation',r.error&&r.code==='haidh_gap'&&rows().every(x=>x.status!=='absent'));
}

const cal=read('js/haidhDetailScreen.js');
const api=read('js/api.js');
const html=read('index.html');
check('calendar no longer branches gap refusals into a teacher decision bar',!/'haidh_gap'[\s\S]*haidhShowDecision/.test(cal)&&!/function haidhShowDecision/.test(cal));
check('API no longer sends override_gap',!/body\.override_gap/.test(api)&&!/opts\.overrideGap/.test(api));
check('obsolete “Mark as haidh anyway” control is removed from HTML',!/Mark as haidh anyway/.test(html)&&!/haidhDecisionHaidhBtn/.test(html));
check('worker still propagates structured error codes through respond()',/error\(result\.error, result\.status \|\| 400, result\.code\)/.test(read('worker/src/index.js')));
check('apiFetch still attaches worker error code to thrown Error',/if\(body && body\.code\) err\.code = body\.code;/.test(api));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
