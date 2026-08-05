/* Session Timer — dependency-free <session-timer> custom element.
 *
 * Hifzhelper-adapted copy of the originally-supplied session-timer.js.
 * Changes made across 2 rounds (2026-08-04, confirmed in chat each time):
 *
 * Round 1: added "Start Dhor"/"Stop Dhor" text labels beneath the two
 * round control buttons (.ctrl-col/.ctrl-label).
 *
 * Round 2 (this one) -- icon semantics substantially redefined:
 *   - Close now stops AND discards (host app resets+hides on 'timer-close'
 *     rather than minimising) -- was minimise before, now a real "throw
 *     this session away" action, distinct from the new Minimise button.
 *   - Reset now also stops the clock, not just zeros it while continuing
 *     to tick -- the supplied reset() left _running untouched; added
 *     `this._running = false` so it always waits for a deliberate Start.
 *   - "Save" renamed "Note Time" throughout (data-act, aria labels) and
 *     re-iconed to a clipboard-clock (user-supplied notetime.svg) --
 *     still emits the same 'timer-save' event name, only the surface
 *     changed, not what the host app listens for.
 *   - New dedicated Minimise icon (full view, 4th icon in .top) and
 *     Maximise icon (on the pill itself) -- the pill's body is no longer
 *     one big "tap anywhere to expand" button, since it now holds
 *     several independently-tappable controls of its own (elapsed time,
 *     Lap, Pause/Restart), so a single dedicated tap target for
 *     re-expanding was needed. Minimise is a pure internal mode switch
 *     (no event -- nothing outside the component needs to react to it);
 *     Maximise still emits 'timer-expand', same as the old tap-to-expand
 *     mini button did.
 *   - Pill (.mini) markup rebuilt entirely: a top row of 3 small icons
 *     (Close/Reset/Note Time, mirroring the full view's top row) above a
 *     second row (elapsed time, Lap, Pause/Restart toggle, Maximise).
 *
 *   <script src="session-timer.js"></script>
 *   <session-timer target="25" accent="#0a84ff"></session-timer>
 *
 * Attributes
 *   target="25"        target in minutes (drives the ring); default 25
 *   accent="#e5342a"   marker / stop-square colour
 *   mode="full|mini"   full screen or minimised pill; default "full"
 *   laps="off"         hide the LAP button and lap list
 *   persist="key"      keep elapsed + laps in localStorage under `key`
 * Properties / methods
 *   el.elapsed (ms, get/set)   el.laps -> [ms,...]   el.running
 *   el.start() el.pause() el.toggle() el.stop() el.lap() el.reset()
 *   el.mode = 'mini' | 'full'
 * Events (all bubble + compose, detail { elapsed, laps, running })
 *   timer-start, timer-pause, timer-stop, timer-lap, timer-reset,
 *   timer-save, timer-close, timer-expand
 *   Stop halts the clock and KEEPS the time on screen; reset now also
 *   halts it (see above) as well as clearing it.
 */
