// ============================================================
// Hifzhelper — "Surahs in my Heart" screen (V3.47.0)
//
// V3.47.0 replaces the V3.46.0 pixel flood-fill engine with a
// vector-region engine ("Option C", confirmed in chat), fixing the
// white specks inside letter counters at the root.
//
// Three layers, all inside one SVG sized to the artwork's viewBox:
//   1. Bottom: white page rect, then the optional background photo
//      (never persisted, confirmed in chat).
//   2. Middle: 115 closed region shapes (assets/quran-heart-regions.json)
//      — one per surah, Ash-Shu'ara in two parts — white by default.
//      These are what get coloured AND what catch taps. The shapes were
//      traced offline from the verified segmentation of the ORIGINAL
//      artwork in its own coordinate frame, dilated to tuck under the
//      linework (adjacent shapes overlap beneath lines), and audited at
//      export resolution: 100% coverage of every region, zero foreign
//      colour visible anywhere the artwork's ink doesn't cover (one
//      sub-perceptual anti-aliased seam pixel at x=0 where the artwork
//      itself is clipped by the viewBox — unavoidable in principle).
//      Each shape carries {k, n, ar}: stable key, surah number, Arabic
//      name. English names come from the app's own surahName(n)
//      (shared/data.js) — single source of truth.
//   3. Top: the original artwork (assets/quran-heart.svg) as an <image>,
//      pointer-events off. Names sit ABOVE the colour, so letter
//      counters colour correctly by construction, and taps on the
//      printed names fill their region (confirmed in chat).
//
// Taps exactly on boundary lines stay ignored (as before, confirmed in
// chat) via a hit-test against the text-free lines layer
// (assets/quran-heart-lines.svg) rasterized once at 1x — text-free, so
// this ignore mask does NOT re-ignore the names.
//
// Persistence: explicit Save, LOCAL DEVICE only, one picture per user
// (keyed by login id). Save format v2 = region keys; v1 pictures
// (V3.46.0 tap-coordinates) migrate silently on first load.
// Export stays 1191x1684 (offered higher, declined — confirmed in chat).
// ============================================================

const SIH_VB_W = 595.28;          // artwork viewBox
const SIH_VB_H = 841.89;
const SIH_BASE_W = 1191;          // base CSS size of the SVG = old canvas size,
const SIH_BASE_H = 1684;          // so all V3.46.0 fit/zoom math carries over
const SIH_EXPORT_W = 1191;        // export resolution (confirmed: keep)
const SIH_EXPORT_H = 1684;
const SIH_LINE_ALPHA = 64;        // lines-mask alpha at/above this = boundary line
const SIH_STORAGE_PREFIX = 'hh_sih_picture_';
const SIH_SVGNS = 'http://www.w3.org/2000/svg';
const SIH_XLINKNS = 'http://www.w3.org/1999/xlink';

let sih = null; // whole engine state, built lazily on first screen entry

