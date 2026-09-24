import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const read = f => readFileSync(new URL('../'+f, import.meta.url),'utf8');
let pass=0, fail=0;
const check=(name,ok)=>{if(ok)pass++;else{fail++;console.log('FAIL:',name);}};
const dom=new JSDOM(read('index.html'),{runScripts:'outside-only',url:'https://test.local'});
const w=dom.window;
w.EDIT_HANDLERS={};
const history=[
 {id:1,date:'2026-09-01',sabaq_from:'2:1',sabaq_to:'2:20'},
 {id:2,date:'2026-09-20',sabaq_from:'3:92',sabaq_to:'4:3'}
];
for(const name of ['iconHtml','renderTajweedPicker','renderCommentBlock','renderRecentEntries','exitEditScreenMode','enterEditScreenMode','moveDateIntoEditSlot','initEditFlow','teardownEditFlow','restoreDateFromEditSlot']) w[name]=()=>'';
w.logProfile=async()=>({mushaf:'13line',baseline_selection:[]});
w.logClient=()=>({get:async()=>history});
w.logDetailSelectedDate=()=> '2026-09-24';
w.todayISO=()=> '2026-09-24';
try {
 for(const f of ['shared/data.js','js/uiSwitch.js','js/position.js','js/sabaqDhorPage.js','js/maktabSummary.js'])w.eval(read(f) + (f==='js/maktabSummary.js' ? '\nwindow.setQuickState = value => { maktabQuickLogState = value; };' : ''));
 w.loadPosition=async()=>({});
 await w.renderSabaqDhorScreen();
 check('detail offers picker alongside suggested rows',!!w.document.getElementById('sdq_juz') && w.document.querySelectorAll('.sabaq-dhor-row-text').length>0);
 check('detail row includes Juz and Quarter',/^Juz 4 Quarter/.test(w.document.querySelector('.sabaq-dhor-row-text').textContent));
 const old=w.sabaqDhorPositionAtDate({},history,'waterval','2026-09-01');
 check('historical frontier excludes later Sabaq and includes selected day',old.sabaqTo.surah===2 && old.sabaqTo.ayah===20 && old.activeJuz===1);
 const empty=w.sabaqDhorPositionAtDate({},history,'waterval','2026-08-01');
 check('date before history has no invented frontier',empty.sabaqTo===null && empty.activeJuz===null);
 const reverse=w.sabaqDhorPositionAtDate({},[{date:'2026-09-01',sabaq_from:'113:1',sabaq_to:'114:6'}],'waterval','2026-09-01');
 check('Juz 30 keeps reverse learning direction',reverse.sabaqTo.surah===113 && reverse.sabaqTo.ayah===1);
 w.loadSabaqDhorEntryForEdit({id:10,date:'2026-09-20',from_surah:3,from_ayah:100,to_surah:3,to_ayah:110});
 check('opening edit preserves saved range',w.readSabaqDhorManualField('from').ayah===100 && w.readSabaqDhorManualField('to').ayah===110);
 check('edit also offers the portion picker',!!w.document.getElementById('sdq_juz'));
 const date=w.document.getElementById('sabaqDhor_date');date.value='2026-09-01';date.dispatchEvent(new w.Event('change'));
 check('edit date refreshes range from historical Sabaq',w.readSabaqDhorManualField('to').surah===2 && w.readSabaqDhorManualField('to').ayah===20);
 check('edit suggestions replace later juz', [...w.document.querySelectorAll('.sabaq-dhor-row-text')].every(e=>e.textContent.startsWith('Juz 1 ')));
 date.value='2026-08-01';date.dispatchEvent(new w.Event('change'));
 check('no-history edit date clears stale prepopulation',w.readSabaqDhorManualField('from')===null && w.readSabaqDhorManualField('to')===null);
 const juz=w.document.getElementById('sdq_juz');juz.value='2';juz.dispatchEvent(new w.Event('change'));
 const confirm=w.document.getElementById('sdq_confirm');confirm.checked=true;confirm.dispatchEvent(new w.Event('change'));
 const bounds=w.structuralQuarterBounds(2,1,'waterval');
 check('edit picker confirmation applies selected range',w.readSabaqDhorManualField('from').ayah===bounds.startAyah && w.readSabaqDhorManualField('to').ayah===bounds.endAyah);
 w.apiGetMaktabSabaq=async()=>history;w.apiGetMaktabDhor=async()=>[];w.apiGetMaktabPosition=async()=>null;
 const planning=await w.maktabQuickPlanningDefaults('S1','waterval','2026-09-01');
 check('Quick Action planning uses the selected date',planning.sabaqDhorRows.length>0 && planning.sabaqDhorRows.every(r=>w.sabaqDhorRowLabel(r,'waterval').startsWith('Juz 1 ')));
 w.setQuickState({ref:'waterval',sabaqDhorRows:planning.sabaqDhorRows,sabaqDhorPicker:{juz:1,quarter:1}});
 const quick=w.maktabQuickSabaqDhorHtml();
 check('Quick Action includes Juz labels and picker with history',quick.includes('Juz 1 Quarter') && quick.includes('id="mql_sd_juz"'));
 w.loadMaktabSettings=async()=>({mushaf:'13line'});
 w.apiMaktabSummary=async()=>({students:[],sabaq:[],sabaq_dhor:[],dhor:[]});
 await w.maktabOpenQuickLog({id:'S1',name:'Student'},'2026-09-24','sabaqDhor',[],null,{combined:true});
 await w.maktabQuickChangeDate('2026-09-01');
 check('Quick Action date change replaces rendered suggestions', [...w.document.querySelectorAll('.maktab-quick-sd-row-pill')].every(e=>e.textContent.startsWith('Juz 1 ')) && w.document.querySelectorAll('.maktab-quick-sd-row-pill').length>0);
 await w.maktabQuickChangeDate('2026-08-01');
 check('Quick Action before history keeps picker but clears rows',w.document.querySelectorAll('.maktab-quick-sd-row-pill').length===0 && !!w.document.getElementById('mql_sd_juz'));
 w.cancelSabaqDhorEdit();
 check('leaving edit restores current-date suggestions',w.document.querySelector('.sabaq-dhor-row-text').textContent.startsWith('Juz 4 '));
 check('existing Juz labels are not duplicated',w.sabaqDhorRowLabel({label:'Juz 2 (complete)'},'waterval')==='Juz 2 (complete)');
} catch(e){fail++;console.log('FAIL:',e.stack);}
finally {w.close();}
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