(function () {
  const fmt = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };
  const ICON = {
    close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    reset: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><polyline points="20 3 20 8 15 8"/>',
    // "Note Time" (was "Save") -- user-supplied notetime.svg, a
    // clipboard-clock, verbatim path data.
    notetime: '<path d="M16 14v2.2l1.6 1"/><path d="M16 4h2a2 2 0 0 1 2 2v.832"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/><circle cx="16" cy="16" r="6"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    minimize: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10 21 3"/><path d="M3 21l7-7"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  };
  const iconBtn = (act, label, cls) =>
    '<button class="' + (cls || 'ic') + '" data-act="' + act + '" type="button" aria-label="' + label + '">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ICON[act] + '</svg>' + (cls ? '' : '<span>' + label + '</span>') + '</button>';

  const CSS = `
:host{display:block;background:#000;color:#fff;font-family:'Inter Tight',ui-sans-serif,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent}
:host([mode="mini"]){background:transparent}
.full{display:flex;flex-direction:column;height:100%;box-sizing:border-box;padding:14px 20px 20px;overflow:auto}
.top{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:4px 4px 0}
.ic{display:flex;flex-direction:column;align-items:center;gap:7px;background:none;border:0;padding:4px 0;color:#fff;cursor:pointer;font:inherit}
.ic:hover{opacity:.6}
.ic span{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93}
/* 2026-08-05, confirmed in chat: sized against a 390x844 (6.1") viewport
   specifically -- 70vh of 844px leaves ~591px for the whole card, minus
   .full's own padding leaves ~543px of real content space. The ring
   was a fixed 300px regardless of available height, which is what
   actually caused the clipping the user reported (not a padding
   problem -- padding alone couldn't have closed a gap that size).
   min(210px, 25vh) keeps 210px as the max on a screen at least this
   tall, but shrinks further on anything shorter, rather than a single
   hardcoded value that only happens to work for one specific device. */
.dial{display:flex;justify-content:center;padding:12px 0 4px}
.dial-in{position:relative;width:min(210px, 25vh);height:min(210px, 25vh)}
.dial svg{width:100%;height:100%;display:block;transform:rotate(-90deg)}
.read{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.time{font-size:44px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.of{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8e8e93}
.lapwrap{display:flex;justify-content:center;padding:14px 0 10px}
.lapbtn{min-width:160px;padding:12px 30px;border-radius:999px;border:0;background:#fff;color:#000;font:inherit;font-size:17px;font-weight:700;letter-spacing:.06em;cursor:pointer}
.lapbtn:hover{background:#e6e6e6}
.laps{flex:1;display:flex;flex-direction:column;gap:9px;align-items:center;overflow:hidden}
.laprow{display:grid;grid-template-columns:78px 96px;gap:12px;font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;color:#8e8e93}
.laprow.last{color:#fff}
.ctrls{display:flex;justify-content:center;gap:44px;padding-top:6px}
.ctrl-col{display:flex;flex-direction:column;align-items:center;gap:8px}
.ctrl-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93}
.rnd{width:72px;height:72px;border-radius:50%;border:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rnd:hover{background:#e6e6e6}
.sq{width:30px;height:30px;border-radius:4px;display:block}
.mini{display:flex;flex-direction:column;gap:10px;width:100%;padding:12px 16px;border-radius:22px;border:1px solid #2c2c30;background:rgba(20,20,22,.94);backdrop-filter:blur(12px);color:#fff;font:inherit;box-sizing:border-box}
.mini-top{display:flex;justify-content:center;align-items:center;gap:24px}
.mini-ic{background:none;border:0;padding:2px;color:#8e8e93;cursor:pointer;display:flex}
.mini-ic:hover{color:#fff}
.mini-ic svg{width:16px;height:16px}
.mini-max{background:none;border:0;color:#8e8e93;cursor:pointer;display:flex;padding:2px}
.mini-max:hover{color:#fff}
.mini-max svg{width:16px;height:16px}
.mini-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mini-toggle{width:36px;height:36px;border-radius:50%;border:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.mini-time{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;flex:1;text-align:center;min-width:0}
.mini-lap-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;flex:none}
.mini-lap{background:none;border:1px solid #47474d;border-radius:999px;padding:6px 13px;color:#fff;font:inherit;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.mini-lap:hover{border-color:#8e8e93}
.mini-lap-dots{display:flex;gap:3px;min-height:5px}
.mini-lap-dots span{width:5px;height:5px;border-radius:50%;background:#fff;display:block}
.hide{display:none}`;

  class SessionTimer extends HTMLElement {
    static get observedAttributes() { return ['target', 'accent', 'mode', 'laps']; }
    constructor() { super(); this._ms = 0; this._laps = []; this._lastLap = 0; this._running = false; }

    get elapsed() { return this._ms; }
    set elapsed(v) { this._ms = Math.max(0, Number(v) || 0); this._paint(); this._save(); }
    get laps() { return this._laps.slice(); }
    get running() { return this._running; }
    get mode() { return this.getAttribute('mode') || 'full'; }
    set mode(v) { this.setAttribute('mode', v); }
    get target() { return Math.max(1, Number(this.getAttribute('target') || 25)) * 60000; }
    get accent() { return this.getAttribute('accent') || '#e5342a'; }

    connectedCallback() {
      const p = this.getAttribute('persist');
      if (p) { try { const s = JSON.parse(localStorage.getItem(p) || 'null'); if (s) { this._ms = s.ms || 0; this._laps = s.laps || []; this._lastLap = s.lastLap || 0; } } catch (e) {} }
      this._build();
      this._loop = () => {
        if (this._running) {
          const now = performance.now();
          this._ms += now - (this._t0 || now);
          this._t0 = now;
          this._paint();
        }
        this._raf = requestAnimationFrame(this._loop);
      };
      this._raf = requestAnimationFrame(this._loop);
    }
    disconnectedCallback() { cancelAnimationFrame(this._raf); }
    attributeChangedCallback() { if (this._built) this._paint(); }

    _build() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + CSS + '</style>' +
        '<div class="full"><div class="top">' + iconBtn('close', 'Close') + iconBtn('reset', 'Reset') + iconBtn('notetime', 'Note Time') + iconBtn('minimize', 'Minimise') + '</div>' +
        '<div class="dial"><div class="dial-in"><svg viewBox="0 0 300 300">' +
        '<circle cx="150" cy="150" r="140" fill="none" stroke="#2a2a2c" stroke-width="10"></circle>' +
        '<circle class="arc" cx="150" cy="150" r="140" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="butt" stroke-dasharray="879.65" stroke-dashoffset="879.65"></circle>' +
        '<g class="dotg" transform="rotate(90 150 150)"><circle class="dot" cx="150" cy="10" r="9"></circle></g></svg>' +
        '<div class="read"><div class="time">00:00</div><div class="of">of 25:00</div></div></div></div>' +
        '<div class="lapwrap"><button class="lapbtn" data-act="lap" type="button">LAP</button></div>' +
        '<div class="laps"></div>' +
        '<div class="ctrls"><div class="ctrl-col"><button class="rnd" data-act="toggle" type="button"></button><span class="ctrl-label">Start Dhor</span></div>' +
        '<div class="ctrl-col"><button class="rnd" data-act="stop" type="button"><span class="sq"></span></button><span class="ctrl-label">Stop Dhor</span></div></div></div>' +
        '<div class="mini">' +
        '<div class="mini-top">' + iconBtn('close', 'Close', 'mini-ic') + iconBtn('reset', 'Reset', 'mini-ic') + iconBtn('notetime', 'Note Time', 'mini-ic') +
        '<button class="mini-max" data-act="maximize" type="button" aria-label="Maximise"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON.maximize + '</svg></button></div>' +
        '<div class="mini-row">' +
        '<button class="mini-toggle" data-act="toggle" type="button"></button>' +
        '<span class="mini-time">00:00</span>' +
        '<div class="mini-lap-wrap"><button class="mini-lap" data-act="lap" type="button">Lap</button><div class="mini-lap-dots"></div></div>' +
        '</div></div>';
      this.$ = (s) => root.querySelector(s);
      this.$$ = (s) => root.querySelectorAll(s);
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act;
        if (a === 'toggle') this.toggle();
        else if (a === 'lap') this.lap();
        else if (a === 'stop') this.stop();
        else if (a === 'reset') this.reset();
        else if (a === 'notetime') this._emit('timer-save');
        // Close: stops the clock the same way it always has -- discarding
        // the session entirely and hiding the overlay is the host app's
        // job (js/dhorPage.js's own 'timer-close' listener), not this
        // component's, since "hidden" isn't a concept this component
        // tracks about itself at all.
        else if (a === 'close') { this.pause(); this._emit('timer-close'); }
        // Minimise: a pure internal mode switch, no event -- nothing
        // outside this component needs to react to going small.
        else if (a === 'minimize') { this.mode = 'mini'; }
        // Maximise: same as the old tap-to-expand mini button used to be.
        else if (a === 'maximize') { this.mode = 'full'; this._emit('timer-expand'); }
      });
      this._built = true;
      this._paint();
    }

    _emit(name) {
      this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true,
        detail: { elapsed: this._ms, laps: this.laps, running: this._running } }));
    }
    _save() {
      const p = this.getAttribute('persist');
      if (p) { try { localStorage.setItem(p, JSON.stringify({ ms: this._ms, laps: this._laps, lastLap: this._lastLap })); } catch (e) {} }
    }

    start() { if (this._running) return; this._t0 = performance.now(); this._running = true; this._paint(); this._emit('timer-start'); }
    pause() { if (!this._running) return; this._running = false; this._paint(); this._save(); this._emit('timer-pause'); }
    toggle() { this._running ? this.pause() : this.start(); }
    stop() { this._running = false; this._paint(); this._save(); this._emit('timer-stop'); }
    lap() { this._laps.push(this._ms - this._lastLap); this._lastLap = this._ms; this._paint(); this._save(); this._emit('timer-lap'); }
    // Reset now also stops the clock (this._running = false), not just
    // zeros it while leaving it running -- confirmed in chat: "Reset
    // stops and resets," waiting for a deliberate Start rather than
    // continuing to tick from 0. The supplied version left _running
    // untouched here.
    reset() { this._ms = 0; this._laps = []; this._lastLap = 0; this._running = false; this._t0 = performance.now(); this._paint(); this._save(); this._emit('timer-reset'); }

    _paint() {
      if (!this._built) return;
      const mini = this.mode === 'mini', frac = Math.min(1, this._ms / this.target), acc = this.accent;
      this.$('.full').classList.toggle('hide', mini);
      this.$('.mini').classList.toggle('hide', !mini);
      this.$('.time').textContent = fmt(this._ms);
      this.$('.of').textContent = 'of ' + fmt(this.target);
      const arc = this.$('.arc');
      arc.setAttribute('stroke-dashoffset', (2 * Math.PI * 140 * (1 - frac)).toFixed(1));
      arc.setAttribute('stroke-linecap', frac > 0.002 ? 'round' : 'butt');
      this.$('.dotg').setAttribute('transform', 'rotate(' + (90 + frac * 360).toFixed(2) + ' 150 150)');
      this.$('.dot').setAttribute('fill', acc);
      this.$('.sq').style.background = acc;
      // Both the big round toggle (full view) and the small pill toggle
      // now share data-act="toggle" -- querySelectorAll+forEach updates
      // both, where the old single this.$(...) would only ever have
      // touched the first match.
      const toggleOnHtml = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.2" height="16" rx="1"/><rect x="13.8" y="4" width="4.2" height="16" rx="1"/></svg>';
      const toggleOffHtml = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20"/></svg>';
      this.$$('[data-act="toggle"]').forEach(el => { el.innerHTML = this._running ? toggleOnHtml : toggleOffHtml; });
      const showLaps = this.getAttribute('laps') !== 'off';
      this.$('.lapwrap').classList.toggle('hide', !showLaps);
      this.$$('.mini-lap').forEach(el => el.classList.toggle('hide', !showLaps));
      this.$('.laps').innerHTML = !showLaps ? '' : this._laps.slice(-4).map((v, i, a) =>
        '<div class="laprow' + (i === a.length - 1 ? ' last' : '') + '"><span>Lap ' +
        (this._laps.length - a.length + i + 1) + '</span><span>' + fmt(v) + '</span></div>').join('');
      this.$('.mini-time').textContent = fmt(this._ms);
      // Item 8 (2026-08-04, confirmed in chat): one small white dot per
      // recorded lap, right under the Lap button -- at-a-glance
      // confirmation of how many laps have actually been recorded, not
      // just that at least one was.
      this.$('.mini-lap-dots').innerHTML = this._laps.map(() => '<span></span>').join('');
    }
  }

  if (typeof customElements !== 'undefined' && !customElements.get('session-timer'))
    customElements.define('session-timer', SessionTimer);
})();
