const ROOT = require('path').join(__dirname, '..') + '/';
const fs = require('fs');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
  ROOT + 'js/session-timer.js', 'utf8'
);

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', label); }
}

const flush = () => new Promise(r => setTimeout(r, 0));

function makeDom() {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://example.com/',
  });
  const { window } = dom;
  // jsdom in this environment doesn't implement rAF -- polyfill so
  // connectedCallback (which uses it for the tick loop) runs to
  // completion, same as any real browser.
  window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  // --- mock Screen Wake Lock API ---
  const wl = { requestCalls: 0, releaseCalls: 0, live: null };
  window.navigator.wakeLock = {
    request: async (type) => {
      wl.requestCalls++;
      let released = false;
      const listeners = [];
      const sentinel = {
        released: false,
        type,
        addEventListener: (evt, fn) => { if (evt === 'release') listeners.push(fn); },
        release: async () => {
          if (released) return;
          released = true;
          sentinel.released = true;
          wl.releaseCalls++;
          listeners.forEach(fn => fn());
        },
        // test-only hook: simulate the BROWSER force-releasing the lock
        // (screen goes off, low battery, tab hidden) without our own
        // code having called .release() itself
        _browserForceRelease: () => { if (!released) { released = true; sentinel.released = true; listeners.forEach(fn => fn()); } },
      };
      wl.live = sentinel;
      return sentinel;
    },
  };

  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = SRC;
  window.document.body.appendChild(scriptEl);

  return { dom, window, document: window.document, wl };
}

