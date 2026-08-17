// ============================================================
// verify_nav.mjs — V3.69.0: the personal journal hidden in the maktab.
//
// WHY THIS EXISTS
// "Hide" here means withhold the WAY IN, not remove the screen. The maktab
// day view routes straight into the logDetail screen
// (js/maktabDay.js -> showScreen('logDetail', 'sabaq')), so a change that
// removed logDetail rather than hiding its nav entry would take the maktab
// down with it. That is the failure this file guards.
//
// It also holds the reversibility promise in place. The user's word was
// "for now hide", and for the juz tracker "we may bring it back" — so the
// tracker path and delivery (i)'s routed pool calls must stay in the file,
// unreachable but intact. A future session tidying them away as dead code
// would quietly make the tracker unsafe to switch back on.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) pass++; else { fail++; console.log('FAIL:', label, extra); }
};

const auth = read('js/auth.js');
const app = read('js/app.js');
const html = read('index.html');
const nav = read('css/nav.css');
const tracker = read('js/juzTrackerScreen.js');

// ---------- the hidden set ----------
const setBlock = auth.match(/const HIDDEN_PJ_NAV_IDS = new Set\(\[([\s\S]*?)\]\)/);
check('HIDDEN_PJ_NAV_IDS exists', !!setBlock);
const hidden = setBlock ? [...setBlock[1].matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]) : [];
for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'haidhDetail']) {
  check(`'${id}' is hidden`, hidden.includes(id));
}
check("'sih' is NOT hidden — never named in chat, and an activity not a journal screen",
  !hidden.includes('sih'));
check('exactly the five agreed ids are hidden, no quiet additions',
  hidden.length === 5, hidden.join(','));

// ---------- the filter is actually applied ----------
check('visibleNavItems filters NAV_ITEMS through the set',
  /visibleNavItems\(\)\s*\{[\s\S]{0,220}NAV_ITEMS\.filter\([\s\S]{0,80}HIDDEN_PJ_NAV_IDS\.has/.test(auth));
check('the haidh item is filtered too, not just appended',
  /currentUser\.trackHaidh\s*&&\s*!HIDDEN_PJ_NAV_IDS\.has/.test(auth));
check('Maktab Journal is no longer added to the nav',
  !/concat\(\[MAKTAB_JOURNAL_NAV_ITEM\]\)/.test(auth));
check('teacher/admin still get the Maktab item', /MAKTAB_SUMMARY_NAV_ITEM/.test(auth));
check('admin still gets Maktab Settings and Admin',
  /MAKTAB_SETTINGS_NAV_ITEM, ADMIN_NAV_ITEM/.test(auth));

// ---------- HIDING IS NOT REMOVAL: the screens must still exist and route ----------
// This is the one that protects the maktab. If it fails, the day view is broken.
check('the logDetail screen still exists in the markup', /id="screen-logDetail"/.test(html));
check('the maktab day view still routes into logDetail',
  /showScreen\('logDetail'/.test(read('js/maktabDay.js')));
check('showScreen does not consult the nav list, so hidden screens stay reachable by route',
  !/async function showScreen[\s\S]{0,1200}visibleNavItems/.test(app));
for (const id of ['journal', 'reflections', 'settings']) {
  check(`the ${id} screen still exists — hidden, not deleted`,
    new RegExp(`id="screen-${id}"`).test(html));
}

// ---------- juz tracker: free play only, tracker PARKED ----------
check('FREEPLAY_ONLY flag exists', /const FREEPLAY_ONLY = true;/.test(tracker));
check('the screen opens in free play', /setFreeplay\(FREEPLAY_ONLY\)/.test(tracker));
check('the toggle back to tracker mode is withdrawn', /fpBtn\.onclick = null/.test(tracker));
check('setFreeplay(false) still restores the real tracker — parked, not deleted',
  /if\(on\) el\.setAttribute\('mode', 'freeplay'\);[\s\S]{0,120}else el\.removeAttribute\('mode'\)/.test(tracker));
// delivery (i)'s routed calls must survive being unreachable
check("(i)'s routed profile read survives", /logProfile\(\)/.test(tracker));
check("(i)'s routed pool write survives", /logSavePool\(/.test(tracker));
check('the tracker never regained an own-only call while unreachable',
  !/apiGetProfile\(\)/.test(tracker) && !/apiSaveProfile\(/.test(tracker));

// ---------- Home header row removed cleanly ----------
check('#homeHeaderIcon is gone from the markup', !/id="homeHeaderIcon"/.test(html));
check('its card-header-row went with it, leaving no empty row',
  !/<div class="card-header-row">\s*<\/div>/.test(html));
check('nothing still writes to the removed element — an unguarded getElementById would throw',
  !/getElementById\('homeHeaderIcon'\)/.test(app));
check('its CSS rule is deleted', !/#homeHeaderIcon\s*\{/.test(nav));
check('the tile grid survives as the screen content', /id="homeGrid"/.test(html));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
