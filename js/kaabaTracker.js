/* Kaaba Juz Tracker — self-contained isometric Kaaba cube with 30 clickable juz tiles.
 *
 *   <kaaba-juz-tracker persist="hifz.juz" controls="full"></kaaba-juz-tracker>
 *
 * Attributes
 *   value="1,2,5"      completed juz (also a JS property: el.value = [1,2,5])
 *   persist="key"      save/restore from localStorage under `key`
 *   controls="none"    hide the built-in progress bar + buttons (default "full")
 *   labels="off"       hide the "Juz n" captions
 *   mode="freeplay"    V3.49.0 fidget-toy mode (confirmed in chat): blank
 *                      unnumbered Kaaba, every tile tappable dark/light,
 *                      band strips (per side) and the door as separate
 *                      3-state cycles (blank → black/dark → gold → blank).
 *                      Nothing saved; the real tracker state is untouched
 *                      and re-renders exactly as it was on switching back.
 * Properties / methods
 *   el.value -> [1,2,...]        el.value = [...]
 *   el.toggle(n) / el.setJuz(n, true|false) / el.reset() / el.markNext()
 *   el.total  -> 30
 *   el.toSVG()  -> standalone SVG string of the current state
 * Events
 *   'juz-change' -> detail { completed:[..], count, total, juz, done }
 *
 * Also exposes window.KaabaTracker = { buildSVG, tiles, TOTAL }
 */
