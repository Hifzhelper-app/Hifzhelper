# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

---

## V3.6 — real cache-busting (2026-07-26)

Bismillah. Closes the gap identified while debugging a medium/large-screen
rendering report: `sw.js`'s `CACHE_NAME` bump on every release only ever
evicted the *service worker's* own cache — it never touched the browser's
ordinary HTTP cache or Cloudflare's edge cache, both of which will keep
serving an old file under an unchanged URL indefinitely.

**Version-string query params**: every local `<link rel="stylesheet">` and
`<script src="...">` in `index.html` now carries `?v=3.6.0`
(`css/tokens.css?v=3.6.0`, `js/app.js?v=3.6.0`, etc.) — `sw.js`'s own
`ASSETS` list updated to match, so it stays correct for whenever it's
actually registered (Level 2, still not done, no behavior change here).
New convention documented in `CONVENTIONS.md` #10: bump this version string
across every reference, together, whenever any CSS/JS file changes — this
is manual discipline, there's no build step generating it.

**New `_headers` file** (Cloudflare Pages convention, didn't exist before):
`css/`, `js/`, and `shared/` get `Cache-Control: public, max-age=31536000,
immutable` — safe now that their URLs change whenever their content does.
`appicons/` gets a more moderate week-long cache (not query-string
versioned). `index.html`, `manifest.json`, and `sw.js` are explicitly set to
`no-cache, must-revalidate` — these are the entry points that reference
everything else, so they must always be fetched fresh or the browser never
learns a new version string exists in the first place.

**Files changed:**
```
index.html
sw.js
CONVENTIONS.md
```
**New file:**
```
_headers
```

**Retest before merging to `main`**: `TESTING.md` §15. This needs an actual
deployed preview (Cloudflare Pages) to verify — `_headers` has no effect
served from a plain local file open in a browser.

---

## V3.5 — PWA Level 1: installability (2026-07-26)

Bismillah. Scoped deliberately to core Web App Manifest + responsive web +
HTTPS + Android/Apple install conventions — stopping short of registering
the service worker or any offline behavior (that's Level 2, separate future
work).

**Manifest icon paths, actually fixed**: `manifest.json` declared
`icon-192.png` and `icon-512.png` at the repo root — neither file has ever
existed anywhere in this repo, so Chrome's install criteria (which require
a valid 192px and 512px icon) were failing silently. Now points at the real
files in `appicons/`.

**New maskable icon**: `appicons/maskable-icon-512x512.png`, added as a new
`purpose: "maskable"` manifest entry. The existing badge artwork
(`android-chrome-512x512.png`) fills its canvas edge-to-edge with no safe
margin, so reusing it directly would get clipped by Android's adaptive-icon
mask. The new asset instead places the transparent logo mark
(`appicons/logo.png`) on a `--palette-sage` (#829672) background, scaled so
the mark's bounding-box corners sit ~188px from center — comfortably inside
the ~205px safe-zone radius (80% of the 512px canvas).

**Apple Home Screen conventions**: `index.html`'s `<head>` gained
`apple-touch-icon` (the file already existed in `appicons/`, it just wasn't
referenced anywhere), `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style` (set to `black-translucent`, so the
status bar blends with the Sage banner once launched standalone), and
`apple-mobile-web-app-title`.

**Favicon links**: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`
also already existed in `appicons/` but were never linked from `<head>` —
fixed, so the browser tab icon now actually shows.

**Cleanup**: removed `appicons/site.webmanifest` — an orphaned,
auto-generated manifest never linked from `index.html`, with blank `name`
fields and icon paths pointing at the domain root rather than `appicons/`.
Kept for reference only until now; safe to delete since nothing referenced
it.

**Deliberately unchanged**: `sw.js` — it still exists but is not registered
anywhere. Registering it (plus any actual offline caching behavior) is
Level 2, not part of this delivery.

**Files changed:**
```
manifest.json
index.html
```
**New asset:**
```
appicons/maskable-icon-512x512.png
```
**Removed:**
```
appicons/site.webmanifest
```

**Retest before merging to `main`**: `TESTING.md` §14 — this is a
device/browser-only check, no backend involved. Needs a real Android Chrome
device/desktop Chrome and a real iOS Safari device to confirm properly;
DevTools can confirm the manifest itself is valid but not the actual
install/home-screen behavior.

---

## V3.4.3 — duplicate-flow correctness, inactive-student search, styling fixes (2026-07-26)

Bismillah. Eleven items from a second round of testing on V3.4.2, built together.

**Duplicate-check correctness**: the Continue button on both registration paths now makes a single `force:true` call and reacts to the match info THAT call returns, instead of trusting a flag stored from the original match — the real bug this fixes: editing the WhatsApp number to a genuinely different value and then pressing Continue was still asking "mark existing journal inactive?" even though the edited value no longer collided with anything. The duplicate search itself now also searches inactive students, not just active ones — previously a match against a retired journal went undetected entirely. Since self-registration has no direct admin actions, matching an inactive journal now offers a "request reactivation" email instead of the (now-inapplicable) "deactivate" question. The admin duplicate-match hint text now echoes back the actual matched name, WhatsApp number, and active/inactive status, rather than a generic message — useful now that the admin list can have several similarly-named test entries. Deactivating any student (via the admin toggle or either duplicate-flow's deactivate action) now automatically resets their PIN too, so a later reactivation always starts fresh.

**Styling/layout fixes**: the tablet/desktop breakpoint moves from 900px to 1300px — a real iPad 2 in landscape (1024px CSS width) was landing in the desktop 25%-width bucket instead of the intended tablet 50%-width bucket (known remaining edge case: a 12.9" iPad Pro in landscape, at 1366px, still lands in desktop under this threshold). The admin registration box's label/input regained the `display:block`/full-width styling every other form already has — it only looked right before because a since-removed wrapping `<div>` was accidentally forcing the line break. `.form-hint` (used for the actual explanatory text — the duplicate-match message, the registration-confirmation message) now reads off `--font-size-base` like labels/errors/buttons already do; it was wrongly left at 11px in V3.4.2. The journal table's weekday abbreviation (Sat/Sun) is a little bigger; the "+ add" placeholder text was confirmed already correct and untouched.

**Safari fix, root cause this time**: the "journal hidden under the banner" report turned out to not be a notch/safe-area issue at all — live inspection on an actual iPhone showed the DOM fully populated with real data and no console errors, but nothing painted until the page was scrolled. This is a known WebKit compositing bug: a `position: sticky` flex sibling (`#authBand`) before a `flex: 1` sibling (`#appContent`) computes layout correctly but doesn't paint it until a reflow forces it. Fixed by promoting `#appContent` onto its own compositing layer via `transform: translateZ(0)`. The safe-area-inset fix already shipped in V3.4.2 stays in place — it addresses genuine notch clearance, a separate concern from this paint bug.

**Correction (same day)**: the `translateZ(0)` attempt above did NOT actually fix it — retested on the same iPhone, still invisible until scroll. Likely cause: `#appContent` was never the element being shown/hidden (it always exists) — `#appShell` is what actually flips from `display:none` to `display:flex` at login, so promoting a child of the thing that changes may simply not touch whatever Safari fails to repaint at that transition. Replaced with a JS-driven fix in `app.js` (`fixJournalTopPaint()`): after the journal renders, it measures the real gap between the auth band's bottom edge and the journal content's actual position, and only corrects it if one exists — deliberately not a blind fixed-height margin, since that would double up with the already-correct flex layout once actually painted and leave a permanent visible gap on every device. The act of reading+writing those layout values is what forces Safari through a synchronous layout+paint pass, which is what actually resolves the symptom — the position correction itself is more of a safety net than the real mechanism. The `transform: translateZ(0)` line stays on `#appContent` (harmless, just not sufficient alone). Same pass also made the journal table's column headers sticky (`position: sticky`, offset via a JS-measured `--auth-band-height` custom property rather than a guessed static value, since the band's real height varies with the safe-area inset).

