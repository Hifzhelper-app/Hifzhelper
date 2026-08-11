// ============================================================
// Hifzhelper — "Surahs in my Heart" screen (V3.46.0)
//
// A colouring activity: the heart artwork (assets/quran-heart.svg,
// all 114 surahs as labelled regions) is coloured in by tapping
// regions. Deliberately NOT connected to any progress tracking
// anywhere in the app — a purely creative space (confirmed in chat).
//
// How it works (the artwork has no per-region ids — its 1,603 paths
// are the black outlines and outlined label text, so per-path SVG
// fills were never an option):
//   1. The SVG is drawn once onto an offscreen canvas at a FIXED
//      internal resolution (2x the viewBox, 1191x1684) — the same on
//      every device, so exports are always crisp (confirmed in chat).
//   2. Every pixel is classified line vs open (alpha threshold), and
//      the open pixels are labelled into connected regions once at
//      load. Verified directly against the real artwork rendered at
//      exactly this resolution: 115 fillable regions (114 surahs +
//      one small unlabelled vessel shape), zero leaks between
//      neighbouring surahs, at alpha thresholds 32/64/128 alike.
//   3. The exterior is the region connected to the canvas CORNER —
//      not "any region touching the border", because two real surah
//      regions on the artwork's left edge are clipped by the viewBox
//      and genuinely touch the border (also verified directly).
//   4. A tap looks up the region label at that pixel and paints the
//      whole region (solid or two-colour vertical gradient) into a
//      fill layer, dilated ~2px under the line art so anti-aliased
//      edges never show a white halo. Tiny regions (letter counters
//      inside the label text) are ignored via a minimum-size rule.
//   5. Display = background image (around the heart only — the fill
//      layer's base makes every non-exterior pixel opaque white) +
//      fill layer + line art on top, composed on one visible canvas
//      that pans/zooms via CSS transform.
//
// Persistence (confirmed in chat): explicit Save, LOCAL DEVICE only,
// one picture per user (keyed by login id), stored as the list of
// fill actions (tap point + colours) — tiny, and restoring is just
// replaying them. The uploaded background image is never persisted.
// ============================================================

const SIH_W = 1191;              // 2x viewBox 595.28 x 841.89
const SIH_H = 1684;
const SIH_LINE_ALPHA = 64;       // pixel counts as line art at/above this alpha
const SIH_MIN_REGION_PX = 2000;  // below this = a text-glyph hole, not a surah region
const SIH_STORAGE_PREFIX = 'hh_sih_picture_';

let sih = null; // the whole engine state, built lazily on first screen entry

function sihStorageKey(){
  // One picture per user (confirmed in chat) — keyed by the same
  // effective login id the rest of the app already resolves
  // (explicit URL path authoritative, remembered device id fallback).
  const id = (typeof getEffectiveLoginId === 'function' && getEffectiveLoginId()) || 'default';
  return SIH_STORAGE_PREFIX + id;
}

// ---------- colour helpers ----------

