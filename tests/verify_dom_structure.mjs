// ============================================================
// V4.2.6 — THE STRUCTURAL PIN.
//
// V4.2.4 shipped a regression that made every screen in the app stack on
// top of the last: removing a block of markup by string-slicing left ONE
// extra </div>, which closed #appContent early and dumped seven screens
// into <body>. showScreen hides only `#appContent > .screen`, so those
// seven were never hidden again once shown.
//
// 36 harnesses and 1194 checks did not catch it, because NONE of them
// asserted the document's STRUCTURE — they read index.html as text.
// Every markup removal done by slicing carried this exact risk with
// nothing watching. This harness watches.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const doc = new JSDOM(html).window.document;

// ---- 1: every screen is a direct child of #appContent ----
// This is the invariant showScreen depends on (js/app.js: it hides
// `#appContent > .screen`). A screen outside that set can never be hidden.
const app = doc.getElementById('appContent');
check('#appContent exists', !!app);
const screens = [...doc.querySelectorAll('.screen')];
const direct = [...doc.querySelectorAll('#appContent > .screen')];
const orphans = screens.filter(s => !direct.includes(s)).map(s => s.id || '(no id)');
check('EVERY .screen is a direct child of #appContent — showScreen can only hide those',
  orphans.length === 0, orphans.join(', '));
check('there are screens to check at all (guards against a selector that silently matches nothing)',
  screens.length >= 10, String(screens.length));

// ---- 2: the parse survives a round trip ----
// An unbalanced tag does not throw: the browser silently re-nests, which
// is exactly how the V4.2.4 fault hid. Re-parsing the serialised DOM and
// comparing the screen structure catches that silent re-nesting.
const round = new JSDOM(doc.documentElement.outerHTML).window.document;
check('re-parsing the document yields the same number of screens (no silent re-nesting)',
  [...round.querySelectorAll('.screen')].length === screens.length);
check('re-parsing keeps every screen inside #appContent',
  [...round.querySelectorAll('#appContent > .screen')].length === direct.length);

// ---- 3: each screen still carries what the app expects of it ----
const noId = screens.filter(s => !s.id).length;
check('every screen has an id (showScreen looks them up by id)', noId === 0, String(noId));
const dupes = screens.map(s => s.id).filter((id, i, a) => a.indexOf(id) !== i);
check('no two screens share an id', dupes.length === 0, dupes.join(', '));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
