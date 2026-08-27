// ============================================================
// verify_maktab_settings_form.mjs — the Maktab Settings form.
//
// WHY THIS EXISTS
// V3.74.0 rebuilt this form and the whole suite stayed green, because
// nothing covered it at all. A green suite that says nothing about the
// code you just changed is worse than a red one — it reads as assurance.
//
// The assertion that matters most is the whitelist pairing: the form
// offers three mushafs and the worker validates against its own list. Those
// drifted apart before this delivery — shared/data.js already understood
// 15line_indopak while the worker's whitelist did not, so offering it in
// the UI would have failed with a 400 at save time.
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

const form = read('js/maktabSettings.js');
const worker = read('worker/src/maktabSettings.js');
const css = read('css/settings.css');
const html = read('index.html');

// ---------- the form and the worker must agree on the mushaf list ----------
const offered = [...form.matchAll(/\['(1[35]line[a-z_]*)',/g)].map(m => m[1]);
const accepted = (worker.match(/const MUSHAFS = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);

check('the form offers three mushafs', offered.length === 3, offered.join(','));
check('every mushaf the form offers is accepted by the worker',
  offered.every(m => accepted.includes(m)), `offered=${offered} accepted=${accepted}`);
check('the worker accepts nothing the form does not offer',
  accepted.every(m => offered.includes(m)), `accepted=${accepted}`);
check('the worker error message is derived from its list, not a stale literal',
  /MUSHAFS\.join/.test(worker) && !/must be 13line or 15line_madani/.test(worker));

// ---------- radios, not a select ----------
check('mushaf is a radio group, not a select', /type="radio" name="mset_mushaf"/.test(form) && !/<select id="mset_mushaf"/.test(form));
check('the read matches the radios and does not use the old select id',
  /input\[name="mset_mushaf"\]:checked/.test(form) && !/getElementById\('mset_mushaf'\)/.test(form));
check('an unchecked group falls back rather than sending undefined',
  /\|\| '13line'/.test(form));

// ---------- wording ----------
check('the legend explains what the mushaf governs', /counting lines and pages/.test(form));
check('maktab-day label reworded', /Minimum no of students to mark a Hifz maktab day/.test(form));
check('inactivity label reworded, with the unit after the field',
  /Students will be flagged as inactive after[\s\S]{0,200}> days/.test(form));
check('the explanatory hints are gone', !/Every student in the maktab follows this mushaf/.test(form)
  && !/A date counts as a maktab day once/.test(form));
check('loading and error states are NOT treated as explanatory text',
  /Loading/.test(form) && /Could not load the maktab settings/.test(form));

// ---------- the 30/50 cap ----------
check('the settings body uses .screen-content, which carries the 30/50 cap',
  /id="maktabSettingsBody"[^>]*>/.test(html) && /class="screen-content" id="maktabSettingsBody"/.test(html));
// The card was already capped; the SECTION painting the olive background
// was not, so the card floated in a full-width green band. Fixed as a RULE
// in base.css rather than per screen — four screens had it (maktabSettings,
// reflections, haidhDetail, admin) and patching them one at a time is how
// it became inconsistent in the first place.
{
  const base = read('css/base.css');
  check('the green panel is capped by rule, not per screen',
    /\.screen:has\(> \.screen-content\) \{ width: var\(--width-desktop\)/.test(base)
    && /\.screen:has\(> \.screen-content\) \{ width: var\(--width-tablet\)/.test(base));
  check('the inner card fills that panel rather than being capped twice',
    /\.screen:has\(> \.screen-content\) > \.screen-content \{ width: 100%; \}/.test(base));
  check('it uses the shared tokens, not hardcoded percentages',
    !/:has\(> \.screen-content\) \{ width: (30|50)%/.test(base));
  check('no per-screen copy of this rule was left behind in settings.css',
    !/#screen-maktabSettings \{ width: var\(--width/.test(css));
  // Every screen with a card must be covered — the point of :has() over a list.
  const html2 = read('index.html');
  const carded = [...html2.matchAll(/id="screen-(\w+)"/g)].map(m => m[1])
    .filter(id => {
      const i = html2.indexOf(`id="screen-${id}"`);
      const j = html2.indexOf('<section class="screen', i + 1);
      return html2.slice(i, j > 0 ? j : undefined).includes('class="screen-content"');
    });
  check('four screens carry the card pattern and all are covered by the one rule',
    carded.length === 4, carded.join(','));
}
// V3.75.0: the base.css grid line was REMOVED — at three classes it forced a
// two-column grid onto every three-child header (Admin, Tadabbur, Haidh) and
// stranded their close buttons. The truncation fix was only ever the h2 wrap
// line, which stays; Maktab Settings' own 1fr/auto rule lives in settings.css.
check('the truncated heading is given room — h2 wrap in base.css, columns in settings.css',
  /\.screen:has\(> \.screen-content\) \.card-header-row h2 \{ white-space: normal; \}/.test(read('css/base.css'))
  && /#screen-maktabSettings \.card-header-row \{ grid-template-columns: 1fr auto; \}/.test(read('css/settings.css'))
  && !/\.screen:has\(> \.screen-content\) \.card-header-row \{[^}]*grid-template-columns/.test(read('css/base.css')));

// ---------- it renders ----------
{
  const dom = new JSDOM('<!doctype html><body><div id="host"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval('function esc(x){ return String(x == null ? "" : x); }');
  // Anchor on `host.innerHTML = \`` alone. The previous version keyed off
  // the first line of the template ("Maktab name" label markup), so a
  // layout change broke the TEST rather than revealing a real fault —
  // three assertions failed for a reason unrelated to what they check.
  const body = form.slice(form.indexOf('host.innerHTML = `'));
  const tmpl = body.slice(body.indexOf('`') + 1, body.indexOf('`;'));
  w.eval(`const s = { name: 'M', mushaf: '15line_indopak', maktab_day_min: 3, absence_flag_days: 30 };
          document.getElementById('host').innerHTML = \`${tmpl.replace(/\\/g, '\\\\')}\``);
  const radios = [...w.document.querySelectorAll('input[name="mset_mushaf"]')];
  check('renders exactly three radios', radios.length === 3, String(radios.length));
  check('the stored value is the one checked — including the newly added third',
    radios.filter(r => r.checked).length === 1 && w.document.querySelector('input[name="mset_mushaf"]:checked').value === '15line_indopak');
  check('each option shows its boundary detail while choosing, not after',
    w.document.querySelectorAll('.mset-mushaf-detail').length === 3);
}

check('the radio group is styled', /\.mset-mushaf-opt/.test(css) && /\.mset-mushaf-detail/.test(css));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
