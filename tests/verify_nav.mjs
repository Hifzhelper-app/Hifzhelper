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

// ---------- the filter is applied, and ONLY to teaching profiles ----------
// V3.70.0. This is the correction that matters: V3.69.0 hid the personal
// journal from everyone, including the students whose journal it is.
check('hiding is gated on a teaching profile, not applied unconditionally',
  /const hidePJ = isTeachingProfile\(\);/.test(auth) &&
  /NAV_ITEMS\.filter\(item => !\(hidePJ && HIDDEN_PJ_NAV_IDS\.has\(item\.id\)\)\)/.test(auth));
check('admin counts as a teaching profile (isTeacherOrAbove parity)',
  /function isTeachingProfile\(\)\{[\s\S]{0,160}role === 'teacher'[\s\S]{0,60}role === 'admin'/.test(auth));
check('the haidh item is gated the same way, not left dangling',
  /currentUser\.trackHaidh && !\(hidePJ && HIDDEN_PJ_NAV_IDS\.has/.test(auth));
check('Maktab Journal goes to students, not teaching profiles',
  /if\(!hidePJ\) items = items\.concat\(\[MAKTAB_JOURNAL_NAV_ITEM\]\)/.test(auth));
// It is only safe on a student's nav because it is server-scoped to her own
// rows. If that ever stops being true this item must come off the nav again.
check('the student Maktab Journal sends no student_id — it cannot ask for anyone else',
  !/apiGetMaktabSabaq\([^)]+\)/.test(read('js/maktabJournal.js')));
check('and the worker refuses a non-teacher who names someone else',
  /if \(!isTeacherOrAbove\(auth\) && studentId !== auth\.id\) return \{ error: 'Not authorized', status: 403 \}/.test(read('worker/src/maktabLog.js')));
check('teacher/admin still get the Maktab item', /MAKTAB_SUMMARY_NAV_ITEM/.test(auth));
check('admin still gets Maktab Settings and Admin',
  /MAKTAB_SETTINGS_NAV_ITEM, ADMIN_NAV_ITEM/.test(auth));

// Drive the REAL visibleNavItems per role rather than trusting the regexes.
{
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const w = dom.window;
  const src = auth.slice(auth.indexOf('const NAV_ITEMS = ['), auth.indexOf('function renderNavItemsInto'));
  w.eval('var currentUser = { role: "student", trackHaidh: true };');
  w.eval(src);
  const ids = () => w.eval('visibleNavItems().map(i => i.id)');

  let v = ids();
  for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'haidhDetail', 'juzTracker', 'sih']) {
    check(`student sees '${id}' — her whole personal journal is back`, v.includes(id), v.join(','));
  }
  check('student sees her own Maktab Journal (V3.70.2 — server-scoped to her rows)',
    v.includes('maktabJournal'), v.join(','));
  check('student sees no TEACHER-facing maktab items',
    !v.includes('maktabSummary') && !v.includes('maktabSettings'), v.join(','));
  check('student sees no admin item', !v.includes('admin'));

  w.eval('currentUser.role = "teacher"');
  v = ids();
  for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'haidhDetail', 'maktabJournal']) {
    check(`teacher does NOT see '${id}'`, !v.includes(id), v.join(','));
  }
  check('no student screen leaks onto a teaching profile',
    !v.some(id => ['journal','logDetail','reflections','settings','haidhDetail','maktabJournal'].includes(id)));
  check('teacher keeps Juz Tracker and Surahs in my Heart', v.includes('juzTracker') && v.includes('sih'));
  check('teacher gets the Maktab summary', v.includes('maktabSummary'));
  check('teacher gets no admin items', !v.includes('admin') && !v.includes('maktabSettings'));

  w.eval('currentUser.role = "admin"');
  v = ids();
  check('admin is treated as a teaching profile — PJ still hidden',
    !v.includes('journal') && !v.includes('logDetail') && !v.includes('settings'), v.join(','));
  check('admin gets Maktab, Maktab Settings and Admin',
    v.includes('maktabSummary') && v.includes('maktabSettings') && v.includes('admin'));
}

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
check('FREEPLAY_ONLY is role-conditional, not a blanket true',
  /const FREEPLAY_ONLY = \(typeof isTeachingProfile === 'function'\) && isTeachingProfile\(\);/.test(tracker));
check('the screen opens in free play', /setFreeplay\(FREEPLAY_ONLY\)/.test(tracker));
check('the toggle is withdrawn only when free-play-only is in force',
  /if\(FREEPLAY_ONLY\)\{[\s\S]{0,200}fpBtn\.onclick = null;[\s\S]{0,120}\} else \{[\s\S]{0,160}setFreeplay\(el\.getAttribute/.test(tracker));
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




// ---------- V3.71.0: student read-only maktab day + teaching landing ----------
const ctx = read('js/logContext.js');
const detail = read('js/logDetailScreen.js');
const appjs = read('js/app.js');
const journal = read('js/maktabJournal.js');
const css = read('css/detail-pages.css');

check('read-only is ONE flag on the context, not scattered state',
  /readOnly: false/.test(ctx) && /function logCtxReadOnly\(\)/.test(ctx));
check('setMaktabLogContext takes it as an explicit opt-in',
  /setMaktabLogContext\(student, date, opts\)/.test(ctx) && /readOnly: !!\(opts && opts\.readOnly\)/.test(ctx));
check('clearing the context clears read-only too — it must not survive into a PJ session',
  /clearLogContext\(\)\{[\s\S]{0,240}readOnly: false/.test(ctx));

// The sweep is the part that must not rot into an enumeration.
check('read-only is applied as a SWEEP over inputs, not a list of known ids',
  /querySelectorAll\('input, textarea, select'\)/.test(detail));
check('buttons are filtered by a positive READ allow-list, so new write controls are inert by default',
  /const isRead = btn\.classList\.contains\('history-btn'\)/.test(detail) &&
  /if\(on && !isRead\)\{ btn\.setAttribute\('disabled'/.test(detail));
check('History stays reachable — reading her own history is the point of the screen',
  /history-btn/.test(detail) && /entry-count-badge/.test(detail));
check('it is applied on the single showScreen path, so no entry point can forget it',
  /if\(id === 'logDetail' && typeof applyLogDetailReadOnly === 'function'\)/.test(appjs));
check('and it is turned OFF again when not read-only, not left latched',
  /applyLogDetailReadOnly\(typeof logCtxReadOnly === 'function' && logCtxReadOnly\(\)\)/.test(appjs));

check('the student journal row opens her own day, read-only',
  /setMaktabLogContext\(\s*\{ id: currentUser\.id/.test(journal) && /\{ readOnly: true \}/.test(journal));
check('it names HER, never another student', !/student_id/.test(journal));

check('read-only styling does not display:none individual grid children (V3.45.6-.11 lesson)',
  /\.log-detail-readonly \[disabled\]/.test(css) && !/\.log-detail-readonly \.checkbox-box \{ display: none/.test(css));

check('teaching profiles land on the maktab, students on Home',
  /showScreen\(isTeachingProfile\(\) \? 'maktabSummary' : 'home'\)/.test(auth));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
