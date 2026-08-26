// ============================================================
// verify_version_stamp.mjs — the running version on the login cards.
//
// WHY THIS EXISTS
// V3.68.0 shipped without its cache bump; browsers ran V3.67.0's code while
// the source said 3.68.0. Nothing on screen could tell you. The stamp fixes
// that ONLY if it stays derived — a hardcoded version would have read
// "3.68.0" throughout that failure and actively misled.
//
// So the assertions here are mostly about what it must NOT do: not contain
// a literal version, not attach by a list of screen ids, not stay silent
// when the loaded version and the cache disagree.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) pass++; else { fail++; console.log('FAIL:', label, extra); }
};

const src = read('js/versionStamp.js');
const html = read('index.html');
const app = read('js/app.js');

// ---------- it must be DERIVED ----------
// Strip comments first. The module EXPLAINS the V3.68.0 failure by naming
// those versions, and a bare source scan reads its own documentation as
// evidence — the same false signal a substring count gave in V3.73.0.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('no hardcoded version string in the CODE (comments may cite them)',
  !/['"`]v?\d+\.\d+\.\d+['"`]/.test(code));
check('the app version comes from a real script tag',
  /querySelector\('script\[src\*="js\/app\.js"\]'\)/.test(src));
check('the cache version comes from the service worker caches',
  /caches\.keys\(\)/.test(src));

// ---------- attached by query, not a list of screens ----------
check('it attaches by class, so a new login screen is covered automatically',
  /querySelectorAll\('\.login-card'\)/.test(src));
check('the module is loaded before app.js, which calls it',
  html.indexOf('js/versionStamp.js') < html.indexOf('js/app.js')
  && /renderVersionStamp\(\)/.test(app));
check('its script tag carries a version query like every other',
  /js\/versionStamp\.js\?v=/.test(html));

// ---------- behaviour, driven for real ----------
const makeDom = (scriptV, cacheKeys) => {
  const dom = new JSDOM(`<!doctype html><body>
    <div class="login-card"></div><div class="login-card"></div>
    <script src="js/app.js${scriptV ? '?v=' + scriptV : ''}"></script>
  </body>`, { runScripts: 'outside-only' });
  dom.window.caches = { keys: async () => cacheKeys };
  dom.window.eval(src);
  return dom.window;
};

{
  const w = makeDom('3.73.3', ['hifzhelper-v3.73.3']);
  await w.eval('renderVersionStamp()');
  const els = [...w.document.querySelectorAll('.version-stamp')];
  check('matching versions: shows the version plainly', els.length === 2 && els[0].textContent === 'v3.73.3', els[0] && els[0].textContent);
  check('matching versions: not flagged stale', !els[0].classList.contains('stale'));
  check('it lands on EVERY login card, not just the first', els.length === 2);
}
{
  // The V3.68.0 failure exactly: page asked for a new version, the service
  // worker is still holding an old one.
  const w = makeDom('3.68.0', ['hifzhelper-v3.67.0']);
  await w.eval('renderVersionStamp()');
  const el = w.document.querySelector('.version-stamp');
  check('MISMATCH is stated in words, not left to be noticed',
    /v3\.68\.0/.test(el.textContent) && /3\.67\.0/.test(el.textContent) && /reload/i.test(el.textContent), el.textContent);
  check('MISMATCH is flagged for styling', el.classList.contains('stale'));
}
{
  const w = makeDom(null, []);
  await w.eval('renderVersionStamp()');
  check('no version on the tag: says unknown rather than guessing',
    w.document.querySelector('.version-stamp').textContent === 'version unknown');
}
{
  // Safari private mode and older browsers have no caches API.
  const w = makeDom('3.73.3', []);
  delete w.caches;
  await w.eval('renderVersionStamp()');
  check('no caches API: still shows the app version rather than throwing',
    w.document.querySelector('.version-stamp').textContent === 'v3.73.3');
}
{
  const w = makeDom('3.73.3', ['hifzhelper-v3.73.3']);
  await w.eval('renderVersionStamp()');
  await w.eval('renderVersionStamp()');
  check('re-rendering does not stack duplicate stamps',
    w.document.querySelectorAll('.login-card')[0].querySelectorAll('.version-stamp').length === 1);
}
{
  const w = makeDom('3.73.3', ['hifzhelper-v3.73.3']);
  w.document.querySelectorAll('.login-card').forEach(c => c.remove());
  let threw = false;
  try { await w.eval('renderVersionStamp()'); } catch(e) { threw = true; }
  check('no login cards present: returns quietly, never throws at boot', !threw);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
