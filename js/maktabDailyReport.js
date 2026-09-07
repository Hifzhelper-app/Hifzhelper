/* Hifzhelper build 4.2.15.5 | js/maktabDailyReport.js */
// ============================================================
// V4.2.15.3 — Daily Maktab Report.
//
// A teacher opens this from Maktab Summary. The report has its own native
// date picker, loads the same apiMaktabSummary(date) payload as the live
// Summary, filters out every student who has NO Sabaq / Sabaq Dhor / Dhor
// activity on that date, and presents the remaining rows read-only.
//
// Share deliberately uses the browser/device Web Share API with a generated
// PNG File. That opens the native share sheet on supporting devices (so the
// device decides whether WhatsApp, Files, AirDrop, Mail, etc. are available).
// Browsers without native file sharing fall back to saving the same PNG.
// No report data is posted to a second service and no backend/report table is
// introduced.
// ============================================================

const maktabDailyReportState = {
  date: null,
  data: null,
  rows: [],
  blob: null,
  renderToken: 0
};

function maktabDailyReportEscape(value){
  return String(value == null ? '' : value).replace(/[&<>\"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[ch]));
}

function maktabDailyReportDateLabel(iso){
  const d = new Date(String(iso || '') + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleDateString(undefined, { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

function maktabDailyReportDateFilePart(iso){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso : maktabTodayISO();
}

function maktabDailyReportRows(data){
  const byStudent = { sabaq:{}, sabaqDhor:{}, dhor:{} };
  (data && Array.isArray(data.sabaq) ? data.sabaq : []).forEach(r => (byStudent.sabaq[r.student_id] = byStudent.sabaq[r.student_id] || []).push(r));
  (data && Array.isArray(data.sabaq_dhor) ? data.sabaq_dhor : []).forEach(r => (byStudent.sabaqDhor[r.student_id] = byStudent.sabaqDhor[r.student_id] || []).push(r));
  (data && Array.isArray(data.dhor) ? data.dhor : []).forEach(r => (byStudent.dhor[r.student_id] = byStudent.dhor[r.student_id] || []).push(r));

  const students = (data && Array.isArray(data.students) ? data.students : []).filter(stu =>
    ['sabaq','sabaqDhor','dhor'].some(type => (byStudent[type][stu.id] || []).length > 0)
  );

  // The daily report is the Maktab Summary with its empty band removed, so
  // the remaining (logged) band keeps the Summary's first-name alphabetic
  // ordering rather than introducing a second report-specific ordering.
  students.sort((a, b) => {
    if(typeof maktabSummaryCompareName === 'function') return maktabSummaryCompareName(a, b);
    return String(a && a.name || '').localeCompare(String(b && b.name || ''), undefined, { sensitivity:'base', numeric:true });
  });

  return students.map(stu => ({
    student: stu,
    sabaq: byStudent.sabaq[stu.id] || [],
    sabaqDhor: byStudent.sabaqDhor[stu.id] || [],
    dhor: byStudent.dhor[stu.id] || []
  }));
}

function maktabDailyReportSingleEntryText(type, entry){
  const holder = document.createElement('div');
  // Render one entry at a time so the Summary's +N compression can never
  // hide additional activity in a report.
  holder.innerHTML = maktabCellHtml(type, entry ? [entry] : []);
  return (holder.textContent || '').replace(/\s+/g, ' ').trim();
}

function maktabDailyReportCellText(type, entries){
  if(!entries || !entries.length) return '—';
  const values = entries.map(entry => maktabDailyReportSingleEntryText(type, entry)).filter(Boolean);
  return values.length ? values.join(', ') : '—';
}

function maktabDailyReportSetStatus(text, isError){
  const el = document.getElementById('maktabDailyReportStatus');
  if(!el) return;
  el.textContent = text || '';
  el.classList.toggle('is-error', !!isError);
}

function maktabDailyReportRenderPreview(){
  const host = document.getElementById('maktabDailyReportPreview');
  const count = document.getElementById('maktabDailyReportCount');
  const share = document.getElementById('maktabDailyReportShare');
  if(!host) return;

  if(count) count.textContent = maktabDailyReportState.rows.length
    ? `${maktabDailyReportState.rows.length} student${maktabDailyReportState.rows.length === 1 ? '' : 's'} logged activity`
    : 'No logged activity';

  host.innerHTML = '';
  if(!maktabDailyReportState.rows.length){
    const empty = document.createElement('div');
    empty.className = 'maktab-daily-report-empty';
    empty.textContent = 'No students logged Maktab activity on this date.';
    host.appendChild(empty);
    if(share) share.disabled = true;
    return;
  }

  const table = document.createElement('table');
  table.className = 'maktab-daily-report-table';
  table.innerHTML = '<thead><tr><th class="report-no">#</th><th class="report-student">Student</th><th>Sabaq</th><th>Sabaq Dhor</th><th>Dhor</th></tr></thead>';
  const body = document.createElement('tbody');

  maktabDailyReportState.rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const num = document.createElement('td');
    num.className = 'report-no';
    num.textContent = String(index + 1);
    tr.appendChild(num);

    const name = document.createElement('td');
    name.className = 'report-student';
    const pill = document.createElement('span');
    pill.className = 'maktab-daily-report-name-pill';
    pill.textContent = row.student.name || '';
    pill.title = row.student.name || '';
    name.appendChild(pill);
    tr.appendChild(name);

    [['sabaq', row.sabaq], ['sabaqDhor', row.sabaqDhor], ['dhor', row.dhor]].forEach(([type, entries]) => {
      const td = document.createElement('td');
      td.className = 'maktab-daily-report-entry-list';
      // Reports never collapse multiple entries behind a +N badge: every
      // activity is shown, comma separated, in the cell itself.
      td.textContent = maktabDailyReportCellText(type, entries);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  table.appendChild(body);
  host.appendChild(table);
}

function maktabDailyReportCanvasColour(name, fallback){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch(e){ return fallback; }
}

function maktabDailyReportRoundedRect(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function maktabDailyReportFitText(ctx, text, maxWidth){
  const raw = String(text == null ? '' : text);
  if(ctx.measureText(raw).width <= maxWidth) return raw;
  let lo = 0, hi = raw.length;
  while(lo < hi){
    const mid = Math.ceil((lo + hi) / 2);
    if(ctx.measureText(raw.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return raw.slice(0, lo) + '…';
}

function maktabDailyReportBreakToken(ctx, token, maxWidth){
  const out = [];
  let rest = String(token || '');
  while(rest && ctx.measureText(rest).width > maxWidth){
    let lo = 1, hi = rest.length;
    while(lo < hi){
      const mid = Math.ceil((lo + hi) / 2);
      if(ctx.measureText(rest.slice(0, mid)).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    out.push(rest.slice(0, Math.max(1, lo)));
    rest = rest.slice(Math.max(1, lo));
  }
  if(rest) out.push(rest);
  return out;
}

function maktabDailyReportWrapText(ctx, text, maxWidth){
  const raw = String(text == null ? '' : text).trim() || '—';
  const tokens = raw.split(/\s+/).flatMap(token => maktabDailyReportBreakToken(ctx, token, maxWidth));
  const lines = [];
  let line = '';
  tokens.forEach(token => {
    const candidate = line ? `${line} ${token}` : token;
    if(line && ctx.measureText(candidate).width > maxWidth){
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  });
  if(line) lines.push(line);
  return lines.length ? lines : ['—'];
}

function maktabDailyReportBuildCanvas(){
  const rows = maktabDailyReportState.rows;
  const width = 1500;
  const margin = 58;
  const topArea = 178;
  const headerHeight = 66;
  const minRowHeight = 70;
  const activityLineHeight = 28;
  const footerHeight = 82;
  const contentWidth = width - margin * 2;
  const cols = [72, 360, 286, 372, 294]; // totals to the 1384px content width
  const canvas = document.createElement('canvas');
  canvas.width = width;
  const ctx = canvas.getContext('2d');
  if(!ctx) throw new Error('This browser cannot create the report image.');

  // Measure every activity cell before fixing canvas height. This keeps all
  // comma-separated entries in the exported image instead of ellipsising
  // the second/third entry.
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const preparedRows = rows.map(row => {
    const texts = [
      maktabDailyReportCellText('sabaq', row.sabaq),
      maktabDailyReportCellText('sabaqDhor', row.sabaqDhor),
      maktabDailyReportCellText('dhor', row.dhor)
    ];
    const lines = texts.map((text, i) => maktabDailyReportWrapText(ctx, text, cols[i + 2] - 28));
    const maxLines = Math.max(1, ...lines.map(x => x.length));
    return { row, lines, height: Math.max(minRowHeight, maxLines * activityLineHeight + 26) };
  });
  const rowsHeight = preparedRows.reduce((sum, item) => sum + item.height, 0);
  const height = topArea + headerHeight + rowsHeight + footerHeight + margin;
  canvas.height = height;

  const sage = maktabDailyReportCanvasColour('--palette-sage', '#829672');
  const rose = maktabDailyReportCanvasColour('--color-table-header-log', '#D8959B');
  const evergreen = maktabDailyReportCanvasColour('--palette-evergreen', '#344C3D');
  const sky = maktabDailyReportCanvasColour('--color-accent-soft', '#D0DBE7');
  const ink = maktabDailyReportCanvasColour('--color-ink', '#2B2B28');
  const inkSoft = maktabDailyReportCanvasColour('--color-ink-soft', '#686A63');
  const border = maktabDailyReportCanvasColour('--color-table-border', '#E4D8DB');

  ctx.fillStyle = '#F3F3EF';
  ctx.fillRect(0, 0, width, height);

  maktabDailyReportRoundedRect(ctx, 28, 28, width - 56, height - 56, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = evergreen;
  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Maktab Daily Report', margin, 78);

  ctx.fillStyle = ink;
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.fillText(maktabDailyReportDateLabel(maktabDailyReportState.date), margin, 128);

  ctx.textAlign = 'right';
  ctx.fillStyle = inkSoft;
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${rows.length} student${rows.length === 1 ? '' : 's'} logged activity`, width - margin, 128);
  ctx.textAlign = 'left';

  const tableY = topArea;
  let x = margin;
  cols.forEach((w, i) => {
    ctx.fillStyle = i <= 1 ? sage : rose;
    ctx.fillRect(x, tableY, w, headerHeight);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, tableY, w, headerHeight);
    x += w;
  });

  const headings = ['#','STUDENT','SABAQ','SABAQ DHOR','DHOR'];
  x = margin;
  ctx.fillStyle = ink;
  ctx.font = '700 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  headings.forEach((label, i) => {
    ctx.fillText(label, x + 16, tableY + headerHeight / 2);
    x += cols[i];
  });

  let y = tableY + headerHeight;
  preparedRows.forEach((item, rowIndex) => {
    const row = item.row;
    const rowHeight = item.height;
    x = margin;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, contentWidth, rowHeight);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, contentWidth, rowHeight);

    ctx.fillStyle = inkSoft;
    ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(rowIndex + 1), x + 20, y + rowHeight / 2);
    x += cols[0];

    const pillX = x + 14;
    const pillH = 44;
    const pillY = y + (rowHeight - pillH) / 2;
    const pillW = cols[1] - 28;
    maktabDailyReportRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText(maktabDailyReportFitText(ctx, row.student.name || '', pillW - 32), pillX + 16, y + rowHeight / 2);
    x += cols[1];

    ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = ink;
    item.lines.forEach((lines, i) => {
      const w = cols[i + 2];
      const textHeight = lines.length * activityLineHeight;
      let lineY = y + (rowHeight - textHeight) / 2 + activityLineHeight / 2;
      lines.forEach(line => {
        ctx.fillText(line, x + 14, lineY);
        lineY += activityLineHeight;
      });
      x += w;
    });
    y += rowHeight;
  });

  ctx.fillStyle = inkSoft;
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.fillText('Hifzhelper · Daily Maktab Summary', margin, y + 44);
  return canvas;
}

function maktabDailyReportCanvasBlob(canvas){
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the report image.')), 'image/png');
  });
}

async function maktabDailyReportPrepareShare(token){
  const share = document.getElementById('maktabDailyReportShare');
  if(share){
    share.disabled = true;
    share.innerHTML = iconHtml('share') + '<span>Preparing…</span>';
  }
  try{
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = maktabDailyReportBuildCanvas();
    const blob = await maktabDailyReportCanvasBlob(canvas);
    if(token !== maktabDailyReportState.renderToken) return;
    maktabDailyReportState.blob = blob;
    if(share){
      share.disabled = false;
      share.innerHTML = iconHtml('share') + '<span>Share</span>';
    }
  } catch(e){
    if(token !== maktabDailyReportState.renderToken) return;
    maktabDailyReportState.blob = null;
    if(share){
      share.disabled = true;
      share.innerHTML = iconHtml('share') + '<span>Share</span>';
    }
    maktabDailyReportSetStatus((e && e.message) || 'Could not prepare the report.', true);
  }
}

async function maktabDailyReportLoad(date){
  const host = document.getElementById('maktabDailyReportPreview');
  const share = document.getElementById('maktabDailyReportShare');
  const token = ++maktabDailyReportState.renderToken;
  maktabDailyReportState.date = date;
  maktabDailyReportState.data = null;
  maktabDailyReportState.rows = [];
  maktabDailyReportState.blob = null;
  if(host) host.innerHTML = '<div class="maktab-daily-report-loading">Loading…</div>';
  if(share) share.disabled = true;
  maktabDailyReportSetStatus('', false);

  let data;
  try{
    data = await apiMaktabSummary(date);
  } catch(e){
    if(token !== maktabDailyReportState.renderToken) return;
    if(host) host.innerHTML = '<div class="maktab-daily-report-empty">Could not load this daily report.</div>';
    maktabDailyReportSetStatus((e && e.message) || 'Could not load this daily report.', true);
    return;
  }
  if(token !== maktabDailyReportState.renderToken) return;
  if(!data || !Array.isArray(data.students)){
    if(host) host.innerHTML = '<div class="maktab-daily-report-empty">Could not load this daily report.</div>';
    maktabDailyReportSetStatus('Unexpected report response.', true);
    return;
  }

  maktabDailyReportState.data = data;
  maktabDailyReportState.rows = maktabDailyReportRows(data);
  maktabDailyReportRenderPreview();
  if(maktabDailyReportState.rows.length) maktabDailyReportPrepareShare(token);
}

function maktabDailyReportDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function maktabDailyReportShare(){
  const blob = maktabDailyReportState.blob;
  if(!blob) return;
  const datePart = maktabDailyReportDateFilePart(maktabDailyReportState.date);
  const filename = `Hifzhelper-Daily-Maktab-Report-${datePart}.png`;
  let file = null;
  try{ file = new File([blob], filename, { type:'image/png' }); } catch(e){ /* legacy browser: save fallback below */ }

  const title = `Maktab Daily Report — ${maktabDailyReportDateLabel(maktabDailyReportState.date)}`;
  if(file && typeof navigator.share === 'function'){
    const canShareFile = typeof navigator.canShare !== 'function' || navigator.canShare({ files:[file] });
    if(canShareFile){
      try{
        await navigator.share({ title, text:title, files:[file] });
        maktabDailyReportSetStatus('', false);
        return;
      } catch(e){
        if(e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return; // user cancelled / dismissed
        // A browser may expose Web Share but reject file sharing at runtime.
        // Fall through to the local save path so the report is never lost.
      }
    }
  }

  maktabDailyReportDownload(blob, filename);
  maktabDailyReportSetStatus('Native file sharing is unavailable here, so the report was saved as a PNG.', false);
}

function maktabCloseDailyReport(){
  ++maktabDailyReportState.renderToken;
  const overlay = document.getElementById('maktabDailyReportOverlay');
  if(overlay) overlay.remove();
  maktabDailyReportState.data = null;
  maktabDailyReportState.rows = [];
  maktabDailyReportState.blob = null;
}

function maktabOpenDailyReport(){
  maktabCloseDailyReport();
  const summaryDate = document.getElementById('maktabSummaryDatePicker');
  const initialDate = (summaryDate && summaryDate.value) || maktabSummarySelectedDate || maktabTodayISO();

  const overlay = document.createElement('div');
  overlay.id = 'maktabDailyReportOverlay';
  overlay.className = 'modal-overlay maktab-daily-report-overlay';
  overlay.innerHTML = `
    <div class="modal-card maktab-daily-report-card" role="dialog" aria-modal="true" aria-labelledby="maktabDailyReportTitle">
      <button type="button" class="close-btn" aria-label="Close">×</button>
      <div class="maktab-daily-report-heading">
        <div>
          <h2 id="maktabDailyReportTitle">Daily Report</h2>
          <div class="maktab-daily-report-subtitle">Maktab Summary · logged activity only</div>
        </div>
      </div>
      <div class="maktab-daily-report-toolbar">
        <div class="maktab-daily-report-date-control">
          <input type="date" id="maktabDailyReportDate" value="${maktabDailyReportEscape(initialDate)}" aria-label="Daily report date">
        </div>
        <span class="maktab-daily-report-count" id="maktabDailyReportCount"></span>
        <button type="button" class="maktab-cross-nav-btn maktab-daily-report-share" id="maktabDailyReportShare" disabled>${iconHtml('share')}<span>Share</span></button>
      </div>
      <div class="maktab-daily-report-preview" id="maktabDailyReportPreview"></div>
      <div class="maktab-daily-report-status" id="maktabDailyReportStatus" role="status" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = document.getElementById('maktabDailyReportDate');
  if(typeof wireCustomDateDisplay === 'function') wireCustomDateDisplay('maktabDailyReportDate');
  if(input) input.addEventListener('change', () => {
    if(!input.value) return;
    maktabDailyReportLoad(input.value);
  });
  overlay.querySelector('.close-btn').addEventListener('click', maktabCloseDailyReport);
  overlay.addEventListener('click', e => { if(e.target === overlay) maktabCloseDailyReport(); });
  document.getElementById('maktabDailyReportShare').addEventListener('click', maktabDailyReportShare);
  maktabDailyReportLoad(initialDate);
}

const maktabSummaryDailyReportBtn = document.getElementById('maktabSummaryDailyReportBtn');
if(maktabSummaryDailyReportBtn){
  maktabSummaryDailyReportBtn.innerHTML = iconHtml('share') + '<span>Daily Report</span>';
  maktabSummaryDailyReportBtn.addEventListener('click', maktabOpenDailyReport);
}
