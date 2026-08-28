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
for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'attendancePage']) {
  check(`'${id}' is hidden`, hidden.includes(id));
}
check("'sih' is NOT hidden — never named in chat, and an activity not a journal screen",
  !hidden.includes('sih'));
check('exactly the five agreed ids are hidden, no quiet additions',
  hidden.length === 5, hidden.join(','));

// ---------- the filter is applied, and ONLY to teaching profiles ----------
// V3.70.0. This is the correction that matters: V3.69.0 hid the personal
// journal from everyone, including the students whose journal it is.
// V3.74.2 restructured visibleNavItems into groups, so these now assert
// the RULE rather than the exact expression — the jsdom runs below already
// prove the behaviour per role, which is the thing that matters.
check('hiding is gated on a teaching profile, not applied unconditionally',
  /const hidePJ = isTeachingProfile\(\);/.test(auth)
  && /hidePJ && HIDDEN_PJ_NAV_IDS\.has\(item\.id\)/.test(auth));
check('admin counts as a teaching profile (isTeacherOrAbove parity)',
  /function isTeachingProfile\(\)\{[\s\S]{0,160}role === 'teacher'[\s\S]{0,60}role === 'admin'/.test(auth));
// V3.80.0: the item became Attendance, for EVERY student — the
// trackHaidh nav gate went with the rename; the hidePJ gate remains.
check('the attendance item is gated on hidePJ only (every student gets it)',
  /if\(!\(hidePJ && HIDDEN_PJ_NAV_IDS\.has\(ATTENDANCE_NAV_ITEM\.id\)\)\) g3\.push\(ATTENDANCE_NAV_ITEM\)/.test(auth)
  && !/currentUser\.trackHaidh &&/.test(auth));
check('Maktab Journal goes to students, not teaching profiles',
  /if\(!hidePJ\) g3\.push\(MAKTAB_JOURNAL_NAV_ITEM\)/.test(auth));
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
  for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'attendancePage', 'juzTracker', 'sih']) {
    check(`student sees '${id}' — her whole personal journal is back`, v.includes(id), v.join(','));
  }
  check('student sees her own Maktab Journal (V3.70.2 — server-scoped to her rows)',
    v.includes('maktabJournal'), v.join(','));
  check('student sees no TEACHER-facing maktab items',
    !v.includes('maktabSummary') && !v.includes('maktabSettings'), v.join(','));
  check('student sees no admin item', !v.includes('admin'));

  w.eval('currentUser.role = "teacher"');
  v = ids();
  for (const id of ['journal', 'logDetail', 'reflections', 'settings', 'attendancePage', 'maktabJournal']) {
    check(`teacher does NOT see '${id}'`, !v.includes(id), v.join(','));
  }
  check('no student screen leaks onto a teaching profile',
    !v.some(id => ['journal','logDetail','reflections','settings','attendancePage','maktabJournal'].includes(id)));
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

// V3.74.1: the Home BUTTON goes Home, for everyone. V3.71.0 pointed it at
// the maktab summary while trying to change where the app LANDS — the wrong
// target, and it made a button labelled Home not go home. Landing lives in
// bootApp and is asserted in verify_setup_sheet.mjs. Keeping both stops the
// two being confused for each other again.
check('the Home dropdown button goes Home, not the maktab',
  /homeDropdownBtn[\s\S]{0,600}showScreen\('home'\)/.test(auth)
  && !/showScreen\(isTeachingProfile\(\) \? 'maktabSummary'/.test(auth));

// ---------- V3.74.1: the menu is a right-hand vertical strip ----------
{
  const nav = read('css/nav.css');
  check('the menu is anchored right, not stretched across the width',
    /#authDropdown \{[\s\S]{0,600}right: 0;[\s\S]{0,200}left: auto;/.test(nav));
  check('it takes about a quarter of the width', /#authDropdown \{[\s\S]{0,600}width: 25%;/.test(nav));
  check('with a floor and ceiling — 25% of a phone is unusably narrow',
    /min-width: 200px/.test(nav) && /max-width: 320px/.test(nav));
  check('items are laid out as a vertical list',
    /#authDropdown \.dropdown-inner \{[\s\S]{0,160}flex-direction: column;/.test(nav));
  check('and each item is a row: icon then label, left aligned',
    /#authDropdown \.nav-icon-item \{[\s\S]{0,220}flex-direction: row;/.test(nav));
  check('the old 4/6-column grid rules are GONE, not just overridden',
    !/grid-template-columns: repeat\(4, 1fr\)/.test(nav) && !/grid-template-columns: repeat\(6, 1fr\)/.test(nav));
  check('a long menu scrolls rather than clipping its last item',
    /#authDropdown\.open \{[\s\S]{0,160}overflow-y: auto;/.test(nav));
  check('the Home TILES keep their stacked centred shape — only the menu changed',
    /\.nav-icon-item \{[\s\S]{0,120}flex-direction: column;/.test(read('css/base.css')));
}

// ---------- V3.74.0: the Maktab item has its own icon ----------
// It borrowed 'sabaq' — three dots — which is ALSO the Sabaq card header
// (logDetailScreen.js) and the Sabaq journal column header (app.js). So the
// maktab read as a Sabaq screen, and repointing 'sabaq' would have changed
// all three. A new icon was added instead. Both halves asserted, because
// the tempting fix is the one that breaks two other places.
{
  const icons = read('js/icons.js');
  check('a distinct maktab icon exists', /maktab: '<svg/.test(icons) && /M12 5v16/.test(icons));
  check('the Maktab nav item uses it', /MAKTAB_SUMMARY_NAV_ITEM = \{[^}]*icon: 'maktab'/.test(auth));
  check('the shared sabaq icon is UNCHANGED — three dots, still used elsewhere',
    /sabaq: '<svg[^']*circle cx="12"[^']*circle cx="19"/.test(icons));
  check('and its other two consumers still point at it',
    /iconHtml\('sabaq'\)/.test(read('js/app.js')) && /iconHtml\('sabaq'\)/.test(read('js/logDetailScreen.js')));
  check('the icon carries no fixed width/height, so CSS sizes it like the rest',
    !/maktab: '<svg[^']*width="24"/.test(icons));
}

// ---------- V3.74.0: the stroked chevron style is retired app-wide ----------
// "Don't use this style icon anywhere in the app" — so this asserts the
// STYLE is gone, not just the three instances that prompted it. A later
// icon added in the old style fails here, which a per-icon check would
// have missed.
{
  const icons = read('js/icons.js');
  for (const k of ['chevronDown', 'rollupMerge', 'rollupSplit']) {
    const body = new RegExp(`${k}: '([^']*)'`).exec(icons);
    check(`${k} is a solid triangle, not a stroked chevron`,
      !!body && /fill="currentColor"/.test(body[1]) && !/stroke-width/.test(body[1]),
      body && body[1].slice(0, 60));
  }
  check('no stroked chevron path survives anywhere in the icon set',
    !/M6 9l6 6 6-6/.test(icons));
  check('the roll-up pair point in OPPOSITE directions — the direction is the meaning',
    /rollupMerge:[^\n]*M6 4h12L12 11z/.test(icons) && /rollupSplit:[^\n]*M12 3l6 7H6z/.test(icons));
  // The surah/ayah selectors were already solid triangles; they are the
  // reference this matched, so they must not have been "tidied" too.
  const sd = read('js/sabaqDhorPage.js');
  check('the surah selector triangles it was matched to are untouched',
    /&#x25B2;&#x25BC;/.test(sd) && /&#x25B2;<\/button>/.test(sd));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
