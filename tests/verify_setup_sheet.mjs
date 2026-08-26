// ============================================================
// verify_setup_sheet.mjs — V3.72.0: Setup takes over the Dhor card's
// Plan button and opens as a sheet.
//
// WHY THIS EXISTS
// Three separate approaches to putting Setup on the Dhor card were specced
// and discarded (a popup via enterEditScreenMode, a chip moved off the
// summary row, and this). The ones that failed all failed on the SAME
// point: where does Setup return to when you close it. A sheet has no
// return path to get wrong — the card is still underneath, same student,
// same date. These checks hold that property in place.
//
// The other thing worth guarding: the button must be Setup ONLY in the
// maktab. In the personal journal it is still Plan, and the plans queue is
// a PJ-only concept — a maktab student has no plans table at all.
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

const setup = read('js/maktabSetup.js');
const dhor = read('js/dhorPage.js');
const day = read('js/maktabDay.js');
const summary = read('js/maktabSummary.js');
const app = read('js/app.js');
const html = read('index.html');

// ---------- the old screen is GONE, not merely unreachable ----------
check('the maktabSetup SCREEN is deleted from the markup', !/id="screen-maktabSetup"/.test(html));
check('its render route is gone from showScreen', !/id === 'maktabSetup'/.test(app));
check('nothing calls showScreen for it any more', !/showScreen\('maktabSetup'\)/.test(setup + dhor + app + summary));
check('the name heading went with it — the sheet opens from her own card',
  !/maktabSetupName/.test(setup) && !/maktabSetupName/.test(html));

// ---------- the sheet ----------
check('Setup opens as a sheet', /overlay\.id = 'maktabSetupSheet'/.test(setup));
check('it reuses the existing modal pattern, not a second one',
  /className = 'modal-overlay maktab-setup-modal'/.test(setup) && /class="modal-card maktab-setup-card"/.test(setup));
