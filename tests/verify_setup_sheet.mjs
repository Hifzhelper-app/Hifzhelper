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
check('the button is Setup in the maktab and Plan in the PJ',
  /btn\.textContent = setup \? 'Setup' : 'Plan';/.test(dhor));
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