(async () => {
  // ============================================================
  // Scenario A: wake lock held iff mode==='full' AND running
  // ============================================================
  {
    const { window, document, wl } = makeDom();
    const el = document.createElement('session-timer');
    document.body.appendChild(el);

    check('A1: no lock at connect (not running)', wl.requestCalls === 0);

    el.mode = 'mini';
    check('A2: no lock after mode=mini (still not running)', wl.requestCalls === 0);

    el.start();
    check('A3: no lock: running but still mini', wl.requestCalls === 0 && el.running === true);

    el.mode = 'full';
    check('A4: maximise while running -> lock requested', wl.requestCalls === 1);
    await flush(); // let the async request() settle
    check('A4b: sentinel actually held', el._wakeLock != null);

    el.pause();
    check('A5: pause while still maximised -> released (running-only)', wl.releaseCalls === 1 && el._wakeLock == null);

    el.start();
    await flush();
    check('A6: resume while maximised -> re-requested', wl.requestCalls === 2 && el._wakeLock != null);

    el.mode = 'mini';
    check('A7: minimise while running -> released even though running', wl.releaseCalls === 2 && el._wakeLock == null);

    el.mode = 'full';
    await flush();
    check('A8: re-maximise while still running -> re-requested', wl.requestCalls === 3 && el._wakeLock != null);

    el.stop();
    check('A9: stop -> released', wl.releaseCalls === 3 && el._wakeLock == null);
  }

  // ============================================================
  // Scenario A2: race -- pause() lands before the in-flight request
  // resolves; the just-arrived sentinel must not be kept.
  // ============================================================
  {
    const { document, wl } = makeDom();
    const el = document.createElement('session-timer');
    document.body.appendChild(el);
    el.mode = 'full';
    el.start(); // fires the request, does NOT await it
    el.pause(); // lands before the mock's request() promise settles
    await flush();
    check('A2-1: request was made', wl.requestCalls === 1);
    check('A2-2: but not kept -- released instead of held stale', el._wakeLock == null);
    check('A2-3: the late sentinel was released, not left dangling', wl.releaseCalls === 1);
  }

  // ============================================================
  // Scenario B: Close path (pause() then timer-close) releases
  // ============================================================
  {
    const { document, wl } = makeDom();
    const el = document.createElement('session-timer');
    document.body.appendChild(el);
    el.mode = 'full';
    el.start();
    await flush();
    check('B1: locked before close', wl.requestCalls === 1 && el._wakeLock != null);

    // mirrors the internal data-act="close" handler: this.pause(); this._emit('timer-close');
    el.pause();
    check('B2: close (via pause) releases', wl.releaseCalls === 1 && el._wakeLock == null);
  }

  // ============================================================
  // Scenario C: visibilitychange re-acquires a browser-revoked lock
  // ============================================================
  {
    const { window, document, wl } = makeDom();
    const el = document.createElement('session-timer');
    document.body.appendChild(el);
    el.mode = 'full';
    el.start();
    await flush();
    check('C1: locked', wl.requestCalls === 1 && el._wakeLock != null);

    // Simulate the OS/browser silently revoking it (screen off, tab
    // backgrounded) -- NOT our own release() call.
    wl.live._browserForceRelease();
    check('C2: our reference cleared by the release event', el._wakeLock == null);
    check('C2b: we did not count this as our own release', wl.releaseCalls === 0);

    Object.defineProperty(window.document, 'visibilityState', { value: 'visible', configurable: true });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    await flush();
    check('C3: visibilitychange while still full+running -> re-requested', wl.requestCalls === 2 && el._wakeLock != null);
  }

  // ============================================================
  // Scenario D: unsupported browser (no navigator.wakeLock) never throws
  // ============================================================
  {
    const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.com/' });
    const { window } = dom;
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    // deliberately no navigator.wakeLock mock installed
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = SRC;
    window.document.body.appendChild(scriptEl);
    const document = window.document;
    let threw = false;
    try {
      const el = document.createElement('session-timer');
      document.body.appendChild(el);
      el.mode = 'full';
      el.start();
      el.pause();
      el.mode = 'mini';
    } catch (e) { threw = true; console.log('  (unexpected throw)', e.message); }
    check('D1: no wakeLock support -> silent no-op, never throws', !threw);
  }

  // ============================================================
  // Scenario E: ALL laps render (no slice(-4) cap), correct numbering/order
  // ============================================================
  {
    const { document } = makeDom();
    const el = document.createElement('session-timer');
    document.body.appendChild(el);
    el.start();
    for (let i = 0; i < 6; i++) el.lap();
    const rows = el.shadowRoot.querySelectorAll('.laps .laprow');
    check('E1: 6 laps recorded -> 6 rows rendered (not capped at 4)', rows.length === 6);
    check('E2: first row is "Lap 1"', rows[0].textContent.startsWith('Lap 1'));
    check('E3: last row is "Lap 6" and has .last', rows[5].textContent.startsWith('Lap 6') && rows[5].classList.contains('last'));
    check('E4: laps array itself has all 6', el.laps.length === 6);
  }

  // ============================================================
  // Scenario F: laps="off" hides the .laps container itself (not just its content)
  // ============================================================
  {
    const { document } = makeDom();
    const el = document.createElement('session-timer');
    el.setAttribute('laps', 'off');
    document.body.appendChild(el);
    el.start();
    el.lap();
    const lapsEl = el.shadowRoot.querySelector('.laps');
    check('F1: .laps has hide class when laps=off', lapsEl.classList.contains('hide'));
    check('F2: .laps has no content when off', lapsEl.innerHTML === '');
  }

  // ============================================================
  // Scenario G: js/auth.js NAV_ITEMS label
  // ============================================================
  {
    const authSrc = fs.readFileSync(ROOT + 'js/auth.js', 'utf8');
    check('G1: journal label is Summary', /id:\s*'journal',\s*label:\s*'Summary'/.test(authSrc));
    check('G2: journal id/icon untouched', /id:\s*'journal'[\s\S]{0,40}icon:\s*'journal'/.test(authSrc));
    const rootAuthSrc = fs.readFileSync(ROOT + 'auth.js', 'utf8');
    check('G3: stale root auth.js deliberately left as Journal (untouched)', /label:\s*'Journal'/.test(rootAuthSrc));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