function sihHslToRgb(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function sihCss(c){ return `hsl(${c.h}, ${c.s}%, ${c.l}%)`; }

// ---------- engine build (runs once) ----------

async function sihEnsureEngine(){
  if(sih && sih.loaded) return;
  sih = {
    loaded: false,
    labels: null, meta: new Map(), exteriorLabel: 0,
    baseWhite: null,
    fillImage: null, fillBuf: null,
    fillCanvas: null, fillCtx: null,
    lineCanvas: null,
    viewCanvas: null, viewCtx: null,
    bgImage: null, bgUrl: null,
    actions: [],
    dirty: false,
    fillMode: 'solid',
    c1: { h: 350, s: 65, l: 60 }, c2: { h: 210, s: 65, l: 60 },
    activeSwatch: 1,
    tf: { s: 1, tx: 0, ty: 0 }, fitScale: 1, atFit: true
  };

  // 1) Load the artwork and rasterize at the fixed internal resolution.
  const img = new Image();
  img.src = 'assets/quran-heart.svg?v=3.46.0';
  await img.decode();
  const lineCanvas = document.createElement('canvas');
  lineCanvas.width = SIH_W; lineCanvas.height = SIH_H;
  const lctx = lineCanvas.getContext('2d');
  lctx.drawImage(img, 0, 0, SIH_W, SIH_H);
  sih.lineCanvas = lineCanvas;

  const art = lctx.getImageData(0, 0, SIH_W, SIH_H);
  const N = SIH_W * SIH_H;
  const isLine = new Uint8Array(N);
  for(let i = 0; i < N; i++){
    if(art.data[i * 4 + 3] >= SIH_LINE_ALPHA) isLine[i] = 1;
  }

  // 2) Connected-component labelling of the open (non-line) pixels.
  const labels = new Int32Array(N);
  const stack = new Int32Array(N);
  let next = 0;
  for(let seed = 0; seed < N; seed++){
    if(isLine[seed] || labels[seed]) continue;
    next++;
    let sp = 0;
    stack[sp++] = seed; labels[seed] = next;
    let count = 0, x0 = SIH_W, x1 = 0, y0 = SIH_H, y1 = 0;
    while(sp){
      const p = stack[--sp]; count++;
      const x = p % SIH_W, y = (p - x) / SIH_W;
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0){ const q = p - 1; if(!isLine[q] && !labels[q]){ labels[q] = next; stack[sp++] = q; } }
      if(x < SIH_W - 1){ const q = p + 1; if(!isLine[q] && !labels[q]){ labels[q] = next; stack[sp++] = q; } }
      if(y > 0){ const q = p - SIH_W; if(!isLine[q] && !labels[q]){ labels[q] = next; stack[sp++] = q; } }
      if(y < SIH_H - 1){ const q = p + SIH_W; if(!isLine[q] && !labels[q]){ labels[q] = next; stack[sp++] = q; } }
    }
    sih.meta.set(next, { count, x0, x1, y0, y1 });
  }
  sih.labels = labels;

  // 3) Exterior = the corner-connected region (see file header for why
  // border-touching alone would be wrong for this artwork). The corner
  // pixel itself is open in this artwork, but scan defensively anyway.
  let corner = 0;
  while(corner < N && isLine[corner]) corner++;
  sih.exteriorLabel = labels[corner];

  // 4) Base layer: opaque white everywhere except the exterior — this
  // is what keeps an uploaded background image AROUND the heart only
  // (confirmed in chat), never showing through unfilled regions. One
  // erosion step along the exterior boundary trims the anti-aliased
  // white fringe at the outer silhouette.
  const ext = sih.exteriorLabel;
  const baseWhite = new Uint8Array(N);
  for(let i = 0; i < N; i++) baseWhite[i] = labels[i] === ext ? 0 : 1;
  const trimmed = new Uint8Array(baseWhite);
  for(let y = 0; y < SIH_H; y++){
    for(let x = 0; x < SIH_W; x++){
      const p = y * SIH_W + x;
      if(!baseWhite[p]) continue;
      if((x > 0 && labels[p - 1] === ext) || (x < SIH_W - 1 && labels[p + 1] === ext) ||
         (y > 0 && labels[p - SIH_W] === ext) || (y < SIH_H - 1 && labels[p + SIH_W] === ext)){
        trimmed[p] = 0;
      }
    }
  }
  sih.baseWhite = trimmed;

  // 5) Fill layer.
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = SIH_W; fillCanvas.height = SIH_H;
  sih.fillCanvas = fillCanvas;
  sih.fillCtx = fillCanvas.getContext('2d');
  sih.fillImage = sih.fillCtx.createImageData(SIH_W, SIH_H);
  sih.fillBuf = new Uint32Array(sih.fillImage.data.buffer);
  sihResetFillBuffer();

  sih.viewCanvas = document.getElementById('sihCanvas');
  sih.viewCanvas.width = SIH_W;
  sih.viewCanvas.height = SIH_H;
  sih.viewCtx = sih.viewCanvas.getContext('2d');

  sih.loaded = true;
}