function sihStorageKey(){
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
    regions: [],            // [{k, n, ar, d, el}] in asset order
    byKey: new Map(),
    actions: [],            // [{k, mode, c1, c2}]
    dirty: false,
    fillMode: 'solid',
    c1: { h: 350, s: 65, l: 60 }, c2: { h: 210, s: 65, l: 60 },
    activeSwatch: 1,
    svg: null, defs: null, regionsG: null,
    bgSvgImage: null,       // <image> in the SVG
    bgImage: null, bgUrl: null,   // HTMLImage copy for export
    artImage: null,         // HTMLImage copy for export
    linesMask: null,        // {data: Uint8Array (alpha), w, h} at 1x
    tf: { s: 1, tx: 0, ty: 0 }, fitScale: 1, atFit: true,
    committedScale: 1,      // scale the SVG is currently laid out at (crisp)
    chipTimer: null, commitTimer: null
  };

  // 1) Region shapes.
  const resp = await fetch('assets/quran-heart-regions.json?v=3.47.0');
  const data = await resp.json();

  // 2) Build the SVG scene.
  const vp = document.getElementById('sihViewport');
  const svg = document.createElementNS(SIH_SVGNS, 'svg');
  svg.setAttribute('id', 'sihSvg');
  svg.setAttribute('viewBox', `0 0 ${SIH_VB_W} ${SIH_VB_H}`);
  sih.svg = svg;

  const defs = document.createElementNS(SIH_SVGNS, 'defs');
  svg.appendChild(defs);
  sih.defs = defs;

  const page = document.createElementNS(SIH_SVGNS, 'rect');
  page.setAttribute('width', SIH_VB_W);
  page.setAttribute('height', SIH_VB_H);
  page.setAttribute('fill', '#ffffff');
  page.setAttribute('pointer-events', 'none');
  svg.appendChild(page);

  const bg = document.createElementNS(SIH_SVGNS, 'image');
  bg.setAttribute('x', 0); bg.setAttribute('y', 0);
  bg.setAttribute('width', SIH_VB_W); bg.setAttribute('height', SIH_VB_H);
  bg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); // cover
  bg.setAttribute('pointer-events', 'none');
  bg.style.display = 'none';
  svg.appendChild(bg);
  sih.bgSvgImage = bg;

  const g = document.createElementNS(SIH_SVGNS, 'g');
  svg.appendChild(g);
  sih.regionsG = g;
  for(const r of data.regions){
    const p = document.createElementNS(SIH_SVGNS, 'path');
    p.setAttribute('d', r.d);
    p.setAttribute('fill', '#ffffff');
    p.dataset.k = r.k;
    g.appendChild(p);
    const rec = { k: r.k, n: r.n, ar: r.ar, d: r.d, el: p };
    sih.regions.push(rec);
    sih.byKey.set(r.k, rec);
  }

  const art = document.createElementNS(SIH_SVGNS, 'image');
  const artUrl = 'assets/quran-heart.svg?v=3.47.0';
  art.setAttribute('href', artUrl);
  art.setAttributeNS(SIH_XLINKNS, 'xlink:href', artUrl); // older Safari
  art.setAttribute('x', 0); art.setAttribute('y', 0);
  art.setAttribute('width', SIH_VB_W); art.setAttribute('height', SIH_VB_H);
  art.setAttribute('pointer-events', 'none');
  svg.appendChild(art);

  vp.insertBefore(svg, vp.firstChild);

  // HTMLImage copy of the artwork for export composition.
  const artImg = new Image();
  artImg.src = artUrl;
  sih.artImage = artImg;
  await artImg.decode();

  // 3) Boundary-line tap-ignore mask: the TEXT-FREE lines layer at 1x.
  const linesImg = new Image();
  linesImg.src = 'assets/quran-heart-lines.svg?v=3.47.0';
  await linesImg.decode();
  const mw = Math.round(SIH_VB_W), mh = Math.round(SIH_VB_H);
  const mc = document.createElement('canvas');
  mc.width = mw; mc.height = mh;
  const mctx = mc.getContext('2d');
  mctx.drawImage(linesImg, 0, 0, mw, mh);
  const md = mctx.getImageData(0, 0, mw, mh).data;
  const mask = new Uint8Array(mw * mh);
  for(let i = 0; i < mw * mh; i++) mask[i] = md[i * 4 + 3];
  sih.linesMask = { data: mask, w: mw, h: mh };

  sih.loaded = true;
}

// ---------- fills ----------

