import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createDatabase,d1Database,seedStudent} from './helpers/database.mjs';
import worker from '../worker/src/index.js';
import {handleLogin} from '../worker/src/auth.js';

let passed=0;
const check=(label,value)=>{assert.ok(value,label);passed++;};
const request=body=>new Request('https://test/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const db=createDatabase();seedStudent(db,'S1',{name:'Synthetic learner'});
const env={DB:d1Database(db),HH_AUTH_SECRET:'synthetic-confirm-secret',HH_PEPPER:'synthetic-confirm-pepper',PROFILE_AUTHORITY:'academy'};
check('single entry cannot establish a PIN',(await handleLogin(request({id:'S1',pin:'4826'}),env)).code==='PIN_CONFIRMATION_REQUIRED');
check('single entry leaves the credential empty',db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash===null);
check('mismatched confirmation is rejected',(await handleLogin(request({id:'S1',pin:'4826',confirmPin:'4827'}),env)).code==='PIN_MISMATCH');
check('mismatch does not save the first entry',db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash===null);

function browser(path='/S1'){
  const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'https://confirmation-dev.test'+path});
  const w=dom.window;let boots=0,loginCalls=0;
  w.iconHtml=()=>'';w.showBanner=()=>{};w.bootApp=async()=>{boots++;w.showAppShell();};
  w.fetch=async(url,options={})=>{
    if(new URL(url).pathname==='/auth/login')loginCalls++;
    return worker.fetch(new Request(url,options),env,{});
  };
  w.eval(readFileSync(new URL('../js/api.js',import.meta.url),'utf8'));
  w.eval(readFileSync(new URL('../js/auth.js',import.meta.url),'utf8')+'\nwindow.pendingPinForTest=()=>pendingNewPin;');
  const fill=(prefix,pin)=>{for(let i=0;i<4;i++){const input=w.document.getElementById(prefix+(i+1));input.value=pin[i];input.dispatchEvent(new w.Event('input',{bubbles:true}));}};
  return {dom,w,fill,boots:()=>boots,loginCalls:()=>loginCalls};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));
const empty=(w,prefix)=>[1,2,3,4].every(i=>w.document.getElementById(prefix+i).value==='');
const hidden=(w,id)=>w.document.getElementById(id).classList.contains('hidden');
const b=browser();await b.w.routeToLoginScreen();
check('a reset or new personal link opens PIN creation',!hidden(b.w,'createPinScreen')&&!hidden(b.w,'createPinEntryWrap'));
b.fill('cr_pin_','4826');await flush();
check('first entry opens a distinct confirmation step',hidden(b.w,'createPinEntryWrap')&&!hidden(b.w,'confirmPinWrap'));
check('first-entry boxes are cleared when confirmation begins',empty(b.w,'cr_pin_'));
check('first entry sends no login request',b.loginCalls()===0);
check('first entry creates no server credential',db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash===null);
b.fill('cf_pin_','4827');await flush();
check('mismatch returns to the first step',!hidden(b.w,'createPinEntryWrap')&&hidden(b.w,'confirmPinWrap'));
check('mismatch clears both PIN entries',empty(b.w,'cr_pin_')&&empty(b.w,'cf_pin_'));
check('mismatch clears the first PIN from memory',b.w.pendingPinForTest()===null);
check('mismatch never submits a login',b.loginCalls()===0);
check('mismatch explains that setup must restart',b.w.document.getElementById('createPinError').textContent.includes('Start again'));
b.fill('cr_pin_','7391');b.fill('cf_pin_','7391');await flush();
check('matching entries submit once',b.loginCalls()===1);
check('matching entries establish a credential',!!db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash);
check('matching entries open the signed-in app',b.boots()===1);
check('successful setup clears the PIN from memory',b.w.pendingPinForTest()===null);
check('existing PIN still needs only one entry',(await handleLogin(request({id:'S1',pin:'7391'}),env)).data?.firstLogin===false);
check('mismatched first attempt was never retained',(await handleLogin(request({id:'S1',pin:'4826'}),env)).status===401);
b.w.close();

db.exec("UPDATE students SET pin_hash=NULL,failed_attempts=0,locked_until=NULL WHERE id='S1'");
const fallback=browser('/');fallback.w.showLoginScreenFallback('S1');fallback.fill('fb_pin_','4826');await flush();
check('ID-plus-PIN route also opens confirmation',!hidden(fallback.w,'createPinScreen')&&!hidden(fallback.w,'confirmPinWrap'));
check('ID-plus-PIN route cannot bypass confirmation',fallback.loginCalls()===0&&db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash===null);
fallback.fill('cf_pin_','4826');await flush();
check('ID-plus-PIN confirmation opens the app',fallback.boots()===1);
fallback.w.close();

const stale=browser();await stale.w.routeToLoginScreen();
check('an existing credential initially shows ordinary sign-in',!hidden(stale.w,'loginScreenPersonal'));
db.exec("UPDATE students SET pin_hash=NULL WHERE id='S1'");stale.fill('p_pin_','7391');await flush();
check('reset after page load still requires confirmation',!hidden(stale.w,'confirmPinWrap')&&db.prepare("SELECT pin_hash FROM students WHERE id='S1'").get().pin_hash===null);
check('reset confirmation clears the earlier sign-in boxes',empty(stale.w,'p_pin_')&&empty(stale.w,'fb_pin_'));
stale.fill('cf_pin_','7391');await flush();check('stale-screen reset succeeds only after confirmation',stale.boots()===1);
stale.w.close();

db.exec("UPDATE students SET pin_hash=NULL WHERE id='S1'");
const concurrent=await Promise.all(['4826','7391'].map(pin=>handleLogin(request({id:'S1',pin,confirmPin:pin}),env)));
check('concurrent setup has only one winner',concurrent.filter(result=>result.data?.firstLogin).length===1&&concurrent.filter(result=>result.code==='PIN_STATE_CHANGED').length===1);
console.log(passed+' passed, 0 failed');