// Uint32 pixels are little-endian ABGR: 0xFFFFFFFF is opaque white
// on every platform this app targets; colours built via sihPix().
function sihPix(r, g, b){ return (255 << 24) | (b << 16) | (g << 8) | r; }

function sihResetFillBuffer(){
  const buf = sih.fillBuf, base = sih.baseWhite;
  for(let i = 0; i < buf.length; i++) buf[i] = base[i] ? 0xFFFFFFFF : 0;
}

// ---------- painting ----------

// Paints one action into the fill buffer. Returns false for taps that
// hit nothing fillable (line art, the exterior, or a text-glyph hole).
function sihPaintAction(a){
  const labels = sih.labels;
  const p0 = a.y * SIH_W + a.x;
  if(a.x < 0 || a.y < 0 || a.x >= SIH_W || a.y >= SIH_H) return false;
  const lab = labels[p0];
  if(!lab || lab === sih.exteriorLabel) return false;
  const m = sih.meta.get(lab);
  if(!m || m.count < SIH_MIN_REGION_PX) return false;

  const [r1, g1, b1] = sihHslToRgb(a.c1.h, a.c1.s, a.c1.l);
  const grad = a.mode === 'gradient';
  const [r2, g2, b2] = grad ? sihHslToRgb(a.c2.h, a.c2.s, a.c2.l) : [r1, g1, b1];
  const spanY = Math.max(1, m.y1 - m.y0);
  const buf = sih.fillBuf;

  const colourAt = (y) => {
    if(!grad) return sihPix(r1, g1, b1);
    let t = (y - m.y0) / spanY;
    if(t < 0) t = 0; else if(t > 1) t = 1;
    return sihPix(
      Math.round(r1 + (r2 - r1) * t),
      Math.round(g1 + (g2 - g1) * t),
      Math.round(b1 + (b2 - b1) * t)
    );
  };

  // Pass 1: the region's own pixels.
  for(let y = m.y0; y <= m.y1; y++){
    const row = y * SIH_W;
    const c = colourAt(y);
    for(let x = m.x0; x <= m.x1; x++){
      if(labels[row + x] === lab) buf[row + x] = c;
    }
  }
  // Pass 2: dilate ~2px into LINE pixels only (label 0), so the colour
  // tucks under the anti-aliased line art with no white halo. Never
  // into another region's pixels — those aren't covered by lines.
  const dx0 = Math.max(0, m.x0 - 2), dx1 = Math.min(SIH_W - 1, m.x1 + 2);
  const dy0 = Math.max(0, m.y0 - 2), dy1 = Math.min(SIH_H - 1, m.y1 + 2);
  for(let y = dy0; y <= dy1; y++){
    const row = y * SIH_W;
    const c = colourAt(y);
    for(let x = dx0; x <= dx1; x++){
      const p = row + x;
      if(labels[p] !== 0) continue;
      let near = false;
      for(let ny = Math.max(0, y - 2); !near && ny <= Math.min(SIH_H - 1, y + 2); ny++){
        const nrow = ny * SIH_W;
        for(let nx = Math.max(0, x - 2); nx <= Math.min(SIH_W - 1, x + 2); nx++){
          if(labels[nrow + nx] === lab){ near = true; break; }
        }
      }
      if(near) buf[p] = c;
    }
  }
  return true;
}

function sihRebuildFills(){
  sihResetFillBuffer();
  for(const a of sih.actions) sihPaintAction(a);
  sihFlushFillLayer();
}

function sihFlushFillLayer(){
  sih.fillCtx.putImageData(sih.fillImage, 0, 0);
}

// Draws an image scaled to cover the whole internal canvas, centred.
function sihDrawCover(ctx, img){
  const s = Math.max(SIH_W / img.naturalWidth, SIH_H / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (SIH_W - w) / 2, (SIH_H - h) / 2, w, h);
}