function sihEnsureGradient(k){
  const id = 'sihg-' + k;
  let grad = document.getElementById(id);
  if(!grad){
    grad = document.createElementNS(SIH_SVGNS, 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('x1', 0); grad.setAttribute('y1', 0);
    grad.setAttribute('x2', 0); grad.setAttribute('y2', 1);  // vertical across shape bbox
    const s1 = document.createElementNS(SIH_SVGNS, 'stop');
    s1.setAttribute('offset', '0');
    const s2 = document.createElementNS(SIH_SVGNS, 'stop');
    s2.setAttribute('offset', '1');
    grad.appendChild(s1); grad.appendChild(s2);
    sih.defs.appendChild(grad);
  }
  return grad;
}

function sihApplyFill(rec, a){
  if(a.mode === 'gradient'){
    const grad = sihEnsureGradient(rec.k);
    grad.children[0].setAttribute('stop-color', sihCss(a.c1));
    grad.children[1].setAttribute('stop-color', sihCss(a.c2));
    rec.el.setAttribute('fill', `url(#sihg-${rec.k})`);
  } else {
    rec.el.setAttribute('fill', sihCss(a.c1));
  }
}

// Rebuild every region's fill from the actions list (used by undo,
// reset, restore). Later actions on the same region win.
function sihRecomputeFills(){
  const latest = new Map();
  for(const a of sih.actions) latest.set(a.k, a);
  for(const rec of sih.regions){
    const a = latest.get(rec.k);
    if(a) sihApplyFill(rec, a);
    else rec.el.setAttribute('fill', '#ffffff');
  }
}

// ---------- tap handling ----------

// Client coords -> viewBox coords (the SVG's rect spans the full scene).
function sihClientToViewBox(clientX, clientY){
  const rect = sih.svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * SIH_VB_W,
    y: (clientY - rect.top) / rect.height * SIH_VB_H
  };
}

function sihOnBoundaryLine(vx, vy){
  const m = sih.linesMask;
  const x = Math.floor(vx), y = Math.floor(vy);
  if(x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  return m.data[y * m.w + x] >= SIH_LINE_ALPHA;
}

function sihFillRegion(rec){
  const a = {
    k: rec.k,
    mode: sih.fillMode,
    c1: { h: sih.c1.h, s: sih.c1.s, l: sih.c1.l },
    c2: { h: sih.c2.h, s: sih.c2.s, l: sih.c2.l }
  };
  sih.actions.push(a);
  sihApplyFill(rec, a);
  sihSetSaveStatus(false);
  sihUpdateUndoButtons();
  sihShowChip(rec);
}

// tapTarget = the element under the finger at pointerdown (region paths
// are the only pointer-active elements in the scene).
function sihTap(clientX, clientY, tapTarget){
  const pt = sihClientToViewBox(clientX, clientY);
  if(sihOnBoundaryLine(pt.x, pt.y)) return;   // confirmed: line taps stay ignored
  let rec = null;
  if(tapTarget && tapTarget.dataset && tapTarget.dataset.k){
    rec = sih.byKey.get(tapTarget.dataset.k) || null;
  }
  if(!rec) return;                            // outside the heart
  sihFillRegion(rec);
}

// ---------- surah chip (confirmed in chat) ----------

function sihShowChip(rec){
  const chip = document.getElementById('sihChip');
  const en = (typeof surahName === 'function' && surahName(rec.n)) || '';
  chip.textContent = en ? `${rec.ar} · ${en}` : rec.ar;
  chip.classList.add('show');
  clearTimeout(sih.chipTimer);
  sih.chipTimer = setTimeout(() => chip.classList.remove('show'), 1500);
}

// ---------- undo ----------

function sihUndo(){
  if(!sih.actions.length) return;
  sih.actions.pop();
  sihRecomputeFills();
  sihSetSaveStatus(false);
  sihUpdateUndoButtons();
}

function sihUpdateUndoButtons(){
  document.querySelectorAll('[data-sih-act="undo"]').forEach(b => {
    b.disabled = !sih.actions.length;
  });
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
    localStorage.setItem(sihStorageKey(), JSON.stringify({ v: 2, actions: sih.actions }));
    sihSetSaveStatus(true);
  }catch(e){
    showBanner('Could not save on this device');
  }
}

// Migrate one V3.46.0 action ({x, y} in the old 1191x1684 internal
// frame) to a region key. The old engine only recorded taps that
// successfully filled a region interior, and the shapes cover every
// region interior fully (audited), so a containing shape exists.
function sihMigrateV1Action(a){
  const pt = new DOMPoint(a.x / 2, a.y / 2);   // old internal frame = 2x viewBox
  for(const rec of sih.regions){
    try{
      if(rec.el.isPointInFill(pt)){
        return { k: rec.k, mode: a.mode, c1: a.c1, c2: a.c2 };
      }
    }catch(e){ return null; }                  // API unavailable: drop quietly
  }
  return null;
}

