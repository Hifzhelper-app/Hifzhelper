// ============================================================
// verify_v3742_ui.mjs — the V3.74.2 batch (items 1-11).
//
// Weighted toward the three that change BEHAVIOUR, not layout:
//   - the +1 badge (item 8) must open a peek and NOT fall through to the
//     row's day-view navigation. It fell through precisely because it had
//     been downgraded to a span with nothing to catch the tap.
//   - Move to Dhor (10/11) must confirm before changing a pool.
//   - the menu groups (7) must not leave a divider under a group that
//     role-gating emptied.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

const auth = read('js/auth.js');
const summary = read('js/maktabSummary.js');
const sd = read('js/sabaqDhorPage.js');
const admin = read('js/adminPage.js');
const settings = read('js/maktabSettings.js');
const html = read('index.html');
const dp = read('css/detail-pages.css');
const jt = read('css/journal-table.css');
const st = read('css/settings.css');

// ---------- 1: the pill ----------
check('1: pill is wider and shorter than V3.74.0', /\.mk-vis-switch \{ max-width: 240px; height: 11px; \}/.test(dp));
check('1: the thumb radius is tied to the height, so it is a pill not a circle',
  /\.mk-vis-switch \.switch-thumb \{[\s\S]{0,120}border-radius: 999px/.test(dp));

// ---------- 2-4: maktab settings ----------
check('2: the four settings carry their own spacing', /#maktabSettingsBody > \.form-label[\s\S]{0,180}margin-bottom/.test(st));
check('3: save is an icon on the name row', /class="mset-save-btn" id="mset_save"/.test(settings));
check('3: and the bottom text button is GONE, not a second way to save',
  !/class="primary-btn" id="mset_save"/.test(settings));
check('3: the icon comes from the shared set', /iconHtml\('save'\)/.test(settings));
check('4: Mushaf is a normal label, not a fieldset legend', /class="form-label mset-mushaf-label"/.test(settings) && !/<legend>Mushaf/.test(settings));
check('4: the numeric labels no longer strand their unit on a wrapped line',
  /#maktabSettingsBody \.form-label input\[type="number"\][\s\S]{0,140}width: auto/.test(st));

// ---------- 5-6: admin ----------
check('5: the admin header groups icon and heading left', /card-header-row card-header-row-left/.test(html));
check('5: with an auto/1fr/auto grid, not the shared 10/70/20',
  /\.card-header-row-left \{[\s\S]{0,80}grid-template-columns: auto 1fr auto/.test(dp));
check('5: the close label no longer claims to exit Home',
  !/id="adminCloseBtn" aria-label="Exit to Home"/.test(html));
check('6: the id is hidden in the list', /class="mono admin-list-id" hidden/.test(admin));
check('6: but the id is still RENDERED, so copy and search still have it',
  /\$\{u\.id\}/.test(admin));

// ---------- 7: menu groups ----------
{
  const src = auth.slice(auth.indexOf('const NAV_ITEMS = ['), auth.indexOf('function renderNavItemsInto'));
  const w = new JSDOM('<!doctype html>').window;
  const groups = (role) => { w.eval(`var currentUser={role:"${role}",trackHaidh:false};`); w.eval(src); return w.eval('visibleNavGroups().map(g=>g.map(i=>i.id))'); };

  const a = groups('admin');
  check('7: admin group 1 is Home, Maktab, Maktab Settings, Admin',
    JSON.stringify(a[0]) === JSON.stringify(['home', 'maktabSummary', 'maktabSettings', 'admin']), JSON.stringify(a[0]));
  check('7: group 2 leads with Surahs, Juz Tracker, Timer',
    JSON.stringify(a[1].slice(0, 3)) === JSON.stringify(['sih', 'juzTracker', 'timer']), JSON.stringify(a[1]));
  check('7: the last group is Refresh then Log out',
    JSON.stringify(a[a.length - 1]) === JSON.stringify(['refresh', 'logout']));

  const s = groups('student');
  check('7: a student sees Home alone in group 1 — no empty groups emitted',
    JSON.stringify(s[0]) === JSON.stringify(['home']) && s.every(g => g.length > 0), JSON.stringify(s));
  check('7: and keeps her own screens among the personal tools', s[1].includes('journal') && s[1].includes('maktabJournal'));
  check('7: dividers go BETWEEN groups, never trailing',
    /visibleNavGroups\(\)\.map\(g => g\.map\(btn\)\.join\(''\)\)\.join\('<div class="dropdown-divider"><\/div>'\)/.test(auth));
  check('7: the Home tile grid takes screens only, not Timer or Log out',
    /visibleNavItems\(\)\.filter\(i => !i\.raw\)/.test(auth));
  check('7: the non-screen items keep their original ids, so existing listeners still bind',
    /id="\$\{item\.raw\}"/.test(auth) && /homeDropdownBtn/.test(auth) && /logoutBtn/.test(auth));
}

// ---------- 8: the peek ----------
check('8: the badge is a BUTTON again — as a span the tap fell through to the row',
  /data-entry-peek="\$\{type\}"/.test(summary) && !/<span class="entry-count-badge">\$1<\/span>/.test(summary));
check('8: and the tap is stopped from reaching the row', /e\.stopPropagation\(\);/.test(summary));
check('8: the list is read-only — no navigation from inside the panel',
  !/maktab-entry-peek[\s\S]{0,600}showScreen\(/.test(summary));
check('8: it lists EVERY entry, including the one already on screen',
  /\(entries \|\| \[\]\)\.map/.test(summary));
check('8: entries come from the cell rather than being re-parsed out of text',
  /td\._peekEntries = byStudent\[type\]\[stu\.id\]/.test(summary));
check('8: it flips above the badge when there is no room below',
  /r\.top - panel\.offsetHeight/.test(summary));
check('8: clicking away closes it', /maktabCloseEntryPeek\(\);/.test(summary));

// ---------- 9: haidh border ----------
check('9: the border is gone', /\.maktab-haidh-check \{[\s\S]{0,120}border: none/.test(jt));
check('9: but it still reads as tappable — it is the ONLY place haidh is marked now',
  /\.maktab-haidh-check:hover/.test(jt));

// ---------- 10-11: move to dhor ----------
check('10: the button is on its own row spanning the grid', /\.move-to-dhor-row \{[\s\S]{0,80}grid-column: 1 \/ -1/.test(dp));
check('10: and names its portion, since one line loses the tie to the row above',
  /Move \$\{r\.label\} to Dhor/.test(sd));
check('11: it confirms before changing the pool', /if\(!confirm\(`Move \$\{row\.label\}/.test(sd));
check('11: the confirmation names the portion, so a mis-tap is caught here',
  /\$\{row\.fromSurah\}:\$\{row\.fromAyah\}/.test(sd));
check('11: and cancelling does nothing at all', /\)\) return;\n\n  try\{/.test(sd));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
