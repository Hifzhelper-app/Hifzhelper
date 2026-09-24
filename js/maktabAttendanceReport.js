/* Hifzhelper build 4.2.15.23 | js/maktabAttendanceReport.js */
// Read-only report: uses the register's normalized cells, percentages and sort.
let mkAttendanceReport = null;
function mkAttendanceReportPreset(mode, today){
  return {from: mode === 'month' ? today.slice(0,8)+'01' : mkregMondayOf(today), to:today};
}
function mkAttendanceReportRows(data, sort){
  return mkregSortStudents(data.students, data.today, data.weeks, sort, sort === 'attendance' ? 'desc' : 'asc', data.from, data.to);
}
function mkAttendanceReportMark(student, column){
  if(column.outside) return {text:'',color:'#777',label:'Outside selected period'};
  const status = (student.cells || {})[column.date];
  if(status === 'present') return {text:'✓',color:'#568527',label:'Present / logged'};
  if(status === 'haidh') return {text:'H',color:'#77796f',label:'Confirmed Haidh'};
  if(status === 'predicted-haidh') return {text:'h',color:'#77796f',label:'Predicted Haidh'};
  return {text:'',color:'#333',label:column.future ? 'Not yet recorded' : column.no_maktab_day ? 'No maktab day' : 'Absent'};
}
function mkAttendanceReportPercent(student,data){
  const hasHaidh = Number(student.attendance_haidh_days)>0 || Object.entries(student.cells || {}).some(([date,status])=>date>=data.from && date<=data.to && (status==='haidh' || status==='predicted-haidh'));
  return hasHaidh ? '' : student.attendance_percent==null ? '—' : `${student.attendance_percent}%`;
}
function mkAttendanceReportWeekLabel(monday){
  return monday.slice(8)+' '+new Date(monday+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'});
}
function mkAttendanceReportWeeks(data){
  const keys=['mon','tue','wed','thu','fri','sat','sun'];
  const teaching=data.teaching_days || [...new Set(data.weeks.flatMap(w=>w.columns.map(c=>c.weekday)))];
  return data.weeks.map(w=>({monday:w.monday,columns:keys.flatMap((key,i)=>{
    if(!teaching.includes(key))return [];
    const day=new Date(w.monday+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+i);
    const date=day.toISOString().slice(0,10);
    return [{...(w.columns.find(c=>c.date===date)||{}),date,weekday:key,outside:date<data.from || date>data.to,weekStart:i===keys.findIndex(k=>teaching.includes(k))}];
  })})).filter(w=>w.columns.length);
}
function mkAttendanceReportPages(data, sort){
  const weeks=mkAttendanceReportWeeks(data),students=mkAttendanceReportRows(data,sort),groups=[];
  let group=[],count=0;
  for(const week of weeks){
    if(group.length && (group.length===4 || count+week.columns.length>21)){groups.push(group);group=[];count=0;}
    group.push(week);count+=week.columns.length;
  }
  if(group.length)groups.push(group);
  return groups.flatMap(weeks=>{
    const pages=[];
    for(let r=0;r<students.length;r+=20)pages.push({weeks,columns:weeks.flatMap(w=>w.columns),students:students.slice(r,r+20)});
    return pages;
  });
}
// PDF pages embed browser-rendered JPEGs, preserving names and symbols without
// external fonts, services or additional application dependencies.
function mkAttendanceReportPdf(images){
  const chunks=[],offsets=[0];let length=0;
  const bytes=text=>Uint8Array.from(text,c=>c.charCodeAt(0));
  const append=value=>{const data=typeof value==='string'?bytes(value):value;chunks.push(data);length+=data.length;};
  const object=(id,body)=>{offsets[id]=length;append(`${id} 0 obj\n`);append(body);append('\nendobj\n');};
  append('%PDF-1.4\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  const scale=Math.min(559/Math.max(...images.map(i=>i.width)),806/Math.max(...images.map(i=>i.height)));
  images.forEach((image,i)=>{
    const id=3+i*3,width=image.width*scale,height=image.height*scale;
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    offsets[id+1]=length;append(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);append(image.bytes);append('\nendstream\nendobj\n');
    const commands=`q ${width.toFixed(3)} 0 0 ${height.toFixed(3)} 18 ${(824-height).toFixed(3)} cm /Im Do Q`;
    object(id+2,`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
  });
  const xref=length;append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(offset=>append(`${String(offset).padStart(10,'0')} 00000 n \n`));
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks,{type:'application/pdf'});
}
function mkAttendanceReportCanvas(data,page,index,total){
  const canvas=document.createElement('canvas');
  const cell=34,nameWidth=180,pctWidth=60,left=24,top=160;
  let rowHeight=36;
  canvas.width=Math.max(650,left*2+nameWidth+pctWidth+page.columns.length*cell);
  const ctx=canvas.getContext('2d');
  if(!ctx) throw Error('Image export is unavailable in this browser.');
  ctx.font='16px sans-serif';
  const names=page.students.map(s=>maktabDailyReportWrapText(ctx,s.name,nameWidth-16));
  const rowHeights=names.map(lines=>Math.max(36,lines.length*20+16));
  const tableHeight=rowHeight+rowHeights.reduce((a,b)=>a+b,0);
  canvas.height=top+tableHeight+80;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#344C3D';ctx.font='bold 24px sans-serif';ctx.fillText('Maktab Attendance Report',left,36);
  ctx.font='16px sans-serif';ctx.fillText(`${data.from} to ${data.to} · Page ${index+1} of ${total}`,left,64);
  ctx.fillText('✓ Present/logged · H Confirmed Haidh · h Predicted Haidh',left,92);
  const widths=[nameWidth,pctWidth,...page.columns.map(()=>cell)];
  const drawRow=(values,y,header,student)=>{
    let x=left;
    values.forEach((value,i)=>{
      const col=page.columns[i-2];
      ctx.fillStyle=header ? '#829672' : (col?.no_maktab_day || col?.outside) ? '#eeeeea' : '#fff';ctx.fillRect(x,y,widths[i],rowHeight);
      ctx.strokeStyle='#ddd';ctx.strokeRect(x,y,widths[i],rowHeight);
      ctx.save();ctx.beginPath();ctx.rect(x+5,y,widths[i]-10,rowHeight);ctx.clip();
      ctx.fillStyle=student && col ? mkAttendanceReportMark(student,col).color : '#30352e';
      ctx.font=header ? 'bold 12px sans-serif':'16px sans-serif';
      ctx.textAlign=i===0 ? 'left':'center';
      if(i===0 && student){
        maktabDailyReportWrapText(ctx,value,widths[i]-16).forEach((line,j)=>ctx.fillText(line,x+8,y+22+j*20));
      } else ctx.fillText(value,i===0?x+8:x+widths[i]/2,y+24);
      ctx.restore();x+=widths[i];
    });
  };
  drawRow(['Student','Att. %',...page.columns.map(c=>c.weekday.slice(0,1).toUpperCase()+c.weekday.slice(1))],top,true);
  let weekX=left+nameWidth+pctWidth;
  page.weeks.forEach(week=>{
    ctx.fillStyle='#829672';ctx.fillRect(weekX,top-32,week.columns.length*cell,32);
    ctx.fillStyle='#30352e';ctx.textAlign='center';ctx.font='bold 16px sans-serif';
    ctx.fillText(mkAttendanceReportWeekLabel(week.monday),weekX+week.columns.length*cell/2,top-10);
    weekX+=week.columns.length*cell;
  });
  let rowY=top+rowHeight;
  page.students.forEach((s,i)=>{rowHeight=rowHeights[i];drawRow([s.name,mkAttendanceReportPercent(s,data),...page.columns.map(c=>mkAttendanceReportMark(s,c).text)],rowY,false,s);rowY+=rowHeight;});
  let boundary=left+nameWidth+pctWidth;
  ctx.strokeStyle='#67735e';ctx.lineWidth=3;
  [...page.weeks,{columns:[]}].forEach(week=>{
    ctx.beginPath();ctx.moveTo(boundary,top-32);ctx.lineTo(boundary,top+tableHeight);ctx.stroke();
    boundary+=week.columns.length*cell;
  });
  ctx.fillStyle='#777';ctx.font='14px sans-serif';ctx.textAlign='left';ctx.fillText('Grey: no Maktab day/outside period · Blank: absent or not yet recorded',left,canvas.height-25);
  return canvas;
}
async function mkAttendanceReportRender(state){
  const token=++state.token;
  const host=document.getElementById('marPreview'), share=document.getElementById('marShare'), download=document.getElementById('marDownload'), status=document.getElementById('marStatus');
  state.files=[];state.shareFiles=[];share.disabled=download.disabled=true;
  const data=state.data;
  const columns=data.weeks.flatMap(w=>w.columns), rows=mkAttendanceReportRows(data,state.sort);
  if(!columns.length || !rows.length){host.textContent='No students or teaching days in this period.';status.textContent='';return;}
  const pages=mkAttendanceReportPages(data,state.sort);
  host.innerHTML=pages.map((page,index)=>`<section class="attendance-report-page"><p>Page ${index+1} of ${pages.length}</p><div class="attendance-report-scroll"><table class="attendance-report-table" style="width:${240+page.columns.length*34}px"><colgroup><col class="mar-name-col"><col class="mar-percent-col">${page.columns.map(()=>'<col class="mar-day-col">').join('')}</colgroup><thead><tr><th rowspan="2">Student</th><th rowspan="2" title="Attendance percentage">Att. %</th>${page.weeks.map(w=>`<th class="mar-week-start" colspan="${w.columns.length}">${mkAttendanceReportWeekLabel(w.monday)}</th>`).join('')}</tr><tr>${page.columns.map(c=>`<th class="${c.weekStart?'mar-week-start':''}" title="${c.date}">${c.weekday.slice(0,1).toUpperCase()+c.weekday.slice(1)}</th>`).join('')}</tr></thead><tbody>${page.students.map(s=>`<tr><th scope="row">${mkregEsc(s.name)}</th><td>${mkAttendanceReportPercent(s,data)}</td>${page.columns.map(c=>{const mark=mkAttendanceReportMark(s,c);return `<td class="${c.weekStart?'mar-week-start':''}" style="color:${mark.color};${c.no_maktab_day||c.outside?'background:#eeeeea':''}" title="${mkregEsc(c.date+': '+mark.label)}">${mark.text}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')+`<p class="form-hint">✓ Present/logged · H Confirmed Haidh · h Predicted Haidh<br>Grey: no Maktab day/outside period · Blank: absent or not yet recorded<br>Attendance % is omitted where the selected period includes Haidh.</p>`;
  status.textContent='Preparing report…';
  try{
    const images=[],shareFiles=[];
    for(let i=0;i<pages.length;i++){
      const canvas=mkAttendanceReportCanvas(data,pages[i],i,pages.length);
      images.push({width:canvas.width,height:canvas.height,bytes:Uint8Array.from(atob(canvas.toDataURL('image/jpeg',0.94).split(',')[1]),c=>c.charCodeAt(0))});
      const png=await maktabDailyReportCanvasBlob(canvas);
      shareFiles.push(new File([png],`Attendance-${data.from}-${data.to}-page-${i+1}.png`,{type:'image/png'}));
      // Yield between pages so changing dates or closing invalidates this work.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(mkAttendanceReport!==state || token!==state.token)return;
    }
    const pdf=mkAttendanceReportPdf(images);
    state.files=[new File([pdf],`Attendance-${data.from}-${data.to}.pdf`,{type:'application/pdf'})];
    state.shareFiles=shareFiles;
    share.disabled=download.disabled=false;status.textContent=`${pages.length} report page${pages.length===1?'':'s'} ready.`;
  }catch(e){if(mkAttendanceReport===state && token===state.token)status.textContent=e.message;}
}

async function mkAttendanceReportLoad(state){
  const token=++state.token;
  state.data=null;state.files=[];state.shareFiles=[];
  const from=document.getElementById('marFrom').value,to=document.getElementById('marTo').value;
  const status=document.getElementById('marStatus');
  document.getElementById('marShare').disabled=true;
  document.getElementById('marDownload').disabled=true;
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
function mkAttendanceReportDownload(){
  const file=mkAttendanceReport?.files[0];
  if(!file)return;
  maktabDailyReportDownload(file,file.name);
  document.getElementById('marStatus').textContent='';
}
async function mkAttendanceReportShare(){
  const state=mkAttendanceReport;
  if(!state?.shareFiles.length)return;
  const files=state.shareFiles.slice();
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files}))){
      await navigator.share({title:'Maktab Attendance Report',files});return;
    }
  }catch(e){if(e.name==='AbortError')return;}
  if(mkAttendanceReport===state)document.getElementById('marStatus').textContent='Image sharing is unavailable in this browser. Use Download PDF to save the report.';
}
function maktabOpenAttendanceReport(){
  document.getElementById('maktabAttendanceReport')?.remove();
  const state={token:0,data:null,files:[],shareFiles:[],sort:'name'};
  mkAttendanceReport=state;
  const today=(typeof mkregisterData!=='undefined' && mkregisterData?.today) || maktabTodayISO();
  const range=mkAttendanceReportPreset('week',today);
  const overlay=document.createElement('div');overlay.id='maktabAttendanceReport';overlay.className='modal-overlay maktab-daily-report-overlay';
  overlay.innerHTML=`<div class="modal-card maktab-daily-report-card" role="dialog" aria-modal="true" aria-label="Attendance report"><button type="button" class="close-btn" id="marClose" aria-label="Close">×</button><div class="attendance-report-heading"><h2>Attendance Report</h2><div class="attendance-report-actions"><button type="button" class="maktab-cross-nav-btn maktab-daily-report-share" id="marShare" disabled>${iconHtml('share')}<span>Share</span></button><button type="button" class="maktab-cross-nav-btn" id="marDownload" disabled>Download PDF</button></div></div><div class="attendance-report-controls"><div class="attendance-report-control-stack"><label>Period<select id="marPeriod"><option value="week">Week to date</option><option value="month">Month to date</option><option value="custom">Date range</option></select></label><label>Order<select id="marSort"><option value="name">Alphabetical</option><option value="attendance">Decreasing attendance</option></select></label></div><div class="attendance-report-control-stack"><label>From<input type="date" id="marFrom" class="mar-date-pill" value="${range.from}"></label><label>To<input type="date" id="marTo" class="mar-date-pill" value="${range.to}"></label></div></div><p id="marStatus" role="status"></p><div id="marPreview"></div></div>`;
  document.body.appendChild(overlay);
  ['marFrom','marTo'].forEach(id=>{if(typeof wireCustomDateDisplay==='function')wireCustomDateDisplay(id);});
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
  document.getElementById('marDownload').onclick=mkAttendanceReportDownload;
  mkAttendanceReportLoad(state);
}
document.getElementById('maktabAttendanceReportBtn')?.addEventListener('click',maktabOpenAttendanceReport);