**Second correction (same day)**: the sticky-headers-inside-the-table approach above visually ended up covering the first data row once actually tested. Restructured: the header row now lives in its own container (`.journal-header-row`), a sibling of `.journal-wrap` rather than a `<thead>` inside `.journal-table` — this is what's actually sticky now, positioned via the same `--auth-band-height` variable. Column alignment between the header and the rows below (now two separate elements instead of one table's automatic layout) is kept in sync via an explicit `<colgroup>` on the table matched to identical `nth-child` percentages on the header row. The "Journal" `<h2>` heading was removed, and both the header row and the rows container now bleed to the screen edges (negative margins canceling `#appContent`'s own padding, down to a 4px residual) rather than sitting inset — `journal.js` itself needed no changes, since it only ever touched `#journalTbody`.

**Auth dropdown menu**: "Sign out" renamed to "Log out," moved to the end of the menu (after Refresh), and its icon (only the icon, not the label) is now red to set it apart as the one different-in-kind action in that list.

**Branding**: a new `appicons/logo.png` (added to the repo directly) now appears above the existing content on the personalized login, fallback login, registration, and create-PIN screens — centered, capped near 400px wide but scales down responsively so it can't overflow a narrow phone's card.

**Files changed:**
```
index.html
css/tokens.css
css/base.css
css/components.css
css/journal-table.css
css/admin.css
css/nav.css
js/auth.js
js/adminPage.js
sw.js
worker/src/auth.js
worker/src/admin.js
```

**New asset expected in the repo (not part of this zip)**: `appicons/logo.png` — the user has already added this directly; this delivery only references it.

**Retest before merging to `main`**: `TESTING.md` §13 has the full checklist, including the D1-only tests for inactive-student matching and the auto-reset-on-deactivate rule, plus a manual pass confirming the Continue-button fix (edit the WhatsApp to something new, then Continue, and confirm no deactivate prompt appears).

---

## V3.4.2 — session hardening, duplicate-check gap, typography/responsive protocol (2026-07-26)

Bismillah. Fourteen items from a round of V3.4.1 testing, built together.

**Session/back-guard, refined**: the back-guard now takes two presses instead of one — the first shows "Press back again to log out" (not silent), the second actually logs out. Separately, `bootApp()` now verifies the loaded profile's own ID actually matches the unique ID in the URL, closing a real gap: editing the ID directly in the address bar and pressing enter is a fresh page load, not a back/forward history traversal, so the back-guard's `popstate` listener never saw it and a stale token kept showing whichever account it belonged to regardless of the URL. Both fixes are separate and complementary — one covers history navigation, one covers direct navigation.

**Duplicate-check gap closed**: the name+WhatsApp check only ever ran when a WhatsApp number was actually given — leave it blank and two same-named students went completely undetected. A shared `findDuplicateMatch()` helper (used by both self- and admin-registration) now falls back to a name-only check against active students when WhatsApp is absent.

**Duplicate-match UI restructured, both registration paths**: the form fields now stay visible and editable throughout — no more hiding the inputs behind a separate prompt. Three buttons on a match: **Cancel** (dismiss, form stays as typed), **Continue** (always resubmits with whatever's *currently* in the fields — if unedited, creates the duplicate with an auto-appended number; if edited to no longer collide, becomes an ordinary registration), **Reset PIN** (unchanged, always targets whichever student was matched when the prompt first appeared, regardless of later edits). Admin's "also deactivate?" confirm, and the reset-PIN confirm, now read "CANCEL: Both journals remain active ; OK: mark existing journal INACTIVE" instead of the native dialog's generic Cancel/OK with no context.

**Admin panel**: "optional" removed from both WhatsApp placeholders (registration form and the user-detail card) — the field itself is still optional, just not labeled as such.

**Typography**: new `--font-size-base: 14px` root variable (tokens.css) — body text, form labels, error/result messages, and both button classes now read off it, so a future size change cascades from one place instead of being hunted down across files. Fine-print elements (`.eyebrow`, `.form-hint`, monospace IDs, nav tile labels) stay deliberately smaller by design.

**Responsive width protocol, refined**: replaces the old ~1/3 (33%) cap with exact breakpoints — mobile fills the available width, tablet is 50% (two fit side by side), desktop is 25% (four fit side by side), all centered. Applied to `.login-card` (every login/register/create-PIN/registered screen shares it) and `#screen-admin`. The percentage values live in shared `--width-tablet`/`--width-desktop` tokens; the breakpoints themselves (600px/900px) are necessarily repeated as literals since media queries can't consume CSS custom properties in their condition.

**Fallback screen**: "New Registration" moved from inline with the "Sign in" heading down to the bottom of the card, below the "Forgot your pin or ID?" text.

**Create-PIN screen**: now shows the full registration-confirmation message plus the personal URL and a copy icon (as a reminder — reuses the same message and a new shared `wireCopyButton()` helper, not a duplicate of the "Registered!" screen's Continue button). The "Confirm PIN" row stays hidden until "New PIN" is fully entered, and re-hides if the two don't match.

**Safari fix**: `#authBand` now adds `env(safe-area-inset-top)` on top of its normal padding — confirmed Safari-only (Android was unaffected), consistent with `viewport-fit=cover` letting content render under the notch/status bar without it.

**Files changed:**
```
index.html
css/tokens.css
css/base.css
css/components.css
css/detail-pages.css
css/admin.css
css/nav.css
js/app.js
js/auth.js
js/adminPage.js
sw.js
worker/src/auth.js
worker/src/admin.js
```

**Retest before merging to `main`**: `TESTING.md` §12 has the full checklist — the two-press back-guard timing, the URL-edit-while-logged-in case, the no-WhatsApp duplicate case for both registration paths, and a visual pass on a real Safari/iOS device for the safe-area fix specifically (nothing else in this delivery can be verified from a desktop browser alone).

---

## V3.4.1 — session security, duplicate-registration handling, admin list polish (2026-07-25)

Bismillah. Five items queued up across several rounds of testing/discussion
on V3.4, built together.

**Session security**: the login token moved from `localStorage` to
`sessionStorage` — it's cleared automatically the moment the tab/app
actually closes, so reopening always requires signing in again, given the
journal contents is considered valuable enough to be worth that tradeoff.
Alongside it, a back/forward guard: right after a successful login, one
extra history entry is pushed, so pressing back (or forward) while
authenticated always logs out and drops back to a fresh login screen
instead of silently continuing whatever session happens to still be
active — this is what directly stops one account's session from carrying
over onto a different account's URL via the browser's own back/forward
buttons. It only interrupts an authenticated session; it never traps
anyone or blocks navigation outright.

**Admin registration gets a WhatsApp field** — previously name-only even
though the backend already stored WhatsApp; the admin panel's register
form now collects it too.

**Duplicate-registration handling, for both self- and admin-registration**:
a matching name+WhatsApp against an existing *active* student surfaces a
warning, never a block. Self-registration keeps "Create a new journal
anyway" / "Reset PIN for the existing journal" (email); admin gets
"Continue" / "Reset PIN" (a direct action — no email needed, admin already
has that capability). Both flows now also offer marking the old/matched
journal inactive when continuing anyway — self-registration routes that
through email too (the "match" is just a self-reported claim, not verified
identity), admin gets a direct action. When continuing past a match, the
new record's name gets an auto-appended disambiguating number ("John
Smith" → "John Smith 2", then "John Smith 3", ...) via a shared
`nextDisambiguatedName()` helper used by both registration paths.

**Admin student list**: each row now has copy and native-share icon
buttons for that student's personal URL (share is feature-detected and
simply hidden on browsers without `navigator.share`, e.g. desktop Firefox
— no fallback, it just isn't there). Inactive students' names are greyed
out instead of a separate "Active"/"Inactive" text label, which is
removed — keeps rows more compact. Row markup changed from one big
`<button>` to a clickable name/ID button plus sibling icon-buttons,
since a `<button>` can't legally contain another `<button>`.

**Registration-confirmation screen**: the "Continue" button is now "Copy
and Continue" — it copies the personal URL to clipboard and then
navigates, so pressing the big button without using the copy icon first
doesn't leave anyone without their URL. The standalone copy icon is
unchanged.

**Files changed:**
```
js/api.js
js/app.js
js/auth.js
js/adminPage.js
js/icons.js
index.html
css/admin.css
sw.js
worker/src/auth.js
worker/src/admin.js
```

**Retest before merging to `main`**: the manual walkthrough in
`TESTING.md` §11, plus the D1-only duplicate-check/auto-numbering tests
for both registration paths.

---

## V3.4 — URL-based personalized login + registration duplicate-check (2026-07-25)

Bismillah. A login-flow rework built around one idea: a student's personal
URL is the "lock" for their journal (kept private, never memorized), and
their PIN is the "key" — not reasonable to expect a student to remember a
random ID as well as a PIN.

**Registration**: WhatsApp label/placeholder cleaned up ("WhatsApp number",
hint placeholder `+CODE 123456789`); before creating an account, a matching
NAME+WHATSAPP combination against an existing *active* student (normalized —
trimmed/case-insensitive name, digits-only WhatsApp, so formatting
differences don't hide a real match) now offers a choice instead of silently
creating a possible duplicate: "Create a new journal anyway" or "Reset PIN
for the existing journal" (opens a pre-filled `mailto:`). On success, auto-
navigates to a new "Registered!" screen showing the exact confirmed
onboarding message plus the student's personal URL as copyable text next to
a copy icon-button.

**URL-based login** (new `GET /auth/lookup?id=` endpoint, public, returns
just `{name, hasPin}` for an active ID — 404 for anything else, deliberately
vague like the login endpoint): visiting `/<uniqueID>` now skips the ID
field entirely and greets the student by name ("Ahlan wa Sahlan, [name]"),
either on a plain PIN-entry sign-in (PIN already set) or a new create-PIN
screen (first login — PIN entered twice to confirm). Every PIN entry point
across all three login screens now auto-submits on the 4th digit — no
Sign-in button anywhere.

**Fallback screen kept** for anyone reaching the app with no unique ID in
the URL, an ID that doesn't exist, or one that exists but isn't active —
same ID+PIN screen, with the "4-digit PIN"/"First time..." text and Sign-in
button removed, "New here? Register" → "New Registration", and its lost-
access message changed to "Forgot your pin or ID?" (the personalized
screens keep the original "Lost pin" wording — deliberately different
messages for the two contexts).

**Bug fix, not just a copy change**: the "content hidden behind the auth
banner" report traced to `#welcomeBanner` — `position: fixed` with a higher
z-index than `#authBand`, firing on *every* boot (not just first login), so
it covered the band and page content for 3 seconds on every load. Moved into
normal document flow inside `#appShell`, right after the auth band, so it
pushes content down instead of overlapping it.

**Also**: `sw.js`'s cache-name bumped and its precache list completed (it
was missing `detail-pages.css`, `admin.css`, and six page-specific JS files
that already existed — found while touching this file, unrelated to the
banner bug itself, which private-browsing testing had already ruled out as
a caching issue).

**Deferred, on purpose**: the Sabaq/Sabaq Dhor/Dhor detail-page container
width, the "Recent" rail sizing, and the three commentPrivacy.js tweaks —
holding until history and mushaf/model selection are sorted out first.

**New file needed on the Cloudflare Pages side**: `_redirects` (repo root)
— `/* /index.html 200` — so any path (`/<uniqueID>`) serves `index.html`
instead of a 404; the frontend then reads the path itself.

**Fix applied before merge**: the first pass of this delivery had a real
bug, not a config issue — screen switching used inline `style.display`,
but every login screen except the fallback carries a `hidden` class whose
CSS rule is `display: none !important`, which silently wins over an inline
style. Result: the fallback screen (no `hidden` class) rendered by default
and then hid itself once the URL lookup resolved, but nothing else could
ever show — a brief flash of the wrong screen, then blank. Fixed by
toggling the `hidden` class consistently everywhere instead (and giving
the fallback screen the same class as the others, so nothing shows until
JS explicitly picks one).

**Second fix, same delivery**: on the create-PIN screen, `clearPinGroup()`
was being called on the create row and then the confirm row right after —
since it always focuses the first box of whichever group it's called on,
the second call's focus silently won, so both the initial screen load and
a PIN-mismatch retry left the cursor in the confirm row instead of the
create row. Fixed by clearing confirm first, create last, in all three
places this happens (initial load, mismatch retry, and the server-error
retry after a successful match).

**Files changed:**
```
index.html
css/base.css
css/components.css
js/icons.js
js/api.js
js/auth.js
js/app.js
sw.js
worker/src/auth.js
worker/src/index.js
_redirects (new)
```

**Retest before merging to `main`**: the manual browser walkthrough in
`TESTING.md` §10, plus a private/incognito pass on the personalized and
create-PIN screens specifically, since the fallback/personalized split
depends on `/auth/lookup` behaving correctly for all three of "no ID",
"unknown ID", and "inactive ID".

---

## Reconciliation — repo had drifted significantly behind (2026-07-25)

Bismillah. Triggered by a question about whether the `frontend/` folder
move had actually happened — checking the real uploaded repo directly
(rather than continuing to assume) revealed the gap was much larger than
that one question: **9 files missing entirely, 11 present but stale
(predating V3.3.3/V3.3.4), 1 stray duplicate migration file** sitting at
the repo root outside `worker/`.

**Missing entirely**: `css/detail-pages.css`, `manifest.json`, migration
`0008_whatsapp_number.sql`, and six JS files that `index.html` actively
references — `commentPrivacy.js`, `dhorPage.js`, `sabaqDhorPage.js`,
`sabaqPage.js`, `tajweed.js`, `timer.js`. Their absence meant the Sabaq/
Sabaq Dhor/Dhor detail pages and the PWA manifest were genuinely broken
on the live site, not just out of date.

**Stale (present, but predating recent work)**: `admin.js`, `auth.js`,
`index.js`, `utils.js` (worker), `adminPage.js`, `api.js`, `auth.js`,
`icons.js`, `index.html`, `components.css`, `shared/data.js` (frontend).

**Confirmed NOT a gap, despite showing up in the raw comparison**:
`worker/src/entries.js`'s absence is correct — it was deliberately
deleted back in V2.2; the file only appeared "missing" because my own
scratch working copy had never been cleaned of it either.

**Fix delivered**: one complete package (45 real files) rather than
another incremental delta, given a delta-based approach is what let this
gap accumulate unnoticed in the first place — every current frontend
file, every worker source file, every migration, all syntax-checked
before delivery (26 JS files, all passing).

**Still needed on the user's end**: delete the stray root-level
`migrations/0007_admin_role.sql`, and run migration 0008 against
production (it was never applied — the file itself never made it into
the repo before now). Migration 0007 itself is unaffected by any of this
— confirmed already applied and working (verified earlier via a real
`ABCDEFG` login returning `role: admin`).

**Process note, worth carrying forward**: this happened at least in part
because recent deliveries (V3.3.2's follow-on patches, V3.3.3, V3.3.4)
weren't consistently making it fully into the live repo, and there was
no periodic check to catch that until a folder-structure question
prompted one. Worth periodically diffing the actual repo against the
working state, not just assuming each delivery landed cleanly.

---

## V3.3.4 — self-registration frontend + Lucide icons (2026-07-25)

Bismillah. The actual public registration screen, plus two more findings
that naturally belonged on the same login screen while it was already
being touched.

**Registration screen**: name + optional WhatsApp number, reachable via
a "New here? Register" link from the sign-in screen. On success, shows
the new ID clearly and pre-fills it into the login screen's ID field —
one less thing to copy by hand before setting a PIN.

**First-login "save this URL" message** — a real gap closed, not just
documented: `firstLogin` came back from the login API from the very
start of this project, but nothing in the frontend ever did anything
with it. Now, the first time anyone logs in (fresh registration or an
admin-created account), a one-time message appears encouraging them to
save the page or add it to their home screen — since there's no other
account-recovery path if that's the only place they ever log in from.

**Lost-PIN mailto link** — also previously only documented, not built.
A plain `mailto:hifzhelper.app@gmail.com` link on the sign-in screen,
pre-filled with a "Lost PIN" subject line. Zero backend, zero cost, per
the earlier decision.

**Lucide icon set** — `sabaq`/`sabaqDhor`/`dhor` now use Lucide's
`ellipsis`/`grip-horizontal`/`grip` icons (already correctly built with
`currentColor` and a `24x24` viewBox, matching every other icon in the
set) — **verified directly**: confirmed exact circle counts per icon (3/
6/9) and that all three correctly use `currentColor` + the standard
viewBox, not just eyeballed against the source files.

**Files changed:**
```
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js (apiRegister — added in V3.3.3, now actually used)
frontend/css/components.css
frontend/index.html
```

---

## V3.3.3 — self-registration backend + carried-forward findings (2026-07-25)

Bismillah. Backend for self-registration, plus the two items explicitly
carried forward to this version.

**`POST /auth/register`** (public, no token) — creates a student account
(self-registration always creates students only, never teacher/admin —
that stays an admin-only action). `name` required, `whatsapp_number`
optional (its purpose is disambiguating similarly-named students, not
identity verification, so nothing enforces it). No PIN set — same
first-login flow as every other account.

**ID generation consolidated to one place** (`utils.js`) — it was
duplicated in `admin.js` before this; now both admin-created and
self-registered students generate IDs through the same function
(CONVENTIONS.md principle 2).

**`whatsapp_number` column added** (migration 0008) — admin-created
students can now optionally get one too, and `POST /admin/update-user`
can edit it on any existing student, alongside the carried-forward
**editable active status** (a checkbox now, not read-only text) — both
using the same partial-update pattern as everything else, verified
directly: tested the field-diffing logic against realistic scenarios
(nothing changed, only WhatsApp changed, cleared, toggled inactive),
including the null-vs-empty-string edge case for a student who never
had a number set.

**Hamburger icon** replaces the down-chevron on the auth banner's
dropdown toggle — the other carried-forward item.

**Deliberately not in this pass**: the actual public self-registration
*screen* — that's V3.3.4, kept separate per the established backend-
first sequencing. The API client function (`apiRegister`) is ready and
tested, just not called from any UI yet.

**Files changed:**
```
worker/migrations/0008_whatsapp_number.sql  (new)
worker/src/utils.js
worker/src/admin.js
worker/src/auth.js
worker/src/index.js
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js
frontend/js/adminPage.js
```

---

## V3.3.2.4 — prep for moving index.html to the deployment root (2026-07-25)

Not deployed yet — this is ready for whenever the folder move actually
happens on your end. Confirmed approach: the **whole** `frontend/`
folder's contents move to the repo root (no `frontend/` folder at all),
not `index.html` alone — this keeps every existing `css/`/`js/` reference
inside `index.html` working unchanged, since they all move together
maintaining the same relative relationship. The only thing that actually
needed fixing: the `shared/data.js` reference, since `shared/` stays
where it is and becomes a sibling of the new root instead of the old
`frontend/` folder.

**Two files needed the fix, not one** — `index.html`'s script tag, and
`sw.js`'s own cached-asset list had the identical stale `../shared/data.js`
reference. Cache version bumped too, so browsers don't keep serving the
old cached files after the structure changes.

**Checked and confirmed unaffected**: `manifest.json`'s `start_url:
"./index.html"` needs no change — it's relative to `manifest.json`
itself, and the two move together. Also noted in passing: `sw.js` isn't
actually registered anywhere in the current code (no
`navigator.serviceWorker.register()` call exists) — a separate, real
finding, not part of this fix.

**Files changed:**
```
frontend/index.html
frontend/sw.js
```

**When you're ready to actually do the move**: upload these two (already-
fixed) versions to the new root location, alongside moving `css/`, `js/`,
and `manifest.json` there too.

---

## V3.3.2.3 — conventions + admin findings batch (2026-07-25)

Bismillah. `CONVENTIONS.md` extended first, then the buildable findings
from the last several rounds of testing.

**`CONVENTIONS.md`**: three new numbered principles, each grounded in a
real bug found this session, not hypothetical — environment values living
in one config spot (the stale `API_BASE` bug), never rendering UI against
async state before it's actually arrived (the missing-Admin-tile boot
order bug), and every component owning its own responsive behavior at
*both* ends of the screen-size spectrum, not just mobile (the register
button overflow + the desktop over-stretch, same underlying discipline,
opposite symptoms). File structure section also brought up to date —
it had drifted significantly behind the actual repo.

**Admin: delete a user** (`DELETE /admin/users`) — deliberately does
**not** cascade-delete history. D1's own foreign key enforcement (which
we hit directly during the 0007 migration) does the real work here: a
student with any existing records in `attendance`/`position`/any log
table fails to delete with a clear, deliberate error, rather than
silently destroying their history. Only a genuinely empty account can be
removed this way.

**Admin: edit name** (`POST /admin/update-user`) — same partial-update
shape as the log tables' `PATCH` endpoints. WhatsApp editing is not in
this pass — that column doesn't exist yet (arrives with V3.3.3).

**Student list redesign**: compact searchable list (ID / Name / Status)
replacing the old 5-column table — selecting a row opens a detail card
with everything editable (name, role, reset PIN, delete). This resolves
the mobile-overflow finding for the student list specifically by making
the list itself simple enough to never need to overflow.

**Both mobile-layout bugs actually fixed, not just documented**:
- Register button: explicit `width: auto` override where it sits inside
  a flex row — the exact fix CONVENTIONS.md principle 9 now documents
- Admin screen container: capped at 720px on screens ≥900px wide,
  rather than stretching to fill an ultra-wide monitor

**4-digit PIN as separate boxes**: auto-advances as each fills, backspace
on an empty box returns focus to the previous one — **tested directly**,
not just written: simulated typing through all four boxes, confirmed
correct advancing and that non-digit characters are filtered without
advancing focus.

**"Welcome, [Name]"**: a brief banner shown once each time the app boots
successfully (fresh login or returning with a valid token) — implemented
as a lightweight greeting rather than a full separate screen+navigation
step, a deliberate simplification worth knowing about.

**Deliberately not in this pass**: WhatsApp number editing (blocked on
the column not existing until V3.3.3); the URL restructuring
(`index.html` to the deployment root, `/UniqueID` path) — a genuinely
different kind of change (deployment/routing structure, not application
code) that deserves its own dedicated pass rather than being folded in
here.

**Files changed:**
```
CONVENTIONS.md
worker/src/admin.js
worker/src/index.js
frontend/js/api.js
frontend/js/adminPage.js
frontend/css/admin.css
frontend/js/auth.js
frontend/css/components.css
frontend/css/base.css
frontend/js/app.js
frontend/index.html
```

---

## V3.3.2.2 — hotfix: Admin tile missing from dropdown (2026-07-25)

`bootApp()` rendered the dropdown nav (`setupAuthBandAndDropdown()`)
*before* fetching the profile that sets `currentUser.role` — so the
dropdown always rendered against the default `role: 'student'`, no
matter who was actually logged in. Reordered: profile fetch now happens
first, dropdown renders after. Home page tiles were never affected —
they render on-demand when navigated to, by which point the role is
already correctly known.

**Verified directly**, not just reasoned about: simulated both the old
and new ordering — old order reproduces exactly 8 items with no Admin
tile (matching the reported screenshot precisely), new order correctly
shows 9 including Admin.

**Files changed:**
```
frontend/js/app.js
```

---

## V3.3.2.1 — hotfix: frontend pointed at the wrong Worker (2026-07-25)

`frontend/js/api.js`'s `API_BASE` was still the old dev Worker URL, left
over from V3.1 — from before the decision to work directly on production
and delete the dev repo. Every account created since then (including
`ABCDEFG`) only exists in production's database, so login was failing
correctly, just against the wrong target. Updated to the production
Worker URL.

**Files changed:**
```
frontend/js/api.js
```

---

## V3.3.2 — admin frontend (2026-07-25)

The user-list screen — reset PIN, change role, and register a new student,
all three together as agreed, since they share the same screen.

**Nav gating, tested not just asserted**: the "Admin" tile only appears for
`role === 'admin'` — verified directly (not just by inspection) that
students and teachers both get exactly 8 nav items with no admin tile,
while an admin gets 9. The backend already 403s non-admins on every
`/admin/*` endpoint regardless — this is purely about not showing a
button that would only ever fail for everyone else.

**Reset PIN and change-role both confirm before acting** — a plain
`confirm()` dialog, since both are real, immediate account-affecting
actions (reset PIN locks someone out until they set a new one; role
change is a genuine permission escalation if going to teacher/admin).
Declining a role-change reverts the dropdown back to its actual current
value rather than leaving it visually wrong.

**Register-student** shows the newly-generated ID clearly on screen after
creation, since that's the one piece of information the admin actually
needs to hand to the real student.

**Files changed/added:**
```
frontend/css/admin.css   (new)
frontend/js/adminPage.js (new)
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js
frontend/js/app.js
frontend/index.html
```

**Still ahead**: V3.3.3/3.3.4 — self-registration (backend then frontend).

---

## V3.3.1 — admin backend (2026-07-25)

Bismillah. First piece of a genuine account-management system, replacing
the "teacher inserts a row via the D1 console" habit we've been using for
every test student this whole project — consistent with the explicit
"no manual database changes" principle going forward.

**Schema**: `role`'s `CHECK` constraint only allowed `student`/`teacher` —
rebuilt the table (same pattern as migration 0003, since SQLite can't
alter a `CHECK` constraint in place) to allow `admin` too. Seeded one
bootstrap account in the migration itself — `ABCDEFG` / `ADMIN-01`,
**no `pin_hash` set**, so it goes through the exact same first-login flow
every other account uses (whatever PIN gets typed in first becomes the
real one) — nothing pre-hashed, since the pepper needed for that isn't
available at migration-write time by design.

**Four new endpoints, all gated to `role === 'admin'`** (`worker/src/admin.js`):
- `GET /admin/users` — list every student, never returns `pin_hash`
- `POST /admin/reset-pin` — clears a student's PIN, same recovery mechanic
- `POST /admin/change-role` — student/teacher/admin
- `POST /admin/register-student` — creates a new student with an
  app-generated unique ID (6-char, same format as existing IDs),
  collision-checked against the real database rather than assumed unique
  — **tested**: generated 1000 sample IDs, confirmed correct format and
  zero collisions among them, consistent with the ~2.18 billion possible
  IDs in that space

**Deliberately not in this pass**: the admin frontend (V3.3.2), self-
registration (V3.3.3/4) — this is backend only, same "backend first,
frontend as its own pass" sequencing as everything else.

**Files changed:**
```
worker/migrations/0007_admin_role.sql   (new)
worker/src/admin.js                     (new)
worker/src/index.js
TESTING.md
```

---

## V3.2 — dedicated per-log-type pages (2026-07-24)

The three pages reached via the journal table's column headers — replacing
their "not built yet" placeholders from V3.1. Written fresh, shared logic
factored out rather than repeated three times.

**New shared components** (used across all three pages):
- `tajweed.js` — the tag picker, extendable, major/minor aware.
  `TAJWEED_DEFAULTS` (`shared/data.js`) restructured from a flat string
  list into `{tag, major}` objects — added the three major categories
  agreed in design (Substitution, Omission, Addition), kept the existing
  eight as minor. Custom tags a student adds default to minor.
- `commentPrivacy.js` — the student-comment block with its private
  toggle, plus a read-only teacher-feedback display when present.
- `timer.js` — the real start/lap/stop timer.
  **Tested the actual invariant before shipping**: sum of lap times must
  exactly equal total duration. Verified with a simulated multi-lap
  sequence (15s total, three laps summing to exactly 15) before wiring it
  into the UI. A session with no explicit lap tap sends a plain
  `duration_seconds` with `lap_times: null` — never a trivial one-element
  array — per "make inputs optional wherever possible."

**Dhor page** (the richest of the three): reference selector, a juz'+
position+amount (quarter/half/full-juz') picker that computes
`segment_from`/`segment_to` correctly for whichever reference is active —
**tested this conversion directly**: waterval quarter/half/full = 1/2/4
markers, uthmani = 2/4/8, and confirmed real juz'-boundary examples
compute the right marker ranges, not just the unit counts in isolation.
Plus the timer, tajweed picker, mistakes, and comment block.

**Sabaq and Sabaq Dhor pages**: same shared components, their own fields.
**Known, flagged gap**: Sabaq Dhor's `zone` field is meant to be computed
automatically from the student's position/study-order data — that
computation isn't wired into the V3 frontend yet (nothing fetches
`position.json` anywhere in this codebase so far), so it's a manual text
field for now rather than a faked computation.

**All three pages** also show a swipe rail of recent entries (the last 14
days), reusing the swipe-rail CSS pattern from V3.1.

**Deliberately still not in this pass:**
- The gamified three-ring visual map — still the single biggest remaining
  piece
- Plans aren't wired into these pages yet — no plan-prepopulation, no way
  to create a plan, and no `plan_id` gets sent even though the Worker
  already supports it
- The three-model selector (13-line/Madina/Hybrid) — Dhor's reference
  picker here is the old simple two-option version, not the full model
  system
- Editing an existing entry from the recent-entries rail (currently
  read-only — tapping a rail card doesn't do anything yet)
- Privacy enforcement is visible (the toggle exists and saves) but
  nothing yet reads it back differently for a teacher view, since no
  teacher-facing screen exists

**Files changed/added:**
```
shared/data.js                      (TAJWEED_DEFAULTS restructured)
frontend/index.html
frontend/css/detail-pages.css       (new)
frontend/js/tajweed.js              (new)
frontend/js/commentPrivacy.js       (new)
frontend/js/timer.js                (new)
frontend/js/dhorPage.js             (new)
frontend/js/sabaqPage.js            (new)
frontend/js/sabaqDhorPage.js        (new)
frontend/js/app.js
```

---

## V3.1 — frontend foundation (2026-07-24)

Bismillah. The first piece of the frontend rebuild against the V2/V3
backend — written fresh (new modular file structure), not adapted from
the old V1.x monolithic `app.js`/`api.js`/`styles.css`, per preference.

**What's actually built and tested this round:**
- **CSS token layer** (`css/tokens.css`) — the five-color palette and the
  three ring colors defined once as named variables with documented
  usage, exactly as instructed, so either can be changed in one place
  later rather than hunted through component files.
- **Journal landing table** (`css/journal-table.css`, `js/journal.js`) —
  the physical-planner-style table (Date | Sabaq | Sabaq Dhor | Dhor |
  Feedback), Sage header for Date, Mauve for the log columns, matching
  the actual paper journal. Pulls from the real `/sabaq`, `/sabaq-dhor`,
  `/dhor`, `/reflections`, `/plans` endpoints — genuinely wired to V2/V3,
  not a mockup.
- **Auth band + slide-down dropdown** (`css/nav.css`, `js/auth.js`) —
  icon+label nav, no background/border, per the styling instruction;
  dropdown adds logout/refresh on top of the same nav set Home uses.
- **Home page** (`js/home.js`) — icon tiles, same nav set as the dropdown.
- **Quick-add modal** — tapping a journal cell opens a simple form and
  saves a real log entry. Deliberately basic (no tajweed tags, timer, or
  flexible units yet) — enough to make the app genuinely usable for daily
  logging while the richer per-type pages are still ahead.
- **Multi-entry-per-day and plan-prepopulation both verified working** —
  tested the actual data-grouping logic (not just eyeballed): two Sabaq
  entries on the same day correctly bucket together under V2's uncapped
  model; a future-dated plan correctly creates a visible row for a day
  with no logs yet, confirming the "plan pre-populates the table row"
  mechanism actually works end to end at the data layer.
- `sw.js` updated to the new file list, cache version bumped so browsers
  don't keep serving the old cached assets.

**Deliberately NOT in this pass — the next pieces of work, not oversights:**
- The gamified three-ring visual map (frequency/mistakes/time, triadic
  colors) — the biggest remaining piece
- The Dhor timer/lap UI
- The dedicated per-log-type pages (reached via the table's column
  headers) — currently show an honest "not built yet" placeholder
- The three-model selector (13-line/Madina/Hybrid) in the UI — the
  underlying `data.js` logic exists (V2.0), not yet surfaced
- Privacy toggles (student_comment_private, teacher_feedback_visibility,
  reflections.is_private) in any input form
- Swipe rails (multiple entries per day currently just show a count
  badge, not a browsable rail)
- The V1.4 setup wizard has NOT been reconciled against the V2/V3 schema
  — everyone currently lands straight on the journal regardless of
  `setup_complete`; flagged directly in `app.js`, not silently skipped

**Please delete these from the repo — fully superseded, nothing imports them:**
```
frontend/app.js
frontend/api.js
frontend/styles.css
```

**Files changed/added:**
```
frontend/index.html
frontend/sw.js
frontend/css/tokens.css        (new)
frontend/css/base.css          (new)
frontend/css/nav.css           (new)
frontend/css/journal-table.css (new)
frontend/css/components.css    (new)
frontend/js/icons.js           (new)
frontend/js/api.js             (new)
frontend/js/auth.js            (new)
frontend/js/home.js            (new)
frontend/js/journal.js         (new)
frontend/js/app.js             (new)
```

---

## V3.0 — plans, timer/lap, privacy (2026-07-24)

Bismillah. Three features designed over several sessions, built together
in one migration since they touch overlapping tables.

**Plans** (`plans`, new table): an intention, not a record — a student can
plan a specific Dhor/Sabaq/Sabaq Dhor for a specific future date, then
complete it later either via a quick checkbox (no log created) or with
full detail (creates the real log entry, linked back via
`completed_log_id`). **The Dhor input screen's default view is now driven
by this** — a day with a plan shows it pre-filled to complete; a day
without falls back to the existing manual picker; multiple plans for one
day show a selection rather than guessing which one's intended.

**Timer/lap** (`dhor_log`): `minutes` renamed to `duration_seconds` (real
precision, not whole minutes — a lap feature needs it), plus a new
`lap_times` JSON array column holding true per-section durations. Same
"variable-length list as one column" pattern as `tajweed_tags`, deliberately
not flat `time1`/`time2` columns (the exact anti-pattern rejected earlier
when discussing reviews) and not a separate table (laps are always
created as one batch, never independently queried).

**Privacy**: `student_comment` (the student's own performance
self-assessment — distinct from `teacher_feedback`) gets a
`student_comment_private` flag; `reflections` gets the equivalent
`is_private`. `teacher_feedback` gets a three-tier
`teacher_feedback_visibility` (`all`/`teachers_only`/`private`), since
multiple teachers viewing one student is confirmed real, not
hypothetical. Enforced in `logHelpers.js`'s new `applyPrivacy()` — a
private field gets redacted at read time based on who's actually asking,
never a full row hidden. **Tested, not just written**: verified all three
viewer perspectives (the student, the authoring teacher, a different
teacher) against a realistic set of rows before shipping — every case
matched the intended rule.

**Files changed:**
```
worker/migrations/0006_plans_timer_privacy.sql   (new)
worker/src/plans.js                               (new)
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
SCHEMA.md
```

**Still ahead**: the frontend — nothing calls `/plans` or the new
privacy/timer fields yet. Same sequencing as every other big change this
project: backend first, frontend as its own pass.

---

## V2.3 — real edit capability, not just comments (2026-07-22)

**Correction to V2.2's design**, not a bug fix — V2.2 only let `PATCH`
touch comment fields, on the reasoning that every save should be a
permanent, unedited record. Pushed back on directly: a user correcting a
mistake doesn't care whether that's implemented as "edit the row" or
"delete and re-log it" — same practical effect either way — and the app
can't enforce honesty about whether an edit reflects what actually
happened regardless of which mechanism exists. That's on the user, not
something to design around.

**What changed**: `PATCH` on all four logs (`/sabaq`, `/sabaq-dhor`,
`/dhor`, `/reflections`) now accepts any subset of that table's own
content fields *and/or* the comment fields, updating only what's
provided — one general-purpose partial update instead of a
comment-only one. `logHelpers.js`'s `updateComment` became the more
general `updateLog`.

**Still true from V2.2, unaffected by this**: saving is still always a
new row (no per-day cap, no upsert-by-date) — this correction is about
editing an *existing* row after the fact, not about how new entries get
created.

**Frontend responsibility, not built yet**: a confirmation before
submitting a content edit, since it overwrites what's there. Not
enforced server-side — that's a UX concern for whoever's about to
overwrite data, not a rule the API imposes.

**Files changed:**
```
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
```

---

## V2.2 — Worker code for the four independent logs (2026-07-22)

The Worker code to actually use the V2.1 schema — written fresh, not
adapted from the old `entries.js`, per preference. A shared
`logHelpers.js` implements the CRUD/duplicate-detection logic once (all
four tables share the same student_id/date/entered_by/comment/
is_duplicate/created_at shape), so each of `sabaqLog.js`, `sabaqDhorLog.js`,
`dhorLog.js`, `reflections.js` stays a thin wrapper supplying just its own
fields and validation.

**Real behavior change from V1.x, worth knowing**: V2 has no per-day cap,
so saving is *always* a new row now, never an upsert. Deleting is by the
row's own `id` (a real primary key), not by `date` + `entry_number` the
way V1.3 worked — there's no more "editing today's entry," each save is
its own permanent record.

**New**: comment/feedback are no longer part of the same save as the
entry's content — a separate `PATCH` (`/sabaq`, `/sabaq-dhor`, `/dhor`,
body `{id, student_comment}` or `{id, teacher_feedback}`) adds or updates
just that field, since a comment can come from a different person, later
(reflections has no comment concept, so no `PATCH` there).

**Duplicate handling**: implemented as designed — allowed, not rejected,
just flagged (`is_duplicate = 1` on the new row) when it exactly matches
an existing row's content for that student/date.

**Attendance**: all three activity logs (sabaq, sabaq dhor, dhor) mark
present on save, per the original rule — reflections do not, since
tadabbur isn't one of the three activity logs that rule covers.

**Files changed:**
```
worker/src/logHelpers.js   (new)
worker/src/sabaqLog.js     (new)
worker/src/sabaqDhorLog.js (new)
worker/src/dhorLog.js      (new)
worker/src/reflections.js  (new)
worker/src/index.js
worker/src/utils.js
```

**Delete this file, it's no longer used and nothing imports it:**
```
worker/src/entries.js
```

**Still ahead**: the frontend rebuild (independent views per log, the
three-model selector) — this Worker code has no UI calling it yet.

---

## V2.1 — independent logs schema (2026-07-22)

The actual schema rebuild designed across the long V2 planning session:
the single `entries` table is replaced with four independent logs —
`sabaq_log`, `sabaq_dhor_log`, `dhor_log`, `reflections` — no caps, each
tracking `entered_by` separately from `student_id`, each comment/feedback
field carrying its own author and timestamp. `students`/`attendance`/
`position` are untouched.

No data migration from the old `entries` table — nothing real exists in
it yet, per the "delete everything, start fresh" decision made earlier.

**Files changed:**
```
worker/migrations/0005_v2_independent_logs.sql   (new)
SCHEMA.md
```

**Still ahead**: the Worker code (new modules for the four logs, written
fresh rather than adapted from the old `entries.js`, per preference) and
the frontend rebuild (independent views per log, the three-model
selector). This migration alone doesn't make anything work yet — the old
`worker/src/entries.js` still references a table this migration just
dropped, so **do not deploy this migration without also deploying new
Worker code in the same step** — same code/schema-mismatch risk flagged
back in V1.3, same fix: merge and migrate together, not with a gap
between them.

---

## V2.0 — 13-line (IndoPak) line/page data (2026-07-22)

First entry in the V2.x line — the six-table independent-logs redesign
(sabaq_log/sabaq_dhor_log/dhor_log/reflections, the three-model reference
selector, the setup-page rebuild) is designed but not yet built; this
version starts the new numbering with the first concrete piece of it: real
line/page counting for the 13-line print, closing a gap that took most of
a full session to properly source and verify (two rejected reconstruction
attempts before finding data that actually held up).

**What's new**: `shared/data.js` gains `AYAH_WORD_RANGE` (all 6236 ayahs'
word-ID ranges, universal across print layouts) and `LINE13_RANGES`
(10769 real content lines for the 13-line print), plus
`getLines13ForAyahRange(surah, ayahFrom, ayahTo)` — returns line/page
counts for a given ayah range. Verified 114/114 against the print's own
surah markers; noted as approximate (not exact-reference-grade like the
15-line data) given a ~4% discrepancy rate found when cross-checked at
finer granularity.

**Naming correction, going forward**: stop saying "Waterval" — too
localised a name. Say "13-line (IndoPak)" instead. The internal code key
(`RUB_BOUNDARIES.waterval`) is left as-is for now rather than a piecemeal
rename — it'll be properly renamed as part of the upcoming three-model
selector rebuild (Model 1 / Model 2 / Model 3), which touches this same
code anyway.

**Files changed:**
```
shared/data.js
SCHEMA.md
```

---

## V1.4 — self-onboarding setup page (2026-07-20)

New students now walk through a one-time setup screen on first login,
instead of starting from a completely blank journal. Decided against
importing historical data from old systems (a real example — Umme's dhor
log CSV — surfaced the design question, but the answer was: students
self-enter where they're starting from, the app builds forward from there).

**Setup collects**: name, gender (stored directly, may drive future
styling), haidh-tracking preference (shown only for females, independent
toggle — not auto-enabled by gender), Quran print preference (reuses the
existing device-level toggle), current sabaq position, and which juz' are
already complete (reuses the existing manzil strip, in a tap-to-mark-
complete mode). Last-dhor dates are optional — enter them if known,
otherwise a segment is simply treated as never-revised, no fabricated
history.

**Reused rather than rebuilt**: `POST /position` already accepted exactly
the shape setup needs — no new endpoint for the juz'/dhor part. The
position-update logic itself was extracted into a shared
`applyReachedPosition()` function (used by both the daily save handler and
setup), and `renderJuzStripInto()` was parameterized to accept a tap
handler, so setup's "mark complete" mode doesn't trigger a live API call
per tap the way the daily journal's does.

**New**: `GET /profile` / `POST /profile` endpoints; `gender`,
`track_haidh`, `setup_complete` columns on `students`.

**Known shortcut, not a polish gap to ignore forever**: last-dhor date
entry during setup uses a plain browser `prompt()`, not a custom date
picker — deliberate simplicity for a one-time screen, worth revisiting if
it turns out to feel rough in practice.

**Files changed:**
```
worker/migrations/0004_profile_setup.sql   (new)
worker/src/profile.js                       (new)
worker/src/index.js
frontend/api.js
frontend/app.js
frontend/index.html
SCHEMA.md
TESTING.md
```

---

## V1.3 — up to two entries per day (2026-07-19)

Students can now log a second sabaq/sabaq dhor/dhor on the same day
(capped at two). Design: `entries` gets an `entry_number` column (1 or 2),
uniqueness changes from `(student_id, date)` to `(student_id, date,
entry_number)`. Frontend shows a normal form for the first entry; once it
exists, an "Add a second sabaq today" button appears; once both exist, a
small Entry 1 / Entry 2 switcher replaces it.

**Two real bugs fixed along the way, not just the new feature:**
- The delete-entry handler (both Worker and frontend) previously matched
  only on `date` — meaning deleting one entry would have deleted *both* of
  a day's entries once this feature existed. Fixed to match on
  `(date, entry_number)`.
- The frontend's local attendance optimistic-update still had the old
  "unless already haidh" exception from before the V1.1 fix — the server
  was corrected months ago but this client-side mirror wasn't. Now matches:
  sabaq always wins, unconditionally.

**Files changed:**
```
worker/migrations/0003_two_entries_per_day.sql   (new)
worker/src/entries.js
worker/src/utils.js
frontend/api.js
frontend/app.js
frontend/index.html
frontend/styles.css
SCHEMA.md
TESTING.md
```

**Migration note**: 0003 rebuilds the `entries` table (SQLite can't ALTER a
UNIQUE constraint in place) — existing rows are preserved with
`entry_number = 1`. Run it on dev first, verify via `TESTING.md` §2, then
production, same as every migration so far.

---

## V1.2 — new-account secret bug, resolved (2026-07-19)

**Bug (new account only, not a code defect)**: after migrating to the new
`hifzhelper-app` Cloudflare account, `hifzhelper-api-dev` returned a `500`
on every login attempt — `DataError: Imported HMAC key length (0)...`. Root
cause: `HH_AUTH_SECRET` had been saved with an empty value during initial
setup (the dashboard showed it as configured either way, since it never
displays the actual value back). Fixed by deleting and re-adding the secret
with a genuine random value. Confirmed fixed by direct evidence — added a
temporary `/debug/env` route reporting the secret's type/length (never its
value) to get real ground truth instead of continuing to infer from side
effects; removed again once resolved.

**Production was unaffected** — tested cleanly on first attempt, confirming
it was set up correctly from the start; this was a dev-environment-only
mistake.

**Files changed:**
```
worker/src/index.js
```
(temporary debug route added, then fully removed in the same version — net
effect on this file is zero, but noting it here since two separate patches
were shipped and reverted during the diagnosis)

**Lesson for future setup**: a "Value encrypted" / secret-looks-configured
display in the dashboard does not confirm the value is non-empty. Worth a
quick `/debug/env`-style sanity check (or just an immediate login test)
right after setting secrets on any new environment, rather than assuming
success from the save confirmation alone.

---

## V1.1.1 — new Cloudflare account/repo migration (2026-07-19)

Moved Hifzhelper to its own dedicated repo and Cloudflare account
(previously shared with other projects). No code logic changed — only
the backend URLs the frontend points at, since the new account has a
different Workers subdomain.

**Files changed:**
```
frontend/api.js
TESTING.md
```

**New URLs** (replacing the old `*.maktab4life.workers.dev` ones):
- Dev: `https://hifzhelper-api-dev.hifzhelper-app.workers.dev`
- Production: `https://hifzhelper-api.hifzhelper-app.workers.dev`

**Still needed on the new account before this is testable** (see SETUP.md):
migrations run against both new D1 databases, secrets set on both new
Worker projects, Git integration connected for both, a fresh test student
inserted into the new dev database. None of this carries over automatically
just because the repo/code is identical.

---

## V1.1 — attendance rule correction (2026-07-19)

**Bug fix**: attendance was built with a "haidh takes precedence over a
logged entry" exception that was never actually part of the agreed rule —
it was my own assumption layered on top of "any recorded activity marks
present." The real rule is simpler: **sabaq always wins**. Logging an
entry now unconditionally marks that day present, including overriding a
day previously marked haidh manually.

**Files changed:**
```
worker/src/entries.js
SCHEMA.md
TESTING.md
```

**Retest before merging to `main`**: re-run the "Manual override" row in
`TESTING.md` §3 — mark a date `haidh`, then save an entry for that same
date, then confirm via D1 console it now shows `present`, not `haidh`.

---

## V1.0 — baseline (2026-07-19)

The first fully working version: student journal PWA (localStorage removed,
now backed by a real Cloudflare Worker + D1), login/PIN auth with lockout,
entries/attendance/position all persisted server-side and verified working
end-to-end against the dev environment (login, repeat-login, wrong-PIN,
5-attempt lockout, entry save/read, attendance auto-marking — all tested via
Hoppscotch against `hifzhelper-api-dev`).

See `TESTING.md` for the repeatable version of that same test sequence —
worth re-running it against any future version before considering it done.

**Everything in this delivery** (full repo, since this is the baseline):
```
.gitignore
CONVENTIONS.md
SCHEMA.md
SETUP.md
frontend/index.html
frontend/app.js
frontend/api.js
frontend/styles.css
frontend/manifest.json
frontend/sw.js
shared/data.js
worker/wrangler.jsonc
worker/package.json
worker/src/index.js
worker/src/auth.js
worker/src/entries.js
worker/src/attendance.js
worker/src/position.js
worker/src/utils.js
worker/migrations/0001_initial.sql
worker/migrations/0002_auth_lockout.sql
```

**Known gaps, carried forward (not bugs, just not done yet):**
- Custom tajweed tags stay local-only (no server field for them yet)
- No offline write queue — a failed save just shows an error, no retry
- Production Worker/database never tested end-to-end (only dev)
- CSS not yet split into modules (requested for next revision)
- Teacher/Maktab view (Phase 2) not started
- Mistake-marking on a page image (Phase 3) not started