function sihCompose(){
  const ctx = sih.viewCtx;
  ctx.clearRect(0, 0, SIH_W, SIH_H);
  if(sih.bgImage){
    sihDrawCover(ctx, sih.bgImage);
  } else {
    ctx.fillStyle = '#FFFFFF';   // classic colouring-page look when no background
    ctx.fillRect(0, 0, SIH_W, SIH_H);
  }
  ctx.drawImage(sih.fillCanvas, 0, 0);
  ctx.drawImage(sih.lineCanvas, 0, 0);
}

// ---------- persistence ----------

function sihSetSaveStatus(saved){
  sih.dirty = !saved;
  const el = document.getElementById('sihSaveStatus');
  el.textContent = saved ? 'saved ✓' : 'not saved';
  el.classList.toggle('unsaved', !saved);
}

function sihSave(){
  try{
    localStorage.setItem(sihStorageKey(), JSON.stringify({ v: 1, actions: sih.actions }));
    sihSetSaveStatus(true);
  }catch(e){
    showBanner('Could not save on this device');
  }
}

function sihRestoreSaved(){
  try{
    const raw = localStorage.getItem(sihStorageKey());
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data && Array.isArray(data.actions)) sih.actions = data.actions;
  }catch(e){ /* a corrupt save just means starting fresh */ }
}

// ---------- view transform (zoom / pan) ----------