(function () {
  const N = 4, S = 100, W = Math.cos(Math.PI / 6) * S, H = S / 2, PAD = 26;
  const AR = '\u0627\u0644\u0644\u0647'; // الله
  const FONT_URL = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap';

  const proj = (x, y, z) => [(x - y) * W, (x + y) * H - z * S];
  const ptsOf = (poly) => poly.map((p) => {
    const q = proj(p[0], p[1], p[2]);
    return q[0].toFixed(2) + ',' + q[1].toFixed(2);
  }).join(' ');
  const mat = (face, c) => {
    const q = proj(c[0], c[1], c[2]);
    const m = face === 'top' ? [0.866, 0.5, -0.866, 0.5]
      : face === 'left' ? [0.866, 0.5, 0, 1]
      : [0.866, -0.5, 0, 1];
    return 'matrix(' + m.join(',') + ',' + q[0].toFixed(2) + ',' + q[1].toFixed(2) + ')';
  };

  /* ---- geometry ------------------------------------------------------- */
  function makeTiles() {
    const T = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      T.push({ face: 'top', poly: [[x, y, N], [x + 1, y, N], [x + 1, y + 1, N], [x, y + 1, N]], c: [x + 0.5, y + 0.5, N] });
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++)
      T.push({ face: 'left', x: x, z: z, door: (x === 1 && z <= 1),
        poly: [[x, N, z], [x + 1, N, z], [x + 1, N, z + 1], [x, N, z + 1]], c: [x + 0.5, N, z + 0.5] });
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++)
      T.push({ face: 'right', y: y, z: z,
        poly: [[N, y, z], [N, y + 1, z], [N, y + 1, z + 1], [N, y, z + 1]], c: [N, y + 0.5, z + 0.5] });

    // juz order: 16 roof tiles (row by row), then the two lower wall rows (the upper wall rows
    // carry the gold kiswah band and stay structural, as do the 2 door tiles).
    const order = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) order.push({ face: 'top', x: x, y: y });
    for (let z = 1; z >= 0; z--) {
      for (let x = 0; x < N; x++) if (x !== 1) order.push({ face: 'left', x: x, z: z });
      for (let y = N - 1; y >= 0; y--) order.push({ face: 'right', y: y, z: z });
    }
    order.forEach((k, i) => {
      const t = T.find((t) => t.face === k.face && (k.face === 'top'
        ? (t.c[0] === k.x + 0.5 && t.c[1] === k.y + 0.5)
        : t.z === k.z && (k.face === 'left' ? t.x === k.x : t.y === k.y)));
      t.juz = i + 1;
    });
    return T;
  }
  const tiles = makeTiles();
  const TOTAL = tiles.filter((t) => t.juz).length; // 30

  // gold kiswah band, as z-ranges clipped per tile
  const BANDS = [{ a: 2.66, b: 3.06, cls: 'band-main' }, { a: 2.54, b: 2.60, cls: 'band-thin' }];
  function bandPieces(t) {
    if (t.face === 'top') return [];
    const out = [];
    BANDS.forEach((b) => {
      const za = Math.max(b.a, t.z), zb = Math.min(b.b, t.z + 1);
      if (zb - za < 0.005) return;
      out.push({
        cls: b.cls, h: zb - za,
        poly: t.face === 'left'
          ? [[t.x, N, za], [t.x + 1, N, za], [t.x + 1, N, zb], [t.x, N, zb]]
          : [[N, t.y, za], [N, t.y + 1, za], [N, t.y + 1, zb], [N, t.y, zb]],
      });
    });
    return out;
  }

  const CSS = `
.kt-svg{display:block;width:100%;height:auto;max-height:70vh;overflow:visible;font-family:'Amiri',Georgia,'Times New Roman',serif;-webkit-tap-highlight-color:transparent}
.t .f{stroke-width:1;transition:fill .5s ease,stroke .5s ease}
.t.top .f{fill:#eceae3;stroke:#d4d0c5}
.t.left .f{fill:#e2dfd6;stroke:#cfcbc0}
.t.right .f{fill:#e9e6df;stroke:#d4d0c5}
.t.done.top .f{fill:#332d4a;stroke:#0c0a14}
.t.done.left .f{fill:#141220;stroke:#0c0a14}
.t.done.right .f{fill:#201c33;stroke:#0c0a14}
.t .ar{fill:#a19a8b;opacity:.3;transition:fill .5s ease,opacity .5s ease}
.t.done .ar{fill:#b9ab8e;opacity:.92}
.t .lb{font-family:ui-sans-serif,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;letter-spacing:.4px;fill:#7d776b;transition:fill .5s ease,opacity .5s ease}
.t.done .lb{fill:#cbbc9d;opacity:.42}
.t.act{cursor:pointer}
.t.act:hover .f{stroke:#e2a52c;stroke-width:2.6}
.t.act:hover .ar{opacity:.55}
.t.act.done:hover .ar{opacity:1}
.band{opacity:0;transition:opacity .55s ease}
.band.done{opacity:1}
.band.left{fill:#eb9c14}
.band.right{fill:#f8b93a}
.outline{fill:none;stroke:#0c0a14;stroke-width:1.6;opacity:.5;pointer-events:none}
.door{fill:#e9990f}.door-hi{fill:#ffc94d}
/* V3.49.0 free play (confirmed in chat): every tile tappable (they all
   carry .act, so the existing cursor/hover rules apply); the band strip
   per side and the door are separate 3-state units — blank → black →
   gold visible → blank. Hidden elements (opacity 0) still receive
   taps, which is exactly what drives states 0 → 1. */
.fp .fp-band{cursor:pointer}
.fp .fp-band .band{opacity:0;transition:opacity .4s ease,fill .4s ease}
.fp .fp-band.s1 .band{opacity:1;fill:#141220}
.fp .fp-band.s2 .band{opacity:1}
.fp .door-grp{cursor:pointer;opacity:0;transition:opacity .4s ease}
.fp .door-grp.s2{opacity:1}`;

  /* ---- markup --------------------------------------------------------- */
  function buildSVG(completed, opts) {
    opts = opts || {};
    const done = new Set((completed || []).map(Number));
    const labels = opts.labels !== false;
    const freeplay = !!opts.freeplay; // V3.49.0: fidget-toy mode (confirmed in chat)
    const vb = [(-N * W - PAD).toFixed(1), (-N * S - PAD).toFixed(1),
      (2 * N * W + 2 * PAD).toFixed(1), (2 * N * H + N * S + 2 * PAD).toFixed(1)].join(' ');

    let tileSvg = '', bandSvg = '', bandL = '', bandR = '';
    tiles.forEach((t, idx) => {
      // Free play: blank slate — nothing pre-marked, no structural darks,
      // every tile individually tappable (door tiles cycle as one door
      // unit instead, via data-fpdoor). Tracker mode: unchanged.
      const isDone = freeplay ? false : (!t.juz || done.has(t.juz));
      const act = freeplay ? true : !!t.juz;
      const cls = ['t', t.face, isDone ? 'done' : '', act ? 'act' : ''].filter(Boolean).join(' ');
      let g = '<g class="' + cls + '"';
      if (freeplay) g += t.door ? ' data-fpdoor=""' : ' data-fp="' + idx + '"';
      else if (t.juz) g += ' data-juz="' + t.juz + '"';
      g += '>';
      g += '<polygon class="f" points="' + ptsOf(t.poly) + '"/>';
      const bands = bandPieces(t);
      const underBand = bands.reduce((a, b) => a + b.h, 0) > 0.15; // the 8 kiswah tiles: gold, no calligraphy
      if (!t.door && !underBand) {
        const m = mat(t.face, t.c);
        g += '<text class="ar" transform="' + m + '" text-anchor="middle" dominant-baseline="central" y="' +
          (t.juz && labels && !freeplay ? -8 : 0) + '" font-size="46">' + AR + '</text>';
        if (t.juz && labels && !freeplay)
          g += '<text class="lb" transform="' + m + '" text-anchor="middle" dominant-baseline="central" y="28">Juz ' + t.juz + '</text>';
      }
      g += '</g>';
      tileSvg += g;
      bands.forEach((b) => {
        if (freeplay) {
          // collected per side into one tappable 3-state group below
          const piece = '<polygon class="band ' + b.cls + ' ' + t.face + '" points="' + ptsOf(b.poly) + '"/>';
          if (t.face === 'left') bandL += piece; else bandR += piece;
        } else {
          bandSvg += '<polygon class="band ' + b.cls + ' ' + t.face + (isDone ? ' done' : '') + '"' +
            (t.juz ? ' data-juz="' + t.juz + '"' : '') + ' points="' + ptsOf(b.poly) + '"/>';
        }
      });
    });
    if (freeplay) {
      bandSvg = '<g class="fp-band" data-fpband="left">' + bandL + '</g>' +
        '<g class="fp-band" data-fpband="right">' + bandR + '</g>';
    }

    const door = '<polygon class="door" points="' + ptsOf([[1.12, N, 0], [1.9, N, 0], [1.9, N, 1.92], [1.12, N, 1.92]]) + '"/>' +
      '<polygon class="door-hi" points="' + ptsOf([[1.56, N, 0], [1.8, N, 0], [1.8, N, 1.92], [1.56, N, 1.92]]) + '"/>';

    const outline = '<polygon class="outline" points="' +
      ptsOf([[0, 0, N], [N, 0, N], [N, 0, 0], [N, N, 0], [0, N, 0], [0, N, N]]) + '"/>';

    return '<svg class="kt-svg' + (freeplay ? ' fp' : '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" role="img" aria-label="' +
      (freeplay ? 'Kaaba free play' : 'Kaaba juz tracker') + '">' +
      (opts.embedStyle ? '<defs><style>@import url(' + FONT_URL + ');' + CSS + '</style></defs>' : '') +
      '<g class="tiles">' + tileSvg + '</g><g class="bands">' + bandSvg + '</g>' +
      '<g class="door-grp"' + (freeplay ? ' data-fpdoor=""' : '') + '>' + door + '</g>' +
      outline + '</svg>';
  }

  /* ---- element -------------------------------------------------------- */
  function ensureFont() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-kaaba-font]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_URL; l.setAttribute('data-kaaba-font', '');
    document.head.appendChild(l);
  }

  class KaabaJuzTracker extends HTMLElement {
    static get observedAttributes() { return ['value', 'persist', 'labels', 'controls', 'mode']; }
    constructor() { super(); this._set = new Set(); this._built = false; }

    get total() { return TOTAL; }
    get value() { return [...this._set].sort((a, b) => a - b); }
    set value(v) { this._set = new Set((v || []).map(Number).filter((n) => n >= 1 && n <= TOTAL)); this._sync(); this._save(); }

    // V3.49.0: 'freeplay' (fidget toy, confirmed in chat) or 'tracker'.
    // Free-play state is in-memory DOM classes only — nothing is ever
    // saved, and the real tracker state (this._set) is never touched
    // while playing, so switching back re-renders it exactly as it was.
    _mode() { return this.getAttribute('mode') === 'freeplay' ? 'freeplay' : 'tracker'; }

    connectedCallback() {
      ensureFont();
      const p = this.getAttribute('persist');
      if (p) { try { const s = JSON.parse(localStorage.getItem(p) || '[]'); if (Array.isArray(s)) s.forEach((n) => this._set.add(Number(n))); } catch (e) {} }
      const a = this.getAttribute('value');
      if (a) a.split(',').map((s) => Number(s.trim())).filter(Boolean).forEach((n) => this._set.add(n));
      this._build();
    }
    attributeChangedCallback(name, o, v) {
      if (!this._built) return;
      if (name === 'value') this.value = (v || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
      else this._build();
    }

    _build() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const freeplay = this._mode() === 'freeplay';
      const controls = !freeplay && (this.getAttribute('controls') || 'full') !== 'none';
      // Entering free play always starts blank ("untiled image",
      // confirmed in chat) — 3-state cycles for the two band sides and
      // the door, tracked here, discarded on every rebuild.
      this._fpBand = { left: 0, right: 0 };
      this._fpDoor = 0;
      root.innerHTML =
        '<style>:host{display:block}' + CSS + `
.kt-wrap{display:flex;flex-direction:column;gap:18px;align-items:stretch}
.kt-bar{display:flex;flex-wrap:wrap;align-items:center;gap:14px;font-family:ui-sans-serif,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#3a3630}
.kt-count{font-size:15px;letter-spacing:.02em}
.kt-count b{font-size:22px;font-weight:600}
.kt-track{flex:1;min-width:140px;height:5px;border-radius:3px;background:#dedad0;overflow:hidden}
.kt-fill{height:100%;width:0;background:#e9990f;transition:width .5s ease}
.kt-btn{font:inherit;font-size:13px;letter-spacing:.02em;padding:8px 14px;border-radius:999px;border:1px solid #cfcbc0;background:transparent;color:#3a3630;cursor:pointer;transition:background .2s,border-color .2s}
.kt-btn:hover{background:#eae7de;border-color:#b8b3a6}
.kt-btn.primary{background:#1a1728;border-color:#1a1728;color:#f2efe7}
.kt-btn.primary:hover{background:#2b2740}
.kt-btn:disabled{opacity:.4;cursor:default}
</style><div class="kt-wrap">` +
        (freeplay
          ? buildSVG([], { labels: false, freeplay: true })
          : buildSVG(this.value, { labels: this.getAttribute('labels') !== 'off' })) +
        (controls ? '<div class="kt-bar"><div class="kt-count"><b class="kt-n">0</b> / ' + TOTAL + ' juz</div>' +
          '<div class="kt-track"><div class="kt-fill"></div></div>' +
          '<button class="kt-btn primary" data-act="next">Mark next juz</button>' +
          '<button class="kt-btn" data-act="svg">Download SVG</button>' +
          '<button class="kt-btn" data-act="reset">Reset</button></div>' : '') +
        '</div>';
      this._svg = root.querySelector('svg');
      this._svg.addEventListener('click', (e) => {
        if (this._mode() === 'freeplay') { this._fpClick(e); return; }
        const g = e.target.closest('g.act');
        if (g) this.toggle(Number(g.dataset.juz));
      });
      root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'next') this.markNext();
        else if (a === 'reset') this.reset();
        else this.downloadSVG();
      }));
      this._built = true;
      if (!freeplay) this._sync();
    }

    // Free-play tap dispatch (V3.49.0). Bands are drawn above tiles and
    // checked first; the door graphic and both door tiles share
    // data-fpdoor so a tap anywhere on the door cycles it as one unit;
    // everything else toggles its own tile dark/light.
    _fpClick(e) {
      const band = e.target.closest('[data-fpband]');
      if (band) {
        const side = band.getAttribute('data-fpband');
        const s = (this._fpBand[side] + 1) % 3;   // blank → black → gold → blank
        this._fpBand[side] = s;
        band.classList.toggle('s1', s === 1);
        band.classList.toggle('s2', s === 2);
        return;
      }
      const doorHit = e.target.closest('[data-fpdoor]');
      if (doorHit) {
        const s = (this._fpDoor + 1) % 3;         // blank → tiles dark → dark + gold door → blank
        this._fpDoor = s;
        this._svg.querySelectorAll('g.t[data-fpdoor]').forEach((t) => t.classList.toggle('done', s >= 1));
        this._svg.querySelector('.door-grp').classList.toggle('s2', s === 2);
        return;
      }
      const g = e.target.closest('g.t[data-fp]');
      if (g) g.classList.toggle('done');
    }

    _sync() {
      if (!this._svg) return;
      this._svg.querySelectorAll('[data-juz]').forEach((el) => {
        el.classList.toggle('done', this._set.has(Number(el.dataset.juz)));
      });
      const root = this.shadowRoot, n = this._set.size;
      const nEl = root && root.querySelector('.kt-n'), fEl = root && root.querySelector('.kt-fill');
      if (nEl) nEl.textContent = n;
      if (fEl) fEl.style.width = (n / TOTAL * 100) + '%';
      const nx = root && root.querySelector('[data-act="next"]');
      if (nx) nx.disabled = n >= TOTAL;
    }
    _save() {
      const p = this.getAttribute('persist');
      if (p) { try { localStorage.setItem(p, JSON.stringify(this.value)); } catch (e) {} }
    }
    _emit(juz) {
      this.dispatchEvent(new CustomEvent('juz-change', {
        bubbles: true, composed: true,
        detail: { completed: this.value, count: this._set.size, total: TOTAL, juz: juz, done: juz ? this._set.has(juz) : undefined },
      }));
    }
    setJuz(n, on) {
      n = Number(n);
      if (!(n >= 1 && n <= TOTAL)) return;
      if (on) this._set.add(n); else this._set.delete(n);
      this._sync(); this._save(); this._emit(n);
    }
    toggle(n) { this.setJuz(n, !this._set.has(Number(n))); }
    markNext() { for (let i = 1; i <= TOTAL; i++) if (!this._set.has(i)) { this.setJuz(i, true); return; } }
    reset() { this._set.clear(); this._sync(); this._save(); this._emit(null); }
    toSVG() { return buildSVG(this.value, { embedStyle: true, labels: this.getAttribute('labels') !== 'off' }); }
    downloadSVG(filename) {
      const blob = new Blob([this.toSVG()], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'kaaba-juz-tracker.svg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }

  if (typeof customElements !== 'undefined' && !customElements.get('kaaba-juz-tracker'))
    customElements.define('kaaba-juz-tracker', KaabaJuzTracker);

  const api = { buildSVG: buildSVG, tiles: tiles, TOTAL: TOTAL, CSS: CSS };
  if (typeof window !== 'undefined') window.KaabaTracker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