check('the close button is INSIDE the card — the full-screen version had it outside',
  /maktab-setup-card">\s*\n\s*<button[^>]*maktab-setup-close/.test(setup));
check('the close button carries a label but no visible text',
  /aria-label="Close"/.test(setup) && !/>Close</.test(setup));
check('closing just removes the sheet — no routing, nothing to restore',
  /function closeMaktabSetupSheet\(\)\{[\s\S]{0,160}\.remove\(\)/.test(setup));
check('re-opening does not stack sheets', /closeMaktabSetupSheet\(\);[\s\S]{0,200}createElement\('div'\)/.test(setup));

// ---------- the renderer serves the sheet, and only the sheet ----------
check('the renderer takes its host rather than hardcoding a screen body',
  /async function renderMaktabSetupScreen\(host\)/.test(setup));
check('it bails safely if handed nothing', /if\(!host\) return;/.test(setup));

// ---------- the button ----------
check('the button says Add Juz to Dhor in the maktab, Plan in the PJ (V3.74.0)',
  /btn\.textContent = setup \? 'Add Juz to Dhor' : 'Plan';/.test(dhor));
check('Setup mode is decided by the log context, not a role or a flag',
  /function dhorPlanBtnIsSetup\(\)\{[\s\S]{0,140}logCtxIsMaktab\(\)/.test(dhor));
check('the click routes to Setup only in the maktab; PJ still opens the plan modal',
  /if\(dhorPlanBtnIsSetup\(\)\)\{[\s\S]{0,220}openMaktabStudentSetup\([\s\S]{0,120}openPlanDhorModal\(\)/.test(dhor));
check('Setup is opened for the student the CONTEXT names — never a hardcoded or logged-in id',
  /openMaktabStudentSetup\(\{ id: logCtxStudentId\(\), name: logCtxStudentName\(\) \}\)/.test(dhor));
check('the label follows the context via the existing repaint hook, not a second one',
  /refreshDhorPlanBtn\(\);/.test(day));

// ---------- the chip left the summary ----------
check('the Setup chip is gone from the summary row', !/maktab-setup-btn/.test(summary));
check('the summary still builds its name cell', /nameTd/.test(summary));

// ---------- the destructive save keeps its named confirmation ----------
// Saving REPLACES her pool. A sheet is easier to open by accident than a
// screen was, so this must not have been lost in the move.
check('save still names the ajzaa being removed rather than a bare "sure?"',
  /will no longer be in it\. Continue\?/.test(setup));
check('and still confirms even when nothing is being removed',
  /This replaces her current Dhor pool\. Continue\?/.test(setup));

// ---------- the pool read stays routed ----------
check('the pool is read for the named student, not the logged-in one',
  /apiGetMaktabPosition\(maktabSetupStudent\.id\)/.test(setup));
check('setup never reaches for an own-only profile call',
  !/apiGetProfile\(\)/.test(setup) && !/apiSaveProfile\(/.test(setup));

// ---------- V3.73.2: the boot close-button LIST IS GONE ----------
// V3.72.0 deleted a screen but left its id in a hand-written list in
// app.js, which did an unguarded getElementById and threw — killing the
// boot. V3.73.1 guarded the loop; V3.73.2 removed the list entirely,
// because every one of those buttons already carried .screen-close-btn.
// A query cannot drift. These assert the list does not come back.
{
  const appSrc = read('js/app.js');
  check('close buttons are wired by CLASS, not an id list',
    /querySelectorAll\('\.screen-close-btn:not\(#logDetailClose\)'\)/.test(appSrc));
  check('no hand-written close-button id list survives',
    !/\['journalCloseBtn'/.test(appSrc));
  check('the deleted screen\'s button is named nowhere in the shipped code',
    !/maktabSetupCloseBtn/.test(appSrc));
  // logDetailClose carries the class too but is wired in its own file;
  // including it would attach a second click handler and navigate twice.
  check('logDetailClose is excluded so it is not double-wired',
    /:not\(#logDetailClose\)/.test(appSrc) && /logDetailClose/.test(read('js/logDetailScreen.js')));
  check('every .screen-close-btn in the markup is a real element the query will find',
    (html.match(/screen-close-btn/g) || []).length >= 10);
}

// ---------- V3.73.2: the visibility switch needs its thumb ----------
// .switch-option.active is color:white, designed to sit on the dark
// sliding thumb. Ship the switch without the thumb and the SELECTED
// option is white on white — "Teachers", the default, was invisible.
{
  const cp = read('js/commentPrivacy.js');
  check('the visibility switch renders a thumb', /<div class="switch-thumb"><\/div>/.test(cp));
  check('the thumb is positioned for the value already selected on render',
    /moveVisThumb\(vt, vt\.querySelector\('\.switch-option\.active'\)\)/.test(cp));
  check('and moves when a different option is chosen',
    /moveVisThumb\(track, btn\)/.test(cp));
}

// ---------- V3.74.0: the LANDING screen, not a menu button ----------
// V3.71.0 claimed teaching profiles land on the maktab and shipped a change
// to the Home DROPDOWN BUTTON instead — not the landing path at all. The
// harness passed because the string existed somewhere in the file. These
// assert it is in bootApp, which is the function that actually decides
// where the app opens.
{
  const appSrc = read('js/app.js');
  const boot = appSrc.slice(appSrc.indexOf('async function bootApp('));
  const bootBody = boot.slice(0, boot.indexOf('\n}'));
  check('bootApp sends a teaching profile to the maktab summary',
    /isTeachingProfile\(\)[\s\S]{0,80}showScreen\('maktabSummary'\)/.test(bootBody));
  check('and a student still lands on home / settings',
    /showScreen\(profile\.setup_complete \? 'home' : 'settings'\)/.test(bootBody));
  check('the setup_complete branch is skipped for teaching profiles — Settings is hidden from them',
    /if\(typeof isTeachingProfile === 'function' && isTeachingProfile\(\)\)\{[\s\S]{0,90}maktabSummary[\s\S]{0,40}\} else \{/.test(bootBody));
}

// ---------- V3.74.0: the summary date pill ----------
// It stretched across the screen for two reasons at once. Both are
// asserted, because fixing either alone leaves it fragile.
{
  const jt = read('css/journal-table.css');
  check('the toprow grid is qualified with BOTH classes, so it cannot lose on file order',
    /\.screen-top-close-row\.maktab-summary-toprow \{[\s\S]{0,120}display: grid/.test(jt));
  // NOT by overriding the shared wrap's width — verify_e1.mjs guards that
  // hack staying gone, and the grid makes it unnecessary.
  check('no width override on the shared date wrap was reintroduced',
    !/\.custom-date-wrap \{ width: auto/.test(jt));
  check('the leading header cell is painted, so the header spans the full width',
    /\.maktab-summary-headers \.col-haidh \{[\s\S]{0,120}--color-table-header-date/.test(jt));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