function sihApplyTransform(){
  const t = sih.tf;
  sih.viewCanvas.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.s})`;
  sih.atFit = Math.abs(t.s - sih.fitScale) < 0.001;
}

function sihZoomToFit(){
  const vp = document.getElementById('sihViewport');
  const vw = vp.clientWidth, vh = vp.clientHeight;
  if(!vw || !vh) return;
  const s = Math.min(vw / SIH_W, vh / SIH_H);
  sih.fitScale = s;
  sih.tf = { s, tx: (vw - SIH_W * s) / 2, ty: (vh - SIH_H * s) / 2 };
  sihApplyTransform();
}

function sihClampScale(s){
  return Math.min(Math.max(s, sih.fitScale), sih.fitScale * 8);
}

// Zoom keeping the given viewport point fixed.
function sihZoomAt(newScale, vx, vy){
  const t = sih.tf;
  const s = sihClampScale(newScale);
  const k = s / t.s;
  t.tx = vx - (vx - t.tx) * k;
  t.ty = vy - (vy - t.ty) * k;
  t.s = s;
  sihApplyTransform();
}

// ---------- interaction ----------

function sihTapAt(clientX, clientY){
  const rect = sih.viewCanvas.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left) / rect.width * SIH_W);
  const y = Math.floor((clientY - rect.top) / rect.height * SIH_H);
  const a = {
    x, y,
    mode: sih.fillMode,
    c1: { h: sih.c1.h, s: sih.c1.s, l: sih.c1.l },
    c2: { h: sih.c2.h, s: sih.c2.s, l: sih.c2.l }
  };
  if(!sihPaintAction(a)) return;
  sih.actions.push(a);
  sihFlushFillLayer();
  sihCompose();
  sihSetSaveStatus(false);
  sihUpdateUndoButtons();
}

function sihUndo(){
  if(!sih.actions.length) return;
  sih.actions.pop();
  sihRebuildFills();
  sihCompose();
  sihSetSaveStatus(false);
  sihUpdateUndoButtons();
}

function sihUpdateUndoButtons(){
  document.querySelectorAll('[data-sih-act="undo"]').forEach(b => {
    b.disabled = !sih.actions.length;
  });
}

function sihSetupViewportGestures(){
  const vp = document.getElementById('sihViewport');
  const pointers = new Map();
  let panLast = null;         // {x,y} viewport coords of the tracked pointer
  let pinchStart = null;      // {dist, scale}
  let down = null;            // {x,y,t,moved} for tap detection

  vp.addEventListener('pointerdown', e => {
    vp.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(pointers.size === 1){
      down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
      panLast = { x: e.clientX, y: e.clientY };
      pinchStart = null;
    } else if(pointers.size === 2){
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: sih.tf.s };
      down = null; // two fingers is never a tap
    }
  });

  vp.addEventListener('pointermove', e => {
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(pointers.size === 1 && panLast){
      const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y;
      if(down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if(!down || down.moved){
        sih.tf.tx += dx; sih.tf.ty += dy;
        sihApplyTransform();
      }
      panLast = { x: e.clientX, y: e.clientY };
    } else if(pointers.size === 2 && pinchStart){
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = vp.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
      sihZoomAt(pinchStart.scale * dist / pinchStart.dist, mx, my);
    }
  });

  const end = e => {
    if(!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if(pointers.size === 0){
      if(down && !down.moved && Date.now() - down.t < 600){
        sihCloseSheets();
        sihTapAt(down.x, down.y);
      }
      down = null; panLast = null; pinchStart = null;
    } else if(pointers.size === 1){
      // dropping from pinch back to one finger: continue as a pan
      const [rest] = [...pointers.values()];
      panLast = { x: rest.x, y: rest.y };
      pinchStart = null; down = null;
    }
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    sihZoomAt(sih.tf.s * Math.pow(1.0015, -e.deltaY), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
}

// ---------- colour picker (hue/saturation wheel + lightness slider) ----------

const SIH_WHEEL_CSS = 220;   // CSS px; canvas backing is 2x for sharpness
const SIH_WHEEL_PX = 440;

function sihDrawWheelBase(){
  const c = document.createElement('canvas');
  c.width = SIH_WHEEL_PX; c.height = SIH_WHEEL_PX;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(SIH_WHEEL_PX, SIH_WHEEL_PX);
  const R = SIH_WHEEL_PX / 2;
  for(let y = 0; y < SIH_WHEEL_PX; y++){
    for(let x = 0; x < SIH_WHEEL_PX; x++){
      const dx = x - R, dy = y - R;
      const r = Math.hypot(dx, dy);
      const i = (y * SIH_WHEEL_PX + x) * 4;
      if(r > R) continue; // transparent outside the disc
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const s = Math.min(1, r / R) * 100;
      const [pr, pg, pb] = sihHslToRgb(h, s, 50);
      im.data[i] = pr; im.data[i + 1] = pg; im.data[i + 2] = pb;
      // soft anti-aliased rim
      im.data[i + 3] = r > R - 2 ? Math.round(255 * (R - r) / 2) : 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

let sihWheelBase = null;

function sihActiveColour(){
  return (sih.fillMode === 'gradient' && sih.activeSwatch === 2) ? sih.c2 : sih.c1;
}

function sihRenderWheel(){
  const canvas = document.getElementById('sihWheel');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIH_WHEEL_PX, SIH_WHEEL_PX);
  ctx.drawImage(sihWheelBase, 0, 0);
  // handle at the active colour's h/s position
  const c = sihActiveColour();
  const R = SIH_WHEEL_PX / 2;
  const rad = c.h * Math.PI / 180;
  const r = c.s / 100 * R;
  const hx = R + Math.cos(rad) * r, hy = R + Math.sin(rad) * r;
  ctx.beginPath();
  ctx.arc(hx, hy, 12, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.stroke();
}

function sihSyncColourUi(){
  const c = sihActiveColour();
  sihRenderWheel();
  const slider = document.getElementById('sihLightness');
  slider.value = c.l;
  slider.style.background =
    `linear-gradient(to right, #000, hsl(${c.h}, ${c.s}%, 50%), #fff)`;
  document.getElementById('sihSwatch1').style.background = sihCss(sih.c1);
  document.getElementById('sihSwatch2').style.background = sihCss(sih.c2);
  const tb = document.getElementById('sihToolbarSwatch');
  tb.style.background = sih.fillMode === 'gradient'
    ? `linear-gradient(to bottom, ${sihCss(sih.c1)}, ${sihCss(sih.c2)})`
    : sihCss(sih.c1);
}

function sihWheelPick(clientX, clientY){
  const canvas = document.getElementById('sihWheel');
  const rect = canvas.getBoundingClientRect();
  const R = rect.width / 2;
  const dx = clientX - rect.left - R, dy = clientY - rect.top - R;
  const c = sihActiveColour();
  c.h = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);
  c.s = Math.round(Math.min(1, Math.hypot(dx, dy) / R) * 100);
  sihSyncColourUi();
}