function sihRestoreSaved(){
  try{
    const raw = localStorage.getItem(sihStorageKey());
    if(!raw) return;
    const data = JSON.parse(raw);
    if(!data || !Array.isArray(data.actions)) return;
    if(data.v === 2){
      sih.actions = data.actions;
    } else {
      // v1 (V3.46.0 tap-coordinate) picture: silent one-time migration.
      sih.actions = data.actions.map(sihMigrateV1Action).filter(Boolean);
    }
  }catch(e){ /* a corrupt save just means starting fresh */ }
}

// ---------- view transform (zoom / pan) ----------
// tf.s is the absolute scale relative to the SIH_BASE_W x SIH_BASE_H
// base box (identical semantics to V3.46.0). For vector crispness the
// SVG is re-laid-out ("committed") at the final scale after each
// gesture: during a gesture it scales via a cheap CSS transform, at
// rest it renders at its true size so lines stay sharp at every zoom.

function sihApplyTransform(){
  const t = sih.tf;
  const rel = t.s / sih.committedScale;
  sih.svg.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${rel})`;
  sih.atFit = Math.abs(t.s - sih.fitScale) < 0.001;
}

function sihCommitTransform(){
  sih.committedScale = sih.tf.s;
  sih.svg.style.width = (SIH_BASE_W * sih.committedScale) + 'px';
  sih.svg.style.height = (SIH_BASE_H * sih.committedScale) + 'px';
  sihApplyTransform();   // rel becomes 1 → pure translate, crisp render
}

function sihScheduleCommit(){
  clearTimeout(sih.commitTimer);
  sih.commitTimer = setTimeout(sihCommitTransform, 180);
}

function sihZoomToFit(){
  const vp = document.getElementById('sihViewport');
  const vw = vp.clientWidth, vh = vp.clientHeight;
  if(!vw || !vh) return;
  const s = Math.min(vw / SIH_BASE_W, vh / SIH_BASE_H);
  sih.fitScale = s;
  sih.tf = { s, tx: (vw - SIH_BASE_W * s) / 2, ty: (vh - SIH_BASE_H * s) / 2 };
  sihCommitTransform();
}

function sihClampScale(s){
  return Math.min(Math.max(s, sih.fitScale), sih.fitScale * 8);
}

function sihZoomAt(newScale, vx, vy){
  const t = sih.tf;
  const s = sihClampScale(newScale);
  const k = s / t.s;
  t.tx = vx - (vx - t.tx) * k;
  t.ty = vy - (vy - t.ty) * k;
  t.s = s;
  sihApplyTransform();
}

// ---------- gestures ----------

function sihSetupViewportGestures(){
  const vp = document.getElementById('sihViewport');
  const pointers = new Map();
  let panLast = null;
  let pinchStart = null;
  let down = null;            // {x, y, t, moved, target}

  vp.addEventListener('pointerdown', e => {
    vp.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(pointers.size === 1){
      down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, target: e.target };
      panLast = { x: e.clientX, y: e.clientY };
      pinchStart = null;
    } else if(pointers.size === 2){
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: sih.tf.s };
      down = null;
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
        sihTap(down.x, down.y, down.target);
      }
      down = null; panLast = null;
      if(pinchStart || Math.abs(sih.tf.s - sih.committedScale) > 0.0001) sihCommitTransform();
      pinchStart = null;
    } else if(pointers.size === 1){
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
    sihScheduleCommit();
  }, { passive: false });
}

// ---------- colour picker (hue/saturation wheel + lightness slider) ----------

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
      if(r > R) continue;
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const s = Math.min(1, r / R) * 100;
      const [pr, pg, pb] = sihHslToRgb(h, s, 50);
      im.data[i] = pr; im.data[i + 1] = pg; im.data[i + 2] = pb;
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
  if(sih.bgUrl && sih.bgUrl !== url) URL.revokeObjectURL(sih.bgUrl);
  sih.bgImage = img; sih.bgUrl = url;
  const el = sih.bgSvgImage;
  if(img){
    el.setAttribute('href', url);
    el.setAttributeNS(SIH_XLINKNS, 'xlink:href', url);
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
  document.getElementById('sihBgBtn').textContent = img ? 'Change background image' : 'Add background image';
  document.getElementById('sihBgRemoveBtn').classList.toggle('hidden', !img);
}

// ---------- export ----------

function sihFillsSvgString(){
  // Self-contained fills-only SVG (no external refs → safe to draw to
  // canvas). Gradients inlined per region from the live DOM state.
  const latest = new Map();
  for(const a of sih.actions) latest.set(a.k, a);
  let defs = '', shapes = '';
  for(const rec of sih.regions){
    const a = latest.get(rec.k);
    if(a && a.mode === 'gradient'){
      defs += `<linearGradient id="eg-${rec.k}" x1="0" y1="0" x2="0" y2="1">` +
              `<stop offset="0" stop-color="${sihCss(a.c1)}"/>` +
              `<stop offset="1" stop-color="${sihCss(a.c2)}"/></linearGradient>`;
      shapes += `<path d="${rec.d}" fill="url(#eg-${rec.k})"/>`;
    } else {
      shapes += `<path d="${rec.d}" fill="${a ? sihCss(a.c1) : '#ffffff'}"/>`;
    }
  }
  return `<svg xmlns="${SIH_SVGNS}" viewBox="0 0 ${SIH_VB_W} ${SIH_VB_H}" ` +
         `width="${SIH_EXPORT_W}" height="${SIH_EXPORT_H}"><defs>${defs}</defs>${shapes}</svg>`;
}

function sihDrawCover(ctx, img, w, h){
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function sihExportPng(){
  let withBg = false;
  if(sih.bgImage){
    withBg = confirm('Include the background image in the PNG?\n\nOK = with background, Cancel = without');
  }
  const blob = new Blob([sihFillsSvgString()], { type: 'image/svg+xml' });
  const fillsUrl = URL.createObjectURL(blob);
  const fillsImg = new Image();
  fillsImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = SIH_EXPORT_W; c.height = SIH_EXPORT_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, SIH_EXPORT_W, SIH_EXPORT_H);
    if(withBg) sihDrawCover(ctx, sih.bgImage, SIH_EXPORT_W, SIH_EXPORT_H);
    ctx.drawImage(fillsImg, 0, 0, SIH_EXPORT_W, SIH_EXPORT_H);
    ctx.drawImage(sih.artImage, 0, 0, SIH_EXPORT_W, SIH_EXPORT_H);
    URL.revokeObjectURL(fillsUrl);
    c.toBlob(png => {
      if(!png){ showBanner('Could not create the PNG'); return; }
      const url = URL.createObjectURL(png);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'surahs-in-my-heart.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  };
  fillsImg.onerror = () => { URL.revokeObjectURL(fillsUrl); showBanner('Could not create the PNG'); };
  fillsImg.src = fillsUrl;
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
    sihRecomputeFills();
    sihSetSaveStatus(false);
    sihUpdateUndoButtons();
    sihCloseSheets();
  });

  sihSetupViewportGestures();

  window.addEventListener('resize', () => {
    if(!sih || !sih.loaded) return;
    if(document.getElementById('screen-sih').classList.contains('hidden')) return;
    if(sih.atFit){
      sihZoomToFit();
    } else {
      const vp = document.getElementById('sihViewport');
      if(vp.clientWidth && vp.clientHeight){
        sih.fitScale = Math.min(vp.clientWidth / SIH_BASE_W, vp.clientHeight / SIH_BASE_H);
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
    sihRestoreSaved();          // last saved picture (v1 saves migrate here)
    sihRecomputeFills();
    sihSetSaveStatus(true);     // freshly restored state == the saved state
    sihSetFillMode('solid');
    sihUpdateUndoButtons();
  }
  requestAnimationFrame(() => {
    if(firstBuild || sih.atFit) sihZoomToFit();
  });
}
