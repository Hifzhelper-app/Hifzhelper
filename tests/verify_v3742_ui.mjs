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
// V3.74.4: the two earlier attempts set MAX-width on a flex container that
// sizes to its content, so they capped it and never widened it — both were
// no-ops. This asserts an explicit width, and that max-width has not crept
// back, because that is the mistake that made it look like nothing changed.
check('1: the pill sets an explicit WIDTH, not max-width',
  /\.mk-vis-switch \{[\s\S]{0,140}width: 240px;/.test(dp) && !/\.mk-vis-switch \{[\s\S]{0,140}max-width/.test(dp));
check('1: and will not be shrunk back by the flex row it sits in',
  /\.mk-vis-switch \{[\s\S]{0,140}flex: 0 0 auto;/.test(dp));
check('1: exactly ONE .mk-vis-switch rule — three generations had stacked up',
  (dp.match(/^\.mk-vis-switch \{/gm) || []).length === 1, String((dp.match(/^\.mk-vis-switch \{/gm) || []).length));
check('1: the thumb radius is tied to the height, so it is a pill not a circle',
  /\.mk-vis-switch \.switch-thumb \{[\s\S]{0,140}border-radius: 999px/.test(dp));
check('1: the options cannot hold the track taller than its set height',
  /\.mk-vis-switch \.switch-option \{[\s\S]{0,160}line-height: 1;/.test(dp));

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

// ---------- 12: the per-juz rewrite (V3.74.3) ----------
// Was one option per ROW, with halves sequenced so the second could not
// move until the first had. The option now belongs to the JUZ: it ignores
// roll-up, activates at four quarters, and takes the whole juz.
{
  const pos = read('js/position.js');
  check('12: no row carries a move option any more', !/canMoveToDhor: (true|false)/.test(pos));
  check('12: the sequential half-unlock is gone', !/firstHalfMoved/.test(pos) && !/secondHalfMoved/.test(pos));
  check('12: the option is computed per juz', /function computeJuzMoveOption\(/.test(pos) && /function computeSabaqDhorMoveOptions\(/.test(pos));
  check('12: it activates only at four complete quarters', /enabled: completeQuarters >= 4/.test(pos));
  check('12: a juz already in the pool offers nothing', /if\(units\.every\(u => baselineSelection\.includes\(u\)\)\) return null/.test(pos));
  check('12: a fully-moved juz leaves Sabaq Dhor — no separate removal step to drift',
    /const fullyMoved = allUnits\.every[\s\S]{0,120}if\(fullyMoved\) return \[\]/.test(pos));

  check('12: the button is rendered from the juz, NOT from a row — roll-up cannot hide it',
    /sabaqDhorMoveOptions\.map\(o =>/.test(sd) && /data-juz="\$\{o\.juz\}"/.test(sd));
  check('12: it is shown disabled before four, with the count, rather than appearing from nowhere',
    /o\.enabled \? '' : ' disabled'/.test(sd) && /\$\{o\.completeQuarters\} of 4 complete/.test(sd));
  check('12: moving takes all four quarters', /pool\.concat\(opt\.units\)/.test(sd));
  check('11: it confirms first, naming the juz and saying it leaves Sabaq Dhor',
    /confirm\(`Move all four quarters of Juz \$\{juz\}/.test(sd) && /no longer appear in Sabaq Dhor/.test(sd));
  check('11: cancelling does nothing at all', /\)\) return;\n\n  try\{/.test(sd));
  check('12: the pool read and write both stay routed — this is a maktab write',
    /await logProfile\(\)/.test(sd) && /await logSavePool\(merged\)/.test(sd) && !/apiSaveProfile\(/.test(sd));
  check('12: the old per-row mover is gone', !/function moveRowToDhor/.test(sd));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