function sihSetFillMode(mode){
  sih.fillMode = mode;
  if(mode === 'solid') sih.activeSwatch = 1;
  document.querySelectorAll('[data-sih-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.sihMode === mode);
  });
  document.getElementById('sihSwatch2').classList.toggle('hidden', mode !== 'gradient');
  document.getElementById('sihSwatch1').classList.toggle('active', sih.activeSwatch === 1);
  document.getElementById('sihSwatch2').classList.toggle('active', sih.activeSwatch === 2);
  sihSyncColourUi();
}

function sihSetActiveSwatch(n){
  sih.activeSwatch = n;
  document.getElementById('sihSwatch1').classList.toggle('active', n === 1);
  document.getElementById('sihSwatch2').classList.toggle('active', n === 2);
  sihSyncColourUi();
}

// ---------- mobile bottom sheets ----------

function sihOpenSheet(id){
  sihCloseSheets();
  document.getElementById(id).classList.add('open');
}
function sihCloseSheets(){
  document.querySelectorAll('.sih-sec.open').forEach(s => s.classList.remove('open'));
}

// ---------- background image ----------

function sihSetBackground(img, url){
  if(sih.bgUrl) URL.revokeObjectURL(sih.bgUrl);
  sih.bgImage = img; sih.bgUrl = url;
  document.getElementById('sihBgBtn').textContent = img ? 'Change background image' : 'Add background image';
  document.getElementById('sihBgRemoveBtn').classList.toggle('hidden', !img);
  sihCompose();
}

// ---------- export ----------

