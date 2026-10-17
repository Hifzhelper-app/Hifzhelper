import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/api.js',import.meta.url),'utf8');let passed=0;
async function check(host,expected,{blocked=false,override=null}={}){
 const calls=[];const context=vm.createContext({location:{hostname:host,pathname:'/hbnaidu'},localStorage:{getItem(){if(blocked)throw new Error('Storage disabled');return override;}},sessionStorage:{getItem:()=>null},fetch:async(url)=>{calls.push(url);return {ok:true,status:200,json:async()=>({name:'Synthetic learner',hasPin:true})};}});
 vm.runInContext(source,context);await vm.runInContext("apiLookup('hbnaidu')",context);
 assert.equal(new URL(calls[0]).origin,expected,host);assert.equal(new URL(calls[0]).searchParams.get('id'),'hbnaidu');passed+=2;
}
const dev='https://hifzhelper-api-dev.hifzhelper-app.workers.dev',production='https://hifzhelper-api.hifzhelper-app.workers.dev';
for(const host of ['hifz.maktab4life.org','hifzhelper-dev.pages.dev','release.hifzhelper-dev.pages.dev','localhost','127.0.0.1'])await check(host,dev);
for(const host of ['maktab.hifz-helper.app','hifzhelper.pages.dev'])await check(host,production);
await check('hifz.maktab4life.org',dev,{blocked:true});await check('hifzhelper-dev.pages.dev',dev,{blocked:true});await check('maktab.hifz-helper.app',production,{blocked:true});
await check('hifz.maktab4life.org','https://deliberate-override.test',{override:'https://deliberate-override.test'});
console.log(passed+' passed, 0 failed');
