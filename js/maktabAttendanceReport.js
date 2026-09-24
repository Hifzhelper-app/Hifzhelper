/* Hifzhelper build 4.2.15.20 | js/maktabAttendanceReport.js */
// Read-only report: uses the register's normalized cells, percentages and sort.
let mkAttendanceReport = null;
function mkAttendanceReportPreset(mode, today){
  return {from: mode === 'month' ? today.slice(0,8)+'01' : mkregMondayOf(today), to:today};
}
function mkAttendanceReportRows(data, sort){
  return mkregSortStudents(data.students, data.today, data.weeks, sort, sort === 'attendance' ? 'desc' : 'asc', data.from, data.to);
}
function mkAttendanceReportMark(student, column){
  const status = (student.cells || {})[column.date];
  if(status === 'present') return {text:'✓',color:'#568527',label:'Present / logged'};
  if(status === 'haidh') return {text:'H',color:'#77796f',label:'Confirmed Haidh'};
  if(status === 'predicted-haidh') return {text:'h',color:'#77796f',label:'Predicted Haidh'};
  return {text:'',color:'#333',label:column.future ? 'Not yet recorded' : column.no_maktab_day ? 'No maktab day' : 'Absent'};
}
function mkAttendanceReportPages(data, sort){
  const columns=data.weeks.flatMap(w=>w.columns);
  const students=mkAttendanceReportRows(data,sort);
  const pages=[];
  for(let c=0;c<columns.length;c+=20) for(let r=0;r<students.length;r+=30)
    pages.push({columns:columns.slice(c,c+20), students:students.slice(r,r+30)});
  return pages;
}
function mkAttendanceReportCanvas(data,page,index,total){
  const canvas=document.createElement('canvas');
  const cell=54,nameWidth=300,pctWidth=90,left=24,top=130;
  let rowHeight=36;
  canvas.width=Math.max(860,left*2+nameWidth+pctWidth+page.columns.length*cell);
  const ctx=canvas.getContext('2d');
  if(!ctx) throw Error('Image export is unavailable in this browser.');
  ctx.font='16px sans-serif';
  const names=page.students.map(s=>maktabDailyReportWrapText(ctx,s.name,nameWidth-16));
  rowHeight=Math.max(36,...names.map(lines=>lines.length*20+16));
  canvas.height=top+(page.students.length+1)*rowHeight+80;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#344C3D';ctx.font='bold 24px sans-serif';ctx.fillText('Maktab Attendance Report',left,36);
  ctx.font='16px sans-serif';ctx.fillText(`${data.from} to ${data.to} · Page ${index+1} of ${total}`,left,64);
  ctx.fillText('✓ Present/logged · H Confirmed Haidh · h Predicted Haidh',left,92);
  const widths=[nameWidth,pctWidth,...page.columns.map(()=>cell)];
  const drawRow=(values,y,header,student)=>{
    let x=left;
    values.forEach((value,i)=>{
      const col=page.columns[i-2];
      ctx.fillStyle=header ? '#829672' : col?.no_maktab_day ? '#eeeeea' : '#fff';ctx.fillRect(x,y,widths[i],rowHeight);
      ctx.strokeStyle='#ddd';ctx.strokeRect(x,y,widths[i],rowHeight);
      ctx.save();ctx.beginPath();ctx.rect(x+5,y,widths[i]-10,rowHeight);ctx.clip();
      ctx.fillStyle=student && col ? mkAttendanceReportMark(student,col).color : '#30352e';
      ctx.font=header ? 'bold 14px sans-serif':'16px sans-serif';
      ctx.textAlign=i===0 ? 'left':'center';
      if(i===0 && student){
        maktabDailyReportWrapText(ctx,value,widths[i]-16).forEach((line,j)=>ctx.fillText(line,x+8,y+22+j*20));
      } else ctx.fillText(value,i===0?x+8:x+widths[i]/2,y+24);
      ctx.restore();x+=widths[i];
    });
  };
  drawRow(['Student','Attendance',...page.columns.map(c=>c.date.slice(8)+'/'+c.date.slice(5,7))],top,true);
  page.students.forEach((s,i)=>drawRow([s.name,s.attendance_percent==null?'—':`${s.attendance_percent}%`,...page.columns.map(c=>mkAttendanceReportMark(s,c).text)],top+(i+1)*rowHeight,false,s));
  ctx.fillStyle='#777';ctx.font='14px sans-serif';ctx.textAlign='left';ctx.fillText('Grey: no Maktab day · Blank: absent or not yet recorded',left,canvas.height-25);
  return canvas;
}
async function mkAttendanceReportRender(state){
  const token=++state.token;
  const host=document.getElementById('marPreview'), share=document.getElementById('marShare'), status=document.getElementById('marStatus');
  state.files=[];share.disabled=true;
  const data=state.data;
  const columns=data.weeks.flatMap(w=>w.columns), rows=mkAttendanceReportRows(data,state.sort);
  if(!columns.length || !rows.length){host.textContent='No students or teaching days in this period.';status.textContent='';return;}
  host.innerHTML=`<h3>${mkregEsc(data.from)} to ${mkregEsc(data.to)}</h3><div class="attendance-report-scroll"><table class="attendance-report-table"><thead><tr><th>Student</th><th>Attendance %</th>${columns.map(c=>`<th title="${mkregEsc(c.date)}">${mkregEsc(mkregShortDate(c.date))}</th>`).join('')}</tr></thead><tbody>${rows.map(s=>`<tr><th scope="row">${mkregEsc(s.name)}</th><td>${s.attendance_percent==null?'—':s.attendance_percent+'%'}</td>${columns.map(c=>{const mark=mkAttendanceReportMark(s,c);return `<td style="color:${mark.color};${c.no_maktab_day?'background:#eeeeea':''}" title="${mkregEsc(mark.label)}">${mark.text}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="form-hint">✓ Present/logged · H Confirmed Haidh · h Predicted Haidh<br>Grey: no Maktab day · Blank: absent or not yet recorded</p>`;
  status.textContent='Preparing report images…';
  try{
    const pages=mkAttendanceReportPages(data,state.sort), files=[];
    for(let i=0;i<pages.length;i++){
      const blob=await maktabDailyReportCanvasBlob(mkAttendanceReportCanvas(data,pages[i],i,pages.length));
      if(mkAttendanceReport!==state || token!==state.token)return;
      files.push(new File([blob],`Attendance-${data.from}-${data.to}-${i+1}.png`,{type:'image/png'}));
    }
    state.files=files;share.disabled=false;status.textContent=files.length>1 ? `${files.length} report pages ready.` : '';
  }catch(e){if(mkAttendanceReport===state && token===state.token)status.textContent=e.message;}
}
async function mkAttendanceReportLoad(state){
  const token=++state.token;
  state.data=null;state.files=[];
  const from=document.getElementById('marFrom').value,to=document.getElementById('marTo').value;
  const status=document.getElementById('marStatus');
  document.getElementById('marShare').disabled=true;
  document.getElementById('marPreview').textContent='';
  if(!from || !to || from>to){status.textContent='Choose From and To dates in order.';return;}
  status.textContent='Loading…';
  try{
    const data=await apiGetMaktabAttendanceReport(from,to);
    if(mkAttendanceReport!==state || token!==state.token)return;
    if(data.from!==from || data.to!==to || !Array.isArray(data.weeks) || !Array.isArray(data.students))throw Error('The attendance report service needs updating.');
    state.data=data;await mkAttendanceReportRender(state);
  }catch(e){if(mkAttendanceReport===state && token===state.token)status.textContent=e.message;}
}
async function mkAttendanceReportShare(){
  const state=mkAttendanceReport;
  if(!state?.files.length)return;
  const files=state.files.slice();
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files}))){
      await navigator.share({title:'Maktab Attendance Report',files});return;
    }
  }catch(e){if(e.name==='AbortError' || e.name==='NotAllowedError')return;}
  files.forEach(file=>maktabDailyReportDownload(file,file.name));
  if(mkAttendanceReport===state)document.getElementById('marStatus').textContent='Report images saved. Your browser may ask to allow multiple downloads.';
}
function maktabOpenAttendanceReport(){
  document.getElementById('maktabAttendanceReport')?.remove();
  const state={token:0,data:null,files:[],sort:'name'};
  mkAttendanceReport=state;
  const today=(typeof mkregisterData!=='undefined' && mkregisterData?.today) || maktabTodayISO();
  const range=mkAttendanceReportPreset('week',today);
  const overlay=document.createElement('div');overlay.id='maktabAttendanceReport';overlay.className='modal-overlay maktab-daily-report-overlay';
  overlay.innerHTML=`<div class="modal-card maktab-daily-report-card" role="dialog" aria-modal="true" aria-label="Attendance report"><button type="button" class="close-btn" id="marClose" aria-label="Close">×</button><h2>Attendance Report</h2><div class="attendance-report-controls"><label>Period<select id="marPeriod"><option value="week">Week to date</option><option value="month">Month to date</option><option value="custom">Date range</option></select></label><label>From<input type="date" id="marFrom" value="${range.from}"></label><label>To<input type="date" id="marTo" value="${range.to}"></label><label>Order<select id="marSort"><option value="name">Alphabetical</option><option value="attendance">Decreasing attendance</option></select></label></div><p class="form-hint">Date ranges may span up to 366 days.</p><button type="button" class="primary" id="marShare" disabled>Share</button><p id="marStatus" role="status"></p><div id="marPreview"></div></div>`;
  document.body.appendChild(overlay);
  const close=()=>{state.token++;if(mkAttendanceReport===state)mkAttendanceReport=null;overlay.remove();};
  document.getElementById('marClose').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.getElementById('marPeriod').onchange=e=>{
    if(e.target.value==='custom')return;
    const range=mkAttendanceReportPreset(e.target.value,today);
    document.getElementById('marFrom').value=range.from;document.getElementById('marTo').value=range.to;
    mkAttendanceReportLoad(state);
  };
  ['marFrom','marTo'].forEach(id=>document.getElementById(id).onchange=()=>{document.getElementById('marPeriod').value='custom';mkAttendanceReportLoad(state);});
  document.getElementById('marSort').onchange=e=>{state.sort=e.target.value;if(state.data)mkAttendanceReportRender(state);};
  document.getElementById('marShare').onclick=mkAttendanceReportShare;
  mkAttendanceReportLoad(state);
}
document.getElementById('maktabAttendanceReportBtn')?.addEventListener('click',maktabOpenAttendanceReport);