function sihExportPng(){
  // Export-time choice, confirmed in chat: only asked when a
  // background is actually loaded.
  let withBg = false;
  if(sih.bgImage){
    withBg = confirm('Include the background image in the PNG?\n\nOK = with background, Cancel = without');
  }
  const c = document.createElement('canvas');
  c.width = SIH_W; c.height = SIH_H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, SIH_W, SIH_H);
  if(withBg) sihDrawCover(ctx, sih.bgImage);
  ctx.drawImage(sih.fillCanvas, 0, 0);
  ctx.drawImage(sih.lineCanvas, 0, 0);
  c.toBlob(blob => {
    if(!blob){ showBanner('Could not create the PNG'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'surahs-in-my-heart.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

// ---------- one-time UI wiring ----------

let sihUiWired = false;

function sihWireUi(){
  if(sihUiWired) return;
  sihUiWired = true;

  document.getElementById('sihHeaderIcon').innerHTML = iconHtml('sih');
  document.getElementById('sihSaveIcon').innerHTML = iconHtml('save');
  document.getElementById('sihSaveBtn').addEventListener('click', sihSave);

  document.querySelectorAll('[data-sih-mode]').forEach(b => {
    b.addEventListener('click', () => sihSetFillMode(b.dataset.sihMode));
  });
  document.getElementById('sihSwatch1').addEventListener('click', () => sihSetActiveSwatch(1));
  document.getElementById('sihSwatch2').addEventListener('click', () => sihSetActiveSwatch(2));

  // Wheel: pointer drag picks continuously.
  const wheel = document.getElementById('sihWheel');
  let wheelDown = false;
  wheel.addEventListener('pointerdown', e => {
    wheel.setPointerCapture(e.pointerId);
    wheelDown = true;
    sihWheelPick(e.clientX, e.clientY);
  });
  wheel.addEventListener('pointermove', e => { if(wheelDown) sihWheelPick(e.clientX, e.clientY); });
  const wheelUp = () => { wheelDown = false; };
  wheel.addEventListener('pointerup', wheelUp);
  wheel.addEventListener('pointercancel', wheelUp);

  document.getElementById('sihLightness').addEventListener('input', e => {
    sihActiveColour().l = Number(e.target.value);
    sihSyncColourUi();
  });

  document.querySelectorAll('[data-sih-act="undo"]').forEach(b => b.addEventListener('click', sihUndo));
  document.querySelectorAll('[data-sih-act="zoomfit"]').forEach(b => b.addEventListener('click', sihZoomToFit));

  // Mobile toolbar sheet openers + sheet close chevrons.
  document.getElementById('sihToolbarSwatch').addEventListener('click', () => sihOpenSheet('sihColourSec'));
  document.getElementById('sihToolbarMenuBtn').addEventListener('click', () => sihOpenSheet('sihActionsSec'));
  document.querySelectorAll('[data-sih-close]').forEach(b => {
    b.innerHTML = iconHtml('chevronDown');
    b.addEventListener('click', () => sihCloseSheets());
  });
  document.getElementById('sihToolbarMenuBtn').innerHTML = iconHtml('menu');
  document.querySelectorAll('.sih-toolbar [data-sih-act="undo"]').forEach(b => { b.innerHTML = iconHtml('undo'); });
  document.querySelectorAll('.sih-toolbar [data-sih-act="zoomfit"]').forEach(b => { b.innerHTML = iconHtml('zoomFit'); });
  document.querySelectorAll('.sih-sec-view [data-sih-act="undo"] .btn-icon').forEach(s => { s.innerHTML = iconHtml('undo'); });
  document.querySelectorAll('.sih-sec-view [data-sih-act="zoomfit"] .btn-icon').forEach(s => { s.innerHTML = iconHtml('zoomFit'); });

  // Background image: picked fresh each session, never persisted
  // (confirmed in chat).
  const bgInput = document.getElementById('sihBgInput');
  document.getElementById('sihBgBtn').addEventListener('click', () => bgInput.click());
  bgInput.addEventListener('change', async () => {
    const file = bgInput.files && bgInput.files[0];
    bgInput.value = '';
    if(!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    try{
      img.src = url;
      await img.decode();
      sihSetBackground(img, url);
    }catch(e){
      URL.revokeObjectURL(url);
      showBanner('Could not load that image');
    }
  });
  document.getElementById('sihBgRemoveBtn').addEventListener('click', () => sihSetBackground(null, null));

  document.getElementById('sihExportBtn').addEventListener('click', sihExportPng);

  document.getElementById('sihResetBtn').addEventListener('click', () => {
    if(!confirm('Clear all colours from your heart?\n\nYour last saved picture is kept until you Save again.')) return;
    sih.actions = [];
    sihRebuildFills();
    sihCompose();
    sihSetSaveStatus(false);
    sihUpdateUndoButtons();
    sihCloseSheets();
  });

  sihSetupViewportGestures();

  // Re-fit on resize/rotation only if the user was already at fit —
  // never destroys a zoomed-in view.
  window.addEventListener('resize', () => {
    if(!sih || !sih.loaded) return;
    if(document.getElementById('screen-sih').classList.contains('hidden')) return;
    if(sih.atFit){
      sihZoomToFit();
    } else {
      // Just recompute the fit-scale bounds for clamping — a zoomed-in
      // view is deliberately left exactly where the user put it.
      const vp = document.getElementById('sihViewport');
      if(vp.clientWidth && vp.clientHeight){
        sih.fitScale = Math.min(vp.clientWidth / SIH_W, vp.clientHeight / SIH_H);
      }
    }
  });
}

// ---------- screen entry ----------

async function renderSihScreen(){
  sihWireUi();
  const firstBuild = !(sih && sih.loaded);
  if(firstBuild){
    if(!sihWheelBase) sihWheelBase = sihDrawWheelBase();
    await sihEnsureEngine();
    sihRestoreSaved();          // last saved picture, restored on entry
    sihRebuildFills();
    sihCompose();
    sihSetSaveStatus(true);     // freshly restored state == the saved state
    sihSetFillMode('solid');
    sihUpdateUndoButtons();
  }
  // Fit needs real layout sizes — the screen was display:none until now.
  requestAnimationFrame(() => {
    if(firstBuild || sih.atFit) sihZoomToFit();
  });
}
