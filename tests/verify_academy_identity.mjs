import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { createDatabase, d1Database, seedStudent } from './helpers/database.mjs';
import { buildIdentityPlan, applyIdentityPlan } from '../worker/tools/academy-identity.mjs';
import { handleLogin, handleLookup, authenticate, verifyToken, handleRegister, handleAuthPolicy } from '../worker/src/auth.js';
import { handleGetProfile, handleSaveProfile } from '../worker/src/profile.js';
import { handleChangeRole, handleUpdateUser, handleDeleteUser, handleRegisterStudent, handleCreateTeachingProfile } from '../worker/src/admin.js';
import { handleGetSabaq } from '../worker/src/sabaqLog.js';

let pass = 0;
const check = (label,condition) => { assert.ok(condition,label); pass++; };
const request = body => new Request('https://test/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const ids = { S1:'11111111-1111-4111-8111-111111111111', T:'22222222-2222-4222-8222-222222222222', A:'33333333-3333-4333-8333-333333333333' };
const academy = Object.entries(ids).map(([login_link_id,account_id]) => ({login_link_id,account_id,active:1}));
const profiles = db => db.prepare('SELECT id,login_id,name,role,active FROM students ORDER BY id').all();
function fixture() {
  const db=createDatabase();
  seedStudent(db,'S1',{name:'Learner',role:'student'});
  seedStudent(db,'T',{name:'Teacher',role:'teacher'});
  seedStudent(db,'A',{name:'Admin',role:'admin'});
  seedStudent(db,'ARCHIVE',{name:'Retired learner',active:0});
  return { db,env:{DB:d1Database(db),HH_AUTH_SECRET:'synthetic-hifz-token-secret',HH_PEPPER:'synthetic-hifz-pin-pepper'} };
}
const {db,env}=fixture();
const beforeLogin=await handleLogin(request({id:'S1',pin:'4826'}),env);
check('existing login code still sets the Hifz PIN locally',beforeLogin.data?.firstLogin===true);
const hashBefore=db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash;
const plan=buildIdentityPlan(profiles(db),academy,'test');
check('all active profiles map by exact login code',plan.mappings.length===3);
check('unmatched inactive history is retained explicitly',plan.retainedInactive.join(',')==='ARCHIVE');
assert.throws(()=>buildIdentityPlan(profiles(db),academy.slice(1),'test'),/missing from Academy/); pass++;
assert.throws(()=>buildIdentityPlan(profiles(db),[...academy,academy[0]],'test'),/duplicate/); pass++;
assert.throws(()=>buildIdentityPlan(profiles(db),academy.map(a=>({...a,active:0})),'test'),/inactive Academy/); pass++;

// Populate every table carrying a declared profile reference. Optional actor
// fields are populated too, so forgotten feedback/comment keys cannot hide.
db.exec('CREATE TABLE future_identity_reference (owner TEXT REFERENCES students(id), actor TEXT REFERENCES students(id), note TEXT)');
const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'academy_identity_%'").all();
const refs = new Map();
for (const table of tables) {
  const keys=db.prepare('PRAGMA foreign_key_list("'+table.name+'")').all().filter(k=>k.table==='students'&&k.to==='id');
  refs.set(table.name,keys.map(k=>k.from));
  if (!keys.length) continue;
  const columns=db.prepare('PRAGMA table_info("'+table.name+'")').all();
  const row={};
  for (const key of keys) row[key.from]=/student_id|owner/.test(key.from)?'S1':'T';
  for (const col of columns) {
    if (col.name in row || col.dflt_value!==null || (!col.notnull && !col.pk) || col.name==='id' && col.type==='INTEGER') continue;
    row[col.name]=/date/.test(col.name)?'2026-10-10':/created_at|updated_at/.test(col.name)?'2026-10-10T12:00:00Z':/json/.test(col.name)?'{"unchanged":"S1"}':col.name==='status'?'present':['log_type','plan_type'].includes(col.name)?'sabaq':col.type==='INTEGER'?1:'synthetic';
  }
  if (columns.some(c=>c.name==='student_comment')) row.student_comment='Keep literal S1 in this note';
  if (columns.some(c=>c.name==='note')) row.note='Keep literal S1 in this note';
  const names=Object.keys(row);
  db.prepare('INSERT INTO "'+table.name+'" ('+names.map(n=>'"'+n+'"').join(',')+') VALUES ('+names.map(()=>'?').join(',')+')').run(...Object.values(row));
}
const dump=()=>Object.fromEntries(tables.map(t=>[t.name,db.prepare('SELECT * FROM "'+t.name+'" ORDER BY rowid').all().map(r=>({...r}))]));
const before=dump();
const migrated=await applyIdentityPlan(env.DB,plan,'test');
check('cutover covers every declared owner and actor column',migrated.referenceColumns>20);
check('migration stays within the Free-plan query budget',migrated.statementCount<=50);
const expected=structuredClone(before);
for (const [table,rows] of Object.entries(expected)) {
  for (const row of rows) {
    for (const column of refs.get(table)) if (ids[row[column]]) row[column]=ids[row[column]];
    if (table==='students' && ids[row.id]) { row.id=ids[row.id]; row.academy_managed=1; }
  }
}
assert.deepEqual(dump(),expected,'every record and non-identity value survives exactly'); pass++;
check('all foreign keys remain valid',db.prepare('PRAGMA foreign_key_check').all().length===0);
check('PIN hash is preserved byte for byte',db.prepare('SELECT pin_hash FROM students WHERE id=?').get(ids.S1).pin_hash===hashBefore);
check('login alias remains the original student code',db.prepare('SELECT login_id FROM students WHERE id=?').get(ids.S1).login_id==='S1');
check('literal notes are not rewritten as identity references',db.prepare('SELECT note FROM future_identity_reference').get().note==='Keep literal S1 in this note');
check('inactive unmapped account and its login are preserved',db.prepare("SELECT login_id FROM students WHERE id='ARCHIVE'").get().login_id==='ARCHIVE');
check('migration can be retried without a second rekey',(await applyIdentityPlan(env.DB,plan,'test')).alreadyApplied===true);
check('one audit receipt and no leftover guards',db.prepare('SELECT COUNT(*) AS n FROM academy_identity_migrations').get().n===1&&db.prepare('SELECT COUNT(*) AS n FROM academy_identity_guards').get().n===0);
await assert.rejects(()=>applyIdentityPlan(env.DB,plan,'production'),/environment mismatch/); pass++;
const login=await handleLogin(request({id:'S1',pin:'4826'}),env);
check('same personal login and PIN open the migrated account',login.data?.id===ids.S1&&login.data?.login_id==='S1');

const teacherFirst=await handleLogin(request({id:'T',pin:'7391'}),env);
check('first PIN setup after migration targets the permanent row',teacherFirst.data?.firstLogin===true&&!!db.prepare('SELECT pin_hash FROM students WHERE id=?').get(ids.T).pin_hash);
let wrong;
for(let attempt=1;attempt<=5;attempt++) {
  wrong=await handleLogin(request({id:'T',pin:'0000'}),env);
  check('failed PIN attempt '+attempt+' is stored against permanent user',db.prepare('SELECT failed_attempts FROM students WHERE id=?').get(ids.T).failed_attempts===attempt);
}
check('five wrong PINs lock the migrated account',wrong.status===429&&!!db.prepare('SELECT locked_until FROM students WHERE id=?').get(ids.T).locked_until);
check('correct PIN cannot bypass active lockout',(await handleLogin(request({id:'T',pin:'7391'}),env)).status===429);
db.prepare('UPDATE students SET locked_until=? WHERE id=?').run('2000-01-01T00:00:00Z',ids.T);
check('correct PIN succeeds once the lockout expires',(await handleLogin(request({id:'T',pin:'7391'}),env)).data?.id===ids.T);
const clearedLock=db.prepare('SELECT failed_attempts,locked_until FROM students WHERE id=?').get(ids.T);
check('successful PIN clears bookkeeping on permanent user',clearedLock.failed_attempts===0&&clearedLock.locked_until===null);

check('successful existing PIN is not reset',login.data?.firstLogin===false&&db.prepare('SELECT pin_hash FROM students WHERE id=?').get(ids.S1).pin_hash===hashBefore);
const payload=await verifyToken(login.data.token,env.HH_AUTH_SECRET);
check('session token identifies the permanent owner',payload?.id===ids.S1&&payload.identity_version===2);
const authRequest=new Request('https://test/profile',{headers:{Authorization:'Bearer '+login.data.token}});
const auth=await authenticate(authRequest,env);
check('authenticated requests resolve locally to the permanent ID',auth?.id===ids.S1);
check('pre-cutover session is rejected',await authenticate(new Request('https://test/profile',{headers:{Authorization:'Bearer '+beforeLogin.data.token}}),env)===null);
check('permanent user ID is not accepted as a login alias',(await handleLogin(request({id:ids.S1,pin:'4826'}),env)).status===401);
check('public lookup resolves the login alias',(await handleLookup(new Request('https://test/auth/lookup?id=S1'),env)).data?.name==='Learner');
check('public lookup does not expose the permanent ID',(await handleLookup(new Request('https://test/auth/lookup?id='+ids.S1),env)).status===404);
const profile=(await handleGetProfile(new Request('https://test/profile'),env,auth)).data;
check('profile returns permanent ID and distinct login alias',profile.id===ids.S1&&profile.login_id==='S1'&&profile.academy_managed===1);
check('own journal remains available',(await handleGetSabaq(new Request('https://test/sabaq'),env,auth)).data.length>0);
check('learner cannot request another person’s journal',(await handleGetSabaq(new Request('https://test/sabaq?student_id='+ids.T),env,auth)).status===403);
const adminAuth={id:ids.A,role:'admin'};

check('registration policy becomes Academy-owned after cutover',(await handleAuthPolicy(request({}),env)).data.academy_profiles_only===true);
check('public registration cannot create an unmatched user',(await handleRegister(request({name:'Extra learner'}),env)).status===403);
check('local admin registration is closed',(await handleRegisterStudent(request({name:'Extra learner'}),env,adminAuth)).status===403);
check('local teaching-profile creation is closed',(await handleCreateTeachingProfile(request({id:ids.S1}),env,adminAuth)).status===403);
check('inactive legacy profiles cannot bypass Academy ownership',(await handleUpdateUser(request({id:'ARCHIVE',active:true}),env,adminAuth)).status===403);

check('Hifz admin cannot change an Academy-owned name',(await handleUpdateUser(request({id:ids.S1,name:'Changed'}),env,adminAuth)).status===403);
check('Hifz admin cannot change an Academy-owned role',(await handleChangeRole(request({id:ids.S1,role:'admin'}),env,adminAuth)).status===403);
check('Hifz admin cannot deactivate an Academy-owned account',(await handleUpdateUser(request({id:ids.S1,active:false}),env,adminAuth)).status===403);
check('Hifz admin cannot delete a linked account',(await handleDeleteUser(new Request('https://test/admin/users?id='+ids.S1),env,adminAuth)).status===403);
check('learner cannot change an Academy-owned name',(await handleSaveProfile(request({name:'Changed'}),env,auth)).status===403);
check('Hifz journal settings remain editable',(await handleSaveProfile(request({journal_name:'My preserved journal'}),env,auth)).data?.saved===true);
check('tampered tokens are rejected',await verifyToken(login.data.token+'x',env.HH_AUTH_SECRET)===null);
check('malformed tokens are rejected',await verifyToken('not.base64.extra',env.HH_AUTH_SECRET)===null);
db.prepare('UPDATE students SET role=? WHERE id=?').run('teacher',ids.S1);
check('current local permissions replace stale token roles',(await authenticate(authRequest,env)).role==='teacher');
db.prepare('UPDATE students SET active=0 WHERE id=?').run(ids.S1);
check('local deactivation blocks an existing session',await authenticate(authRequest,env)===null);
db.prepare('UPDATE students SET active=1,role=?,login_id=? WHERE id=?').run('student','RENAMED',ids.S1);
check('changing the login alias keeps the same permanent owner',(await handleLogin(request({id:'RENAMED',pin:'4826'}),env)).data?.id===ids.S1);
check('old alias no longer logs in',(await handleLogin(request({id:'S1',pin:'4826'}),env)).status===401);
check('journal owner remains unchanged after alias change',db.prepare('SELECT student_id FROM sabaq_log LIMIT 1').get().student_id===ids.S1);

// A changed profile invalidates the reviewed plan; no partial rekey survives.
const stale=fixture(), stalePlan=buildIdentityPlan(profiles(stale.db),academy,'test');
stale.db.prepare("UPDATE students SET role='teacher' WHERE id='S1'").run();
const staleBefore=JSON.stringify(profiles(stale.db));
await assert.rejects(()=>applyIdentityPlan(stale.env.DB,stalePlan,'test'),/CHECK/); pass++;
check('stale migration rolls back every profile update',JSON.stringify(profiles(stale.db))===staleBefore);
check('failed migration leaves no receipt or guard',stale.db.prepare('SELECT COUNT(*) AS n FROM academy_identity_migrations').get().n===0&&stale.db.prepare('SELECT COUNT(*) AS n FROM academy_identity_guards').get().n===0);

// Drive the real boot function: aliases select URLs, permanent IDs select data.
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const boot=app.slice(app.indexOf('async function bootApp(){'),app.indexOf('// Back/forward guard'));
for (const expectedAlias of ['S1','SOMEONEELSE']) {
  const remembered=[];
  const context={showAppShell(){},apiGetProfile:async()=>profile,getEffectiveLoginId:()=>expectedAlias,
    cleared:0,clearToken(){this.cleared++;},routeToLoginScreen(){},rememberLoginId:id=>remembered.push(id),
    rememberKnownAccount:row=>remembered.push(row.id),loadTajweedVocabulary:async()=>{},currentUser:{},
    setupAuthBandAndDropdown(){},renderAuthBand(){},showWelcome(){},armBackGuard(){},showScreen(){},showBanner(){}};
  // Plain callbacks capture context explicitly; calls from a classic script
  // should not depend on JavaScript's receiver binding.
  context.clearToken=()=>context.cleared++;
  vm.createContext(context); vm.runInContext(boot,context); await context.bootApp();
  if (expectedAlias==='S1') {
    check('matching URL alias does not log out a distinct permanent ID',context.cleared===0&&context.currentUser.id===ids.S1);
    check('remembered links and switcher entries use only login ID',remembered.length===2&&remembered.every(id=>id==='S1'));
  } else check('different account URL is still rejected',context.cleared===1&&remembered.length===0);
}

// The real admin renderer uses the alias in links and the permanent ID in
// operations; ownership locks leave Hifz teaching settings available.
const dom=new JSDOM('<body><button id="adminRegisterOpenBtn"></button><input id="admin_search"><div id="adminUsersList"></div></body>',{runScripts:'outside-only',url:'https://test.local'});
const w=dom.window, copied=[],reset=[];
w.matchMedia=()=>({matches:false}); w.iconHtml=()=>''; w.showBanner=()=>{}; w.confirm=()=>true;
w.apiAdminListUsers=async()=>[{id:ids.S1,login_id:'S1',name:'Learner',role:'student',active:1,academy_managed:1,academy_profiles_only:1}];
w.apiGetMaktabGroups=async()=>[]; w.apiAdminResetPin=async id=>reset.push(id);
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)}});
w.eval(readFileSync(new URL('../js/uiSwitch.js',import.meta.url),'utf8'));
w.eval(readFileSync(new URL('../js/adminPage.js',import.meta.url),'utf8'));
await w.loadAdminUsers(); await new Promise(resolve=>setTimeout(resolve,0));
const row=w.document.querySelector('.admin-row-fields');
check('local registration control is hidden',w.document.getElementById('adminRegisterOpenBtn').hidden);
check('admin displays the login ID instead of the permanent key',row.querySelector('.admin-cell-id').textContent==='S1');
check('shared name and contact inputs are read only',row.querySelector('[data-f="name"]').readOnly&&row.querySelector('[data-f="whatsapp_number"]').readOnly);
check('shared role and activation controls are disabled',row.querySelector('[data-f="role"]').disabled&&row.querySelector('[data-f="active"]').disabled);
check('linked profile has no local delete control',!row.querySelector('[data-delete]'));
check('Hifz group assignment remains editable',!row.querySelector('[data-f="group_id"]').disabled);
row.querySelector('[data-copy-url]').click(); await new Promise(resolve=>setTimeout(resolve,0));
check('personal URL uses the login alias',copied[0]==='https://test.local/S1');
row.querySelector('[data-reset-pin]').click(); await new Promise(resolve=>setTimeout(resolve,0));
check('local PIN operation targets the permanent user ID',reset[0]===ids.S1);
w.close();

console.log(pass+' passed, 0 failed');
