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
 * Round 3 (2026-08-15, confirmed in chat) -- two independent additions,
 * bundled together since both landed the same session:
 *   - Screen Wake Lock: held if and only if mode="full" AND actually
 *     running -- maximising alone doesn't hold it, pausing while still
 *     maximised releases it. One _syncWakeLock() check, called from
 *     every method that can change either of those two things, rather
 *     than each managing the lock itself. Feature-detected + try/catch:
 *     silently a no-op on anything without the API, or if the platform
 *     declines the request (low battery, etc). Re-acquires on
 *     visibilitychange, since the browser silently drops the
 *     underlying OS lock whenever the tab/screen goes into the
 *     background -- without that it wouldn't resume on its own when
 *     the student comes back mid-session.
 *   - Lap list: the old .laps was capped to the last 4, and in
 *     practice had nowhere near enough leftover flex space to show
 *     even that many (~1 row before overflow:hidden clipped the
 *     rest) -- cap removed, list moved to sit beside the ring (.dial
 *     is now a row: laps on the left, ring on the right), ring sized
 *     down ~20% to make room. Scrolls to the newest lap on Lap; free
 *     to scroll back up through history the rest of the time.
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
    // 2026-08-05, confirmed in chat: dedicated drag-handle icon,
    // replacing the earlier press-and-hold-anywhere approach entirely --
    // that approach's timed hold left enough of a window for the
    // device's own native long-press gesture (text selection, a context
    // menu) to fire at the same time and reach through to whatever was
    // visually underneath the pill. A handle sidesteps that at the
    // mechanism level: touching down on it starts the drag immediately,
    // with no hold duration for a native gesture to have time to engage
    // in the first place.
    move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/>',
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
   hardcoded value that only happens to work for one specific device.
   2026-08-15, confirmed in chat: ring shrunk a further ~20%
   (210->168, 25vh->20vh, user's figure) and .dial switched from a
   centered column to a row -- the freed width is what the full
   (uncapped) lap list sits in, to its left. Same viewport reference
   as above still holds: 140px for .laps + 14px gap + 168px ring =
   322px, comfortably under the ~350px of content width .full's own
   padding leaves on a 390px-wide phone. */
.dial{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 4px 4px}
.dial-in{position:relative;width:min(168px, 20vh);height:min(168px, 20vh);flex:none}
.dial svg{width:100%;height:100%;display:block;transform:rotate(-90deg)}
.read{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.time{font-size:44px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.of{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8e8e93}
.lapwrap{display:flex;justify-content:center;padding:14px 0 10px}
.lapbtn{min-width:160px;padding:12px 30px;border-radius:999px;border:0;background:#fff;color:#000;font:inherit;font-size:17px;font-weight:700;letter-spacing:.06em;cursor:pointer}
.lapbtn:hover{background:#e6e6e6}
.laps{width:140px;height:min(168px, 20vh);flex:none;display:flex;flex-direction:column;gap:6px;overflow-y:auto;padding-right:2px}
.laprow{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:#8e8e93}
.laprow.last{color:#fff}
.ctrls{display:flex;justify-content:center;gap:44px;padding-top:6px}
.ctrl-col{display:flex;flex-direction:column;align-items:center;gap:8px}
.ctrl-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93}
.rnd{width:72px;height:72px;border-radius:50%;border:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rnd:hover{background:#e6e6e6}
.sq{width:30px;height:30px;border-radius:4px;display:block}
.mini{display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px;padding:12px 16px;border-radius:22px;border:1px solid #2c2c30;background:rgba(20,20,22,.94);backdrop-filter:blur(12px);color:#fff;font:inherit;box-sizing:border-box;pointer-events:auto}
.mini.dragging{box-shadow:0 8px 24px rgba(0,0,0,.5);border-color:#8e8e93}
.mini-top{display:flex;justify-content:center;align-items:center;gap:24px}
.mini-ic{background:none;border:0;padding:2px;color:#8e8e93;cursor:pointer;display:flex}
.mini-drag-handle{background:none;border:0;padding:2px;color:#8e8e93;cursor:grab;display:flex;touch-action:none;user-select:none}
.mini-drag-handle:active{cursor:grabbing}
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
    constructor() { super(); this._ms = 0; this._laps = []; this._lastLap = 0; this._running = false; this._wakeLock = null; }

    get elapsed() { return this._ms; }
    set elapsed(v) { this._ms = Math.max(0, Number(v) || 0); this._paint(); this._save(); }
    get laps() { return this._laps.slice(); }
    get running() { return this._running; }
    get mode() { return this.getAttribute('mode') || 'full'; }
    set mode(v) { this.setAttribute('mode', v); this._syncWakeLock(); }
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
      // 2026-08-15, confirmed in chat: the Wake Lock API is silently
      // revoked by the browser whenever the tab/screen goes into the
      // background, so a maximised, still-running timer needs to
      // re-request it on coming back -- otherwise it'd just stay
      // unlocked for the rest of the session with no way back short
      // of re-maximising.
      this._onVisibility = () => { if (document.visibilityState === 'visible') this._syncWakeLock(); };
      document.addEventListener('visibilitychange', this._onVisibility);
    }
    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._releaseWakeLock();
    }
    attributeChangedCallback() { if (this._built) this._paint(); }

    _build() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + CSS + '</style>' +
        '<div class="full"><div class="top">' + iconBtn('close', 'Close') + iconBtn('reset', 'Reset') + iconBtn('notetime', 'Note Time') + iconBtn('minimize', 'Minimise') + '</div>' +
        '<div class="dial"><div class="laps"></div><div class="dial-in"><svg viewBox="0 0 300 300">' +
        '<circle cx="150" cy="150" r="140" fill="none" stroke="#2a2a2c" stroke-width="10"></circle>' +
        '<circle class="arc" cx="150" cy="150" r="140" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="butt" stroke-dasharray="879.65" stroke-dashoffset="879.65"></circle>' +
        '<g class="dotg" transform="rotate(90 150 150)"><circle class="dot" cx="150" cy="10" r="9"></circle></g></svg>' +
        '<div class="read"><div class="time">00:00</div><div class="of">of 25:00</div></div></div></div>' +
        '<div class="lapwrap"><button class="lapbtn" data-act="lap" type="button">LAP</button></div>' +
        '<div class="ctrls"><div class="ctrl-col"><button class="rnd" data-act="toggle" type="button"></button><span class="ctrl-label">Start Dhor</span></div>' +
        '<div class="ctrl-col"><button class="rnd" data-act="stop" type="button"><span class="sq"></span></button><span class="ctrl-label">Stop Dhor</span></div></div></div>' +
        '<div class="mini">' +
        '<div class="mini-top"><button class="mini-drag-handle" data-act="drag-handle" type="button" aria-label="Drag to move"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON.move + '</svg></button>' + iconBtn('close', 'Close', 'mini-ic') + iconBtn('reset', 'Reset', 'mini-ic') + iconBtn('notetime', 'Note Time', 'mini-ic') +
        '<button class="mini-max" data-act="maximize" type="button" aria-label="Maximise"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON.maximize + '</svg></button></div>' +
        '<div class="mini-row">' +
        '<button class="mini-toggle" data-act="toggle" type="button"></button>' +
        '<span class="mini-time">00:00</span>' +
        '<div class="mini-lap-wrap"><button class="mini-lap" data-act="lap" type="button">Lap</button><div class="mini-lap-dots"></div></div>' +
        '</div></div>';
      this.$ = (s) => root.querySelector(s);
      this.$$ = (s) => root.querySelectorAll(s);
      root.addEventListener('click', (e) => {
        // A drag that just ended still fires a trailing click on
        // whatever's under the pointer -- suppressed here so a
        // press-and-hold-drag never also triggers that button's action.
        if (this._dragJustHappened) return;
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
      this._wireDrag();
      this._built = true;
      this._paint();
    }

    // 2026-08-05, confirmed in chat: dedicated drag handle (see ICON.move
    // above for the full reasoning) -- touching down on it starts a drag
    // immediately, no hold duration, no cancel-on-movement threshold to
    // resolve, since there's no ambiguity left to resolve: this one
    // small area only ever means "drag," everywhere else on the pill
    // only ever means "tap the button." Position is remembered only as
    // a plain instance field (this._dragLeft/Top) -- resets to the
    // default top-center position on a fresh page load, not persisted
    // anywhere, matching "remembers for this session only." Constrained
    // to stay fully on-screen throughout the drag, not just clamped
    // once at the end.
    _wireDrag() {
      const mini = this.$('.mini');
      const handle = this.$('.mini-drag-handle');

      const beginDrag = (e) => {
        e.preventDefault();
        this._dragJustHappened = false;
        mini.classList.add('dragging');
        const rect = mini.getBoundingClientRect();
        // Bug fix (2026-08-05, found by the user): .mini's own CSS is
        // width:100% (capped at max-width:420px) -- correct while it's
        // a normal flex child, where 100% means "100% of the space the
        // flexbox gives it." The instant this switches to position:fixed
        // below, 100% means something different: 100% of the actual
        // viewport, since a fixed element measures against that, not
        // its old flex container. On a phone narrower than 420px, the
        // screen itself is already smaller than that cap, so the cap
        // never even gets a chance to catch it -- which is exactly why
        // this showed up as a full-width "band" on mobile specifically.
        // Locking in the width it already, correctly had -- captured
        // here before anything changes -- carries the real pill shape
        // into the drag instead of letting it recalculate against the
        // wrong reference.
        mini.style.width = rect.width + 'px';
        const offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
        const onMove = (me) => {
          const w = mini.offsetWidth, h = mini.offsetHeight;
          let left = me.clientX - offsetX, top = me.clientY - offsetY;
          left = Math.max(0, Math.min(left, window.innerWidth - w));
          top = Math.max(0, Math.min(top, window.innerHeight - h));
          this._dragLeft = left; this._dragTop = top;
          mini.style.position = 'fixed';
          mini.style.left = left + 'px';
          mini.style.top = top + 'px';
          mini.style.margin = '0';
        };
        const onUp = () => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          mini.classList.remove('dragging');
          this._dragJustHappened = true;
          setTimeout(() => { this._dragJustHappened = false; }, 50);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };

      handle.addEventListener('pointerdown', beginDrag);

      // Re-applies a previously-dragged-to position (this session only)
      // whenever the pill becomes visible again -- otherwise every
      // fresh minimise would revert to the default top-center spot
      // rather than staying where it was last left.
      this._reapplyDragPosition = () => {
        if (this._dragLeft == null) return;
        mini.style.position = 'fixed';
        mini.style.left = this._dragLeft + 'px';
        mini.style.top = this._dragTop + 'px';
        mini.style.margin = '0';
      };
      // Re-clamps a previously-dragged position on resize/rotation --
      // "keep it fully on-screen always" should hold even if the
      // viewport itself changes size after the drag already happened,
      // not just during the drag gesture itself.
      window.addEventListener('resize', () => {
        if (this._dragLeft == null) return;
        const w = mini.offsetWidth, h = mini.offsetHeight;
        this._dragLeft = Math.max(0, Math.min(this._dragLeft, window.innerWidth - w));
        this._dragTop = Math.max(0, Math.min(this._dragTop, window.innerHeight - h));
        if (this.mode === 'mini') this._reapplyDragPosition();
      });
    }

    _emit(name) {
      this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true,
        detail: { elapsed: this._ms, laps: this.laps, running: this._running } }));
    }
    _save() {
      const p = this.getAttribute('persist');
      if (p) { try { localStorage.setItem(p, JSON.stringify({ ms: this._ms, laps: this._laps, lastLap: this._lastLap })); } catch (e) {} }
    }
    // 2026-08-15, confirmed in chat: held if and only if mode="full" AND
    // actually running -- maximising alone doesn't hold it, pausing
    // while still maximised releases it. Every method that can change
    // either of those two things calls this same check, rather than
    // each managing the lock itself. Feature-detected + try/catch
    // throughout: on a browser without the API (or a request the
    // platform declines -- low battery, etc) this is silently a
    // permanent no-op, never an error.
    async _requestWakeLock() {
      if (this._wakeLock || !('wakeLock' in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        // Conditions can change while the request is in flight (e.g.
        // paused again before the platform responded) -- don't hold
        // onto a lock that's already stale by the time it arrives.
        if (this.mode === 'full' && this._running) {
          this._wakeLock = sentinel;
          sentinel.addEventListener('release', () => { this._wakeLock = null; });
        } else {
          sentinel.release().catch(() => {});
        }
      } catch (e) { /* unsupported / declined -- stay unlocked, no error */ }
    }
    _releaseWakeLock() {
      if (!this._wakeLock) return;
      const wl = this._wakeLock;
      this._wakeLock = null;
      wl.release().catch(() => {});
    }
    _syncWakeLock() {
      if (this.mode === 'full' && this._running) this._requestWakeLock();
      else this._releaseWakeLock();
    }

    start() { if (this._running) return; this._t0 = performance.now(); this._running = true; this._syncWakeLock(); this._paint(); this._emit('timer-start'); }
    pause() { if (!this._running) return; this._running = false; this._syncWakeLock(); this._paint(); this._save(); this._emit('timer-pause'); }
    toggle() { this._running ? this.pause() : this.start(); }
    stop() { this._running = false; this._syncWakeLock(); this._paint(); this._save(); this._emit('timer-stop'); }
    // Scrolls the (now uncapped) lap list to the newest entry whenever
    // one is added -- confirmed in chat: showing every lap only helps
    // if the one you just recorded is actually in view without having
    // to scroll for it. Free to scroll back up through history the
    // rest of the time; nothing re-forces the scroll position outside
    // this one moment.
    lap() {
      this._laps.push(this._ms - this._lastLap);
      this._lastLap = this._ms;
      this._paint();
      this._save();
      this._emit('timer-lap');
      const laps = this.$('.laps');
      if (laps) laps.scrollTop = laps.scrollHeight;
    }
    // Reset now also stops the clock (this._running = false), not just
    // zeros it while leaving it running -- confirmed in chat: "Reset
    // stops and resets," waiting for a deliberate Start rather than
    // continuing to tick from 0. The supplied version left _running
    // untouched here.
    reset() { this._ms = 0; this._laps = []; this._lastLap = 0; this._running = false; this._t0 = performance.now(); this._syncWakeLock(); this._paint(); this._save(); this._emit('timer-reset'); }

    _paint() {
      if (!this._built) return;
      const mini = this.mode === 'mini', frac = Math.min(1, this._ms / this.target), acc = this.accent;
      this.$('.full').classList.toggle('hide', mini);
      this.$('.mini').classList.toggle('hide', !mini);
      if (mini) this._reapplyDragPosition();
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
      // 2026-08-15, confirmed in chat: hide the container itself, not
      // just its contents -- .laps now has a fixed width+height (it
      // sits beside the ring, not below it), so leaving it empty-but-
      // present with laps="off" would still leave a blank 140px gap
      // next to the ring instead of centering it the way it used to.
      this.$('.laps').classList.toggle('hide', !showLaps);
      this.$$('.mini-lap').forEach(el => el.classList.toggle('hide', !showLaps));
      // No slice(-4) any more -- every recorded lap renders; .laps
      // scrolls instead of clipping (see the CSS above).
      this.$('.laps').innerHTML = !showLaps ? '' : this._laps.map((v, i, a) =>
        '<div class="laprow' + (i === a.length - 1 ? ' last' : '') + '"><span>Lap ' +
        (i + 1) + '</span><span>' + fmt(v) + '</span></div>').join('');
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
