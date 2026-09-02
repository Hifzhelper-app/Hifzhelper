# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

## MIGRATION STATUS — hifzhelper-maktab1 (confirmed 2026-08-17)

**All delivered migrations are RUN. Nothing is pending. Do not re-run.**

| Migration | Delivered | Status on `hifzhelper-maktab1` |
| --- | --- | --- |
| `0019_maktab_tables.sql` | V3.57.0 | RUN |
| `0020_maktab_settings.sql` | V3.65.0–V3.67.0 | RUN |
| `0021_maktab_position.sql` | V3.65.0–V3.67.0 | RUN |

**Every entry below is a record of one delivery on the day it shipped.** The
"RUN MIGRATION x first", "deploy the worker first" and similar instructions
inside them were the correct instruction *for that upload*. They are history,
not an outstanding action — read this block for current state. Mirrored from
`TODO.md`, which carries the same block; both are updated together
(CONVENTIONS.md §13).

Maktab deployment only — `hifzhelper-personal-db` diverged at V3.57 and takes
none of these.
---

## V4.2.11 — Attendance register grid + Female/Haaidha registration (2026-09-02)

**Files touched:** `index.html`, `css/admin.css`, `css/detail-pages.css`, `js/adminPage.js`, `js/api.js`, `js/haidhDetailScreen.js`, `js/maktabAttendancePage.js`, `js/sw.js`, `worker/src/admin.js`, `worker/src/attendance.js`, `worker/src/index.js`, `worker/src/maktabAttendance.js`, `tests/verify_v3761_haidh_predictions.mjs`, `tests/verify_v4210_ui.mjs`, `tests/verify_v4211_ui.mjs` (new), `tests/verify_v4292_ui.mjs`, `SCHEMA.md`, `SPECS.md`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **WORKER + FRONTEND — no schema migration.**

1. **Attendance is now a term register, not one list per day.** The Maktab Attendance overview has one roster down the left and the configured teaching days across the selected term. Header row 1 groups each set of teaching-day columns under one merged **Maktab week** heading; header row 2 uses narrow weekday labels (`Mon`, `Tue`, `Wed`, `Thu`, etc.). Week groups are separated with subtle alternating shading plus a stronger boundary line, and the student column stays sticky while the register scrolls horizontally. Previous/next moves between configured terms; with no terms configured, the fallback is a four-week register containing today.
2. **Status cells are deliberately minimal.** Any real Maktab Sabaq / Sabaq Dhor / Dhor log on that date shows a **green tick**. A Haidh / predicted-Haidh attendance mark shows the existing **yellow Haidh icon**. A completed qualifying Maktab day with neither is visually **blank = absent**. Future columns and past teaching dates that did not meet the configured Maktab-day threshold are muted so their blank cells are not misread as absences. A real log still shows its green tick even on a below-threshold date.
3. **Student name opens the existing individual Attendance editor.** The overview is a read/scan surface; clicking or tapping the student's sticky name opens that student's established Attendance page, where the teacher can edit attendance and Haidh. The old one-week worker endpoint remains for compatibility, but the screen now reads `GET /maktab/attendance-register`.
4. **Register a student gains Female → Haaidha.** Student Management registration now includes **Female**; selecting it reveals **Haaidha**. The existing `students.gender` and `students.track_haidh` columns are used directly, so no migration is required. If Female is not selected, Haaidha is hidden/cleared. Existing Role / Group / Status registration behaviour remains.
5. **A confirmed teacher Haidh mark promotes the profile automatically.** When a teacher/admin confirms a real Haidh day or range, the worker sets that student's `gender='F'` and `track_haidh=1`. This makes the Haidh calendar available on her own Attendance page from then on. A future **predicted** Haidh range does **not** promote the profile. Teachers/admins can see the Haidh calendar while editing a Maktab student even before she is marked Haaidha, which makes the first confirming mark possible. Removing a later mark does not undo the profile promotion.
6. **Version discipline preserved.** Only served files genuinely edited in this release receive a `4.2.11` top build header: `css/admin.css`, `css/detail-pages.css`, `js/adminPage.js`, `js/api.js`, `js/haidhDetailScreen.js`, `js/maktabAttendancePage.js`, and `js/sw.js`. `index.html` and the service-worker precache use the shared 4.2.11 page/cache key; untouched served-file headers remain at their previous last-edit versions.

**Deployment:** no D1 migration. **Deploy the Worker first** (new register endpoint + registration/profile write + Haidh auto-promotion), then deploy the changed Pages files and hard-refresh.

**Regression coverage:** new dependency-free `verify_v4211_ui.mjs` pins the two-row weekly header, teaching-day columns, sticky single roster, status icons/blank semantics, name navigation, Female/Haaidha registration, server persistence, confirmed-Haidh promotion, predicted-Haidh non-promotion and 4.2.11 version keys. The Haidh prediction fixture also exercises the new worker promotion path.

**Verification in this build container:** V4.2.11 UI **16/16**, dynamic Haidh promotion/prediction **24/24**, V4.2.10 **11/11**, V4.2.9.2 **11/11**, V4.2.9.1 **6/6**, V4.2.9 **11/11**, cumulative V4.2.8 **17/17**, build/version **6/6**, served-script syntax **36/36**, Worker syntax **4/4**. `run-all.mjs` reports **318 passed, 0 failed** among harnesses able to report; 27 older harnesses cannot report in this checkout because `jsdom` is absent and/or their legacy fixtures have pre-existing schema drift.

---

## V4.2.10 — Log-detail student switcher + active-name pill + Sabaq Dhor selector alignment (2026-09-02)

**Files touched:** `index.html`, `css/detail-pages.css`, `css/journal-table.css`, `js/logDetailScreen.js`, `js/sabaqDhorPage.js`, `js/sw.js`, `tests/verify_v4210_ui.mjs` (new), `tests/verify_v428_ui.mjs`, `tests/verify_v4291_ui.mjs`, `tests/verify_v4292_ui.mjs`, `tests/verify_v3850_batch.mjs`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY — no worker, schema or migration change.**

1. **Student search on every Maktab log-detail card and screen size.** A shared **Search student** field now sits above the Sabaq / Sabaq Dhor / Dhor rail for teacher/admin Maktab use on phone, tablet and desktop. It reuses the Maktab Summary's in-memory roster when available, falls back to the existing summary read only if needed, matches by name or Unique ID, and switches directly to the selected student while preserving the currently active detail card and date. It remains hidden in Personal Journal mode and in a student's read-only Maktab view so the roster is not exposed there.
2. **Active student highlighted with a pill, not larger typography.** The existing Maktab-only student-name row on each of the three detail cards now uses the established soft-blue pill treatment (`--color-accent-soft`) with single-line ellipsis protection. Font sizing remains balanced.
3. **No-history Sabaq Dhor selector aligned as one control row.** The Juz select and 1|2|3|4 Quarter/Ru'b segmented control now both have an explicit **42px** control height. The confirmation checkbox is moved inside that same selector row and aligned to the control baseline, so Juz + structural position + confirmation read as one coordinated unit. The picker spans the available group width with `minmax(0,1fr)` shrink guards, preserving the earlier rail-width fix.
4. **Version discipline preserved.** Only served files genuinely edited in this release receive a `4.2.10` top build header: `css/detail-pages.css`, `css/journal-table.css`, `js/logDetailScreen.js`, `js/sabaqDhorPage.js`, and `js/sw.js`. `index.html` and the service-worker precache move the shared page/cache key to 4.2.10; untouched served-file headers retain their previous last-edit versions.

**Regression coverage:** new dependency-free `verify_v4210_ui.mjs` pins the shared search, teaching-only visibility, roster/cache behaviour, active-card preservation, name pill and 42px Juz/position/checkbox row. Earlier V4.2.8 and V4.2.9.x harnesses were made release-forward where their assertions described a contract that remains valid after this release.

**Verification in this build container:** V4.2.10 UI **11/11**, cumulative V4.2.8 UI **17/17**, V4.2.9.1 **6/6**, V4.2.9.2 **11/11**, build/version **6/6**, served-script syntax **36/36**. `run-all.mjs` reports **300 passed, 0 failed** among harnesses able to report; 27 older harnesses do not report because this checkout lacks `jsdom` and/or their legacy fixtures.

---

## V4.2.9.2 — Mobile Student Management registration card (2026-09-02)

**Files touched:** `css/admin.css`, `js/adminPage.js`, `index.html`, `js/sw.js`, `tests/verify_v4292_ui.mjs` (new), `tests/verify_v4291_ui.mjs`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY — no worker, schema or migration change.**

1. **Mobile registration is now a real card.** Below 768px, tapping **+ Register a user** renders a purpose-built **Register a student** card above the user list rather than trying to force the desktop registration `<tr>` through the mobile table/card CSS. This removes the malformed blue/table-cell block seen in Safari. Desktop/tablet keep the established inline table registration row.
2. **Requested mobile fields.** The card has **Name** and **WhatsApp number** inputs, then **Role / Group / Status** controls, followed by a dedicated green **Register** button. Status defaults Active; unchecking it applies inactive immediately after account creation. Existing duplicate-match Continue / Reset-PIN safeguards remain available within the card.
3. **New account stays immediately actionable.** The existing `adminJustCreatedId` pin-to-top behaviour is retained. On mobile any active search text is also cleared after successful registration so the just-created card cannot be filtered out before the admin uses **Copy** or **Share**. The pin remains until leaving Student Management or creating another account.
4. **Version discipline preserved.** Only served files actually edited here receive a `4.2.9.2` top build header: `css/admin.css`, `js/adminPage.js`, and `js/sw.js`. The page/cache `?v=` key and service-worker cache/precache key advance together to 4.2.9.2; untouched served-file headers stay at their previous last-edit version.

**Regression coverage:** new dependency-free `verify_v4292_ui.mjs` pins the mobile-only card, its fields/status behaviour, desktop-row preservation, pin-to-top/search clearing and V4.2.9.2 release keys. The V4.2.9.1 harness was made release-forward so it continues checking its cascade guarantees after later page/cache keys.

**Verification in this build container:** V4.2.9.2 UI **11/11**, V4.2.9.1 UI **6/6**, V4.2.9 UI **11/11**, build/version **6/6**, served-script syntax **36/36**. `run-all.mjs` reports **289 passed, 0 failed** from harnesses able to run here; 27 older harnesses do not report because this checkout lacks `jsdom` and/or their legacy SQL fixtures.

---

## V4.2.9.1 — Student Management mobile cascade correction (2026-09-02)

**Files touched:** `css/admin.css`, `index.html`, `js/sw.js`, `tests/verify_v4291_ui.mjs` (new), `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY — no worker, schema or migration change.**

1. **The first V4.2.9 remains the original release.** This follow-up gets its own patch number rather than reusing V4.2.9.
2. **Mobile table header stays hidden.** The first V4.2.9 used `.admin-table-head { display:none; }`, but the later generic `.admin-table { display:block; }` rule could win because both selectors had equal specificity. The hide rule is now `.admin-table.admin-table-head`, so the desktop header strip cannot reappear on phone width.
3. **Student card rows stay a grid.** The first V4.2.9 card rule `.admin-row-fields { display:grid; }` could lose to the more-specific generic `.admin-table tr { display:block; }` mobile rule. The field row now uses `.admin-table tr.admin-row-fields { display:grid; }`, preserving the intended Name / ID+WhatsApp / Role+Group+Status / actions structure.
4. **Version discipline preserved.** Only served files actually edited by this correction receive a `4.2.9.1` top build header: `css/admin.css` and `js/sw.js`. `index.html` advances the page/cache query key to 4.2.9.1 and the service-worker cache/precache key moves with it. Untouched served source headers remain at their own last-edit versions.

**Regression coverage:** new dependency-free `verify_v4291_ui.mjs` pins both specificity fixes, the existing four-row card grid, and the V4.2.9.1 page/cache keys.

**Verification in this build container:** V4.2.9.1 UI **6/6**, build/version **6/6**, served-script syntax **36/36**, original V4.2.9 UI **11/11**. `run-all.mjs` reports **278 passed, 0 failed** from harnesses that can run here; 27 older harnesses do not report because this checkout lacks `jsdom`/legacy fixtures.

---

## V4.2.9 — Student Management mobile card refinement (2026-09-02)

**Files touched:** `index.html`, `css/admin.css`, `js/auth.js`, `js/sw.js`, `tests/verify_v429_ui.mjs` (new), `tests/verify_v3850_batch.mjs`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY — no worker, schema or migration change.**

1. **Global page rename.** The management destination is now **Student Management** everywhere the page is named: its page heading and the shared admin-only nav/home-tile label. The account role named **Admin** is unchanged.
2. **Attendance-style heading on mobile only.** The established desktop/tablet Admin header structure is retained. Below 768px its icon/title/close row receives the same white-card, flex-aligned treatment used by Maktab Attendance.
3. **Mobile search + table chrome.** The search placeholder is simply **Search**. Below 768px the desktop header table stays hidden and the old `.admin-wrap` white bordered/scrolled underlay is removed visually, leaving independent student cards directly on the page surface. Desktop/tablet keep the existing table.
4. **Four-row mobile student cards.** Row 1 is the editable student **name as the card heading**, with no `Name` caption. Row 2 is **Unique ID | WhatsApp**. Row 3 is **Role | Group | Status**. Row 4 is the actions strip: **Reset PIN** in the app success green, then **Delete / Copy / Share** icons. Existing inline autosave, reset, delete, copy and native-share behaviours are unchanged.
5. **Version discipline retained.** Only served files genuinely edited in this release receive a `4.2.9` top build header (`css/admin.css`, `js/auth.js`, `js/sw.js`). The page/cache `?v=` key and service-worker cache/precache key move together to 4.2.9 as required. Untouched served source headers stay at their own last-edit versions.

---

## V4.2.8.2 — Maktab Summary return-paint + mobile attendance placement (2026-09-02)

**Files touched:** `css/journal-table.css`, `js/maktabSummary.js`, `index.html`, `js/sw.js`, `tests/verify_v428_ui.mjs`, `tests/verify_build_stamp.mjs`, `CONVENTIONS.md`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY — no worker, schema or migration change.**

1. **No broken return-to-Maktab paint.** Item 66's instant-name skeleton painted `iconHtml('attendance')` directly into the attendance cell, while the finished row wrapped that SVG in `.maktab-haidh-check`. The wrapper is what supplies the 16×16 SVG sizing. On Safari the unwrapped interim SVG could therefore expand across the card until the fresh summary response replaced the skeleton. The instant paint now uses the same sizing wrapper (non-interactive), so the cached names can still appear immediately without ever showing the giant-icon state.
2. **Attendance is beside the name pill on mobile.** The mobile card's first line is now a real two-column grid: `name pill | attendance`. The attendance cell is no longer absolutely positioned over a reserved corner of the name cell. Sabaq, Sabaq Dhor and Dhor each span both grid columns beneath it. The uniform-width/ellipsis name-pill treatment remains unchanged.
3. **Navigation preserved.** Student name still opens the student's individual summary; attendance opens that student's attendance page; Sabaq / Sabaq Dhor / Dhor cells still open their matching detail card for the selected date. The instant skeleton remains deliberately non-interactive until fresh data is present.
4. **Versioning rule corrected.** The page/service-worker `?v=` cache key still moves together for a served release, but a source file's top `Hifzhelper build ...` header now records the last release that actually edited that file. Untouched assets are no longer mass-edited just to change their header. The build-stamp harness and `CONVENTIONS.md` now enforce/document those separate meanings. For this release only the edited served files (`css/journal-table.css`, `js/maktabSummary.js`, `js/sw.js`) receive a 4.2.8.2 build header.

**Regression coverage:** cumulative `verify_v428_ui.mjs` now pins the mobile two-column top line, log-row full-span, wrapped instant attendance icon and all four distinct navigation targets. `verify_build_stamp.mjs` continues to require one page/cache release key and matching service-worker precache while allowing older last-edit headers on untouched files.

**Verification in this build container:** 17/17 V4.2.8.x UI pins, 6/6 build/version pins, 36/36 served-script syntax checks and the same 202/202 dependency-free existing checks = **261 passed, 0 failed** from harnesses able to run here. The repository's broader jsdom/fixture-dependent harnesses still cannot complete in this container because `jsdom` is not installed (with several older SQL fixture harnesses also lacking their expected schema setup); they are reported as unavailable/broken by `run-all.mjs`, not counted as passing.

---

## V4.2.8.1 — Mobile Maktab Summary width correction (2026-09-02)

**Files actually changed from V4.2.8:** `css/journal-table.css`, `tests/verify_v428_ui.mjs`, `TODO.md`, `CHANGELOG.md`, `TESTING.md`. This follow-up was initially packaged under the V4.2.8 name; the user corrected the release identity to **V4.2.8.1**. **FRONTEND ONLY.**

The mobile card was still constrained to the desktop table's 21% Student / 24% log-column widths because those `td:nth-child(...)` selectors were more specific than the first mobile `td { width:100% }` reset. Mobile now resets the nth-child widths at matching specificity, allowing the name and log cells to consume the usable card width. Larger-screen equal-width name pills were not changed.

---

## V4.2.8 — Maktab summary mobile repair + Sabaq Dhor picker redesign (2026-09-02)

**Files touched:** served build headers across `css/*.css`, `js/*.js`, `shared/*.js`; functional changes in `css/journal-table.css`, `css/detail-pages.css`, `js/maktabSummary.js`, `js/sabaqDhorPage.js`; `index.html`, `js/sw.js`; tests (`tests/verify_v3850_batch.mjs`, `tests/verify_v428_ui.mjs` NEW); docs (`TODO.md`, `CHANGELOG.md`, `TESTING.md`). **FRONTEND ONLY — no worker, schema or migration change.**

1. **Item 68 — mobile Maktab Summary values stop collapsing.** The three log lines are now a real `96px + 1fr` grid instead of the V4.2.2 flex line that let the value fall to min-content width. `Juz 28 H1`, `Juz 4 Q2`, short verse ranges and similar values now use the full right-hand column and wrap only when genuinely necessary. The value and its `+N` badge are wrapped as one grid item so the badge cannot auto-flow onto a stray second row.
2. **Same-width student-name pills (user refinement during the build).** Every Maktab Summary name pill fills the same Student-column width. Long names are trialled with single-line ellipsis instead of stretching the pill; the full name remains in the DOM and `title`.
3. **Item 72 — Sabaq Dhor empty-state picker takes the Dhor format.** The old quarter `<select>` and **Use** button are gone. Juz remains a select; the portion is now the shared `switch-track` **1 | 2 | 3 | 4** control, with the mushaf-appropriate Quarter/Ru'b word retained as the field label. A right-hand checkbox in the shared Sabaq-Dhor grid selects that structural quarter directly into the existing composite save range. Stored fields and backend shape do not change.
4. **The picker remains rail-safe.** The V4.2.8 structure no longer spans all three Sabaq-Dhor grid columns, and the picker/select/switch all carry `min-width:0`; this preserves the already-completed item-67 behaviour while replacing the control itself.

**Regression coverage:** new dependency-free `verify_v428_ui.mjs` pins the mobile full-width cell reset, mobile grid, same-width ellipsis pills, `+N` wrapper, no-Use/no-quarter-select rule, 1|2|3|4 switch, right-hand checkbox, composite structural-quarter path and min-width guards. The older cumulative V4.2.x pins in `verify_v3850_batch.mjs` were realigned to the shipped design.

**Verification in the build container:** 14/14 V4.2.8 UI pins, 6/6 build/version pins, 36/36 served-script syntax checks, plus 202/202 dependency-free existing checks across attendance, derived attendance, maktab, migration, pool, routing, setup-sheet and haidh-prediction harnesses. The recorded 1200/0 full-suite baseline could not be re-run here because this checkout does not provide the `jsdom` test dependency and the container has no network access to install it; that is an environment limitation, not counted as a test failure. Device checks are listed in `TESTING.md`.

**Versioning (historical V4.2.8 behaviour):** this release moved all asset `?v=` tags, `CACHE_NAME`, the service-worker precache list and every css/js/shared build header together to **4.2.8**. The build-header part of that practice is superseded by the V4.2.8.2 rule above: future untouched source files keep their own last-edit header.

---

## V4.2.7 — Harness repair + item 72 recorded (2026-09-02)

**Files touched:** `tests/verify_timer.js`, `TODO.md`, `CHANGELOG.md`. **DOCS AND TESTS ONLY — nothing the browser serves changed, so there is NO `?v=`/`CACHE_NAME` bump and no deploy step beyond uploading these three files. Build headers everywhere stay 4.2.6, correctly: the header names the build each served file last changed in.**

**Context.** GitHub `main` was found carrying current code but stale docs and tests (4 docs + 19 test files behind); the V4.2.6 cumulative zip restores them. This entry covers the two items the cumulative could not fix.

**verify_timer.js scenario G3 dropped.** G3 read a stale root-level `auth.js` and asserted it was "deliberately left untouched as Journal". That stale duplicate has since been deleted from the repo — the right call under process rule 3 — so the read threw ENOENT and the throw took the harness's other 29 checks down with it (the suite reported 1172 rather than 1201, with `verify_timer.js` BROKEN). G1 and G2 (the real `js/auth.js` label checks) stay. A comment at the site records why G3 went.

**Item 72 written into TODO.md.** The Sabaq Dhor picker taking the Dhor card's format was stated on 2026-09-02 but survived only in the handoff brief — the workspace TODO carrying it was lost with that session. Now recorded in the queue with the user's words plus the readings open to veto, and cross-linked to item 67 (same element; 67's fix may be mooted if 72 lands first).

**Verification: 1200 passed, 0 failed across 37 harnesses, no BROKEN line.** One fewer than the handoff's 1201 by construction: that count included G3 passing in a workspace where the stale file still existed. 1200/0 is the new baseline.

---

## V4.2.6 — FIX: screens stacked on one page (2026-09-02)

**Files touched:** `index.html` (one line), `tests/verify_dom_structure.mjs` (NEW — the 37th harness), every asset's build header, `js/sw.js`, docs. **FRONTEND ONLY. Deploy promptly — V4.2.4 and V4.2.5 both carry the fault.**

**The regression, mine.** From V4.2.4 the app stacked screens: open Admin, then the Calendar, and Admin stayed on the page below it. Seven screens behaved this way — reflections, attendancePage, juzTracker, sih, admin, placeholder, settings.

**Cause.** Removing the V4.2.3 picker markup, my slice searched for a twelve-space `</div>` — which matched INSIDE the fourteen-space line, leaving the picker's own closing tag behind. That extra `</div>` closed `#appContent` early, so those seven `<section>`s ended up in `<body>`. `showScreen` hides `#appContent > .screen`, so nothing outside that set is ever hidden again once shown. Proven by bisect: V4.2.0–V4.2.3 have 16 of 16 screens direct; V4.2.4 and V4.2.5 have 9.

**The real failure was the test suite.** 36 harnesses and 1194 checks, and not one asserted the document's STRUCTURE — they all read index.html as text, so an unbalanced tag was invisible. Every markup removal done by string-slicing carried this risk with nothing watching. The new 37th harness asserts: every `.screen` is a direct child of `#appContent` (the invariant showScreen depends on), the document survives a parse round trip without silent re-nesting, every screen has an id, and no two share one. **It was verified by re-injecting the exact regression — it fires and names all seven orphaned screens.**

**Verification: 1201 passed, 0 failed across 37 harnesses.**

**A second fault, found and fixed during this build — worth recording because it was nearly shipped.** The V4.2.5 build-header script used the pattern `[^|]+` to strip a previous header. In Python a negated character class MATCHES NEWLINES, so it swallowed everything up to the last `*/` in the file: ten CSS files were gutted (base.css went from 257 lines to 2, settings.css from 541 to 3). It surfaced only because three unrelated pins failed and I read the file rather than trusting the count. All ten were restored from the V4.2.5 artefact and re-stamped with a line-anchored pattern (`[^|\n]*?`), plus an assertion that refuses to write if stripping a header removes more than 80 characters. Every file now differs from V4.2.5 by exactly its header line — verified file by file.

---

## V4.2.5 — Build stamps, a version safety net, and the admin-mobile duplicates removed (2026-09-02)

**Files touched:** every `css/*.css`, `js/*.js` and `shared/*.js` (a one-line header each), `index.html`, `js/sw.js`, `tests/verify_build_stamp.mjs` (NEW — the 36th harness), docs. **FRONTEND ONLY.**

1. **My duplicates, removed.** `css/admin.css`'s mobile block held the V4.2.2 CARD rules and then the OLD V4.1.0 stacked rules — `.admin-row-fields td::before` appeared twice, and the later copy won. That is what re-imposed the eight-deep stacking on the user's phone. **Correction to the record: I blamed a stale deployment for this; the fault was in the file I wrote.** The trailing duplicates are gone; only the actions-row rules the card genuinely needs remain.
2. **Every file now carries a build header** — `/* Hifzhelper build 4.2.5 | css/admin.css */` — the user's request. "Which build is actually deployed?" is now answered by opening the file rather than inferring from behaviour.
3. **The release step is no longer fragile.** It used to rewrite only the PREVIOUS version string, so a tag that ever drifted would be skipped silently and that file would never refresh again. Every `?v=` is now rewritten wholesale regardless of its current value.
4. **The service worker's precache is real again.** Its list had carried `?v=3.67.0` for months — URLs nothing requests — so it cached files nobody asked for and offline support was quietly broken. All 48 entries now carry the current version.
5. **The 36th harness enforces all of it:** every linked asset is versioned; every tag names the same version; `CACHE_NAME` matches; every css/js file starts with a header naming that version and its own path; and the precache list is not stale. Silent drift is now a failed test before release rather than a phone screenshot weeks later.

**Verification: 1194 passed, 0 failed across 36 harnesses.**

---

## V4.2.4 — The juz picker becomes the rows block's empty state (2026-09-02)

**Files touched:** `js/sabaqDhorPage.js`, `index.html`, `css/detail-pages.css`, `js/sw.js`, tests (+2 pins, 2 realigned, 2 stubs), docs. **FRONTEND ONLY.**

Two things at once — the user's design choice, and the defect V4.2.3 shipped with it.

**The defect, named:** V4.2.3 put the picker inside `.sabaq-dhor-sections-row`, which is a FLEX row (rollup stepper · sections list). A third flex child takes its own share of the width, so the suggestion pills were crushed into ovals and the picker sat beside them instead of below. Nothing to do with its styling — placement. The harness pin that should have caught it asserted only that the picker came after the sections list in SOURCE ORDER, which says nothing about flex placement; it is replaced by one asserting the picker is not in that markup at all.

**The design (the user chose it from three options):** rather than a second control competing for attention, the picker now IS the rows block's empty state. The suggestion rows are DERIVED from the student's position — verified: `computeSabaqDhorRows` returns `[]` for a student with no history, and still `[]` one quarter in — so a student who has memorised but never logged is offered nothing. The picker fills exactly the space that missing information would have occupied: present when it is needed, absent when it is not, reading "No history yet — choose the portion she is revising."

Everything else is unchanged from V4.2.3: it fills the From/To fields through the card's own setter (stored shape, save path and downstream readers untouched), converts with the app's own `structuralQuarterBounds`, and takes its unit word from her mushaf (Quarter / Ru'b).

**Verification: 1188 passed, 0 failed across 35 harnesses.**

---

## V4.2.3 — Sabaq Dhor: a juz + quarter picker (2026-09-01)

**Files touched:** `index.html`, `js/sabaqDhorPage.js`, `css/detail-pages.css`, `js/sw.js`, tests (+6 checks incl. a live dataset context), docs. **FRONTEND ONLY.**

**Why it exists** (the user's reason, which settled the design): the card's suggestion rows are derived from the student's own history, so a student who **has memorised but has no journal history yet** is offered nothing to pick. The picker lets the teacher choose the portion directly.

- It sits **below** the From/To ayah section and is **additive** — both ways of entering a range remain.
- It **fills** the From/To fields through the card's own setter, so the stored shape (from/to surah+ayah), the save path, the merge logic and every downstream reader are untouched.
- The conversion is the app's own proven helper — `structuralQuarterBounds`, the same one the suggestion rows use — rather than a second copy of the boundary maths.
- **The unit's word follows her mushaf**: Quarter for IndoPak, Ru'b for 15-line Madani (migration 0017's terminology), so the picker reads in her language rather than a hardcoded "Quarter". Easy to get wrong, and it would have read falsely for half the students.

**Verification: 1186 passed, 0 failed across 35 harnesses.** The numbers are asserted, not assumed: the harness now runs the shared dataset in a live context and checks that juz 1 quarter 1 starts at 1:1 in both prints while their ends differ correctly (2:46 vs 2:43), and that juz 30 quarter 4 ends at 114:6.

---

## V4.2.2 — The mobile pass, and the mark-register sheet (2026-09-01)

**Files touched:** `index.html`, `js/maktabAttendancePage.js`, `js/maktabSummary.js`, `js/haidhDetailScreen.js`, `css/detail-pages.css`, `css/journal-table.css`, `css/admin.css`, `js/sw.js`, tests (+6 pins, 2 realigned), docs. **FRONTEND ONLY.** From four production screenshots.

1. **MARK REGISTER sheet** (user, improving Claude's one-student-at-a-time idea): an icon on a day opens a sheet of the active students, so several are marked in one sitting. It ADAPTS to the day, because absence means different things either side of today — **today/future** offers Haidh · Absent · Clear (an explicit mark is the only way anything is recorded there, since V4.0.2 made today unresolved); **past** offers Haidh · Clear and shows each student's DERIVED state, because marking "absent" on a past day would add nothing — the derivation already infers it from "no log". Writes go through the existing teacher paths; the V3.98/V4.0.2 rulings stand, haidh excuses and an informed absence never does.
2. **Maktab summary: one compact CARD per student on mobile** — name pill and attendance icon on the first line, then Sabaq / Sabaq Dhor / Dhor as captioned lines. Done entirely in CSS over the existing rows, deliberately: that table carries FIVE distinct tap targets (name → her summary page, each log cell → its own card, the row → the day view, the +N pill → the entry peek, the icon → her attendance), and a rewrite would have quietly collapsed them.
3. **The summary sheds its grey panel** (user), scoped to that screen. The app-wide V3.44 rule — screens are surface-track, their content white cards — is untouched; changing it globally is a much larger decision than the one asked for. Its padding goes too, handing the table the width it was short of.
4. **Attendance week: one day per screen on mobile**, swiped by CSS scroll-snap — native, no gesture library — with the ‹ › buttons still paging the week. Desktop keeps its columns.
5. **Student attendance page:** "Attendance" moved ABOVE the card as the page title, so the card carries only her name, at a smaller size, on one line without wrapping (it read "Attendance — Amina Aslam" over two lines).
6. **Admin on mobile: a four-row card** — id (small grey) / Name · WhatsApp / Role · Group · Status / actions — with a small caption above every input (user). The compression comes from grouping fields ACROSS a row, not from dropping their labels; the old treatment stacked one label and one field per line, eight deep.

**Verification: 1180 passed, 0 failed across 35 harnesses.** Layout cannot be proven in jsdom, so these pins encode the rules; the phone remains the test.

---

## V4.2.1 — Admin: register as the first row, columns that fit, teaching-profile column retired (2026-09-01)

**Files touched:** `js/adminPage.js`, `index.html`, `css/admin.css`, `js/sw.js`, tests (register-row drive +7; 6 realigned; 4 retired with the feature), docs. **FRONTEND ONLY.**

1. **Columns that fit.** Header and body are now two tables sharing ONE `<colgroup>` — identical column widths, so they align exactly (the V4.2.0 flex header over a fixed table never reliably did: "TEACHER PROF" sat over the wrong cells). Name takes the leftover width; every other column has an honest fixed width, so nothing truncates and delete is always visible. Action buttons hug their content. Below ~1100px the pair scrolls sideways together rather than crushing.
2. **"Register a user"** (renamed from "Register a student") sits ABOVE the table and opens the new user as its **FIRST ROW** — Name · WhatsApp · Role (Student / Teacher / Admin, all three kept per the user) · Group — with a Register button. The duplicate-name guard survives the move intact: its hint and Cancel / Continue / Reset-that-PIN appear beneath the row, and Continue re-submits whatever the row CURRENTLY holds with force:true (the V3.4.2 semantics). Register creates a student, so the row's role and group are applied as follow-ups. The separate register box is gone.
3. **After registering, the new user is PINNED to the top row and highlighted** (user), so her role, group, copy and share are right there. Cleared on leaving the screen or registering another.
4. **The Teacher-profile column is RETIRED** (user, tested: the Role select already promotes a student to teacher or admin directly, so the second-…TEACHER-account path was redundant for this maktab). The trade was stated and accepted: promotion is a role change on one account. Existing …TEACHER accounts remain ordinary rows. The worker endpoint stays, unused — removing an API is a separate decision.
5. **The old per-user detail card (`openUserCard`) is removed** — the tidy-up V4.1.0 promised, now forced: it was the last surface still offering teaching-profile creation. 156 lines gone; four drives that exercised it retired with it, replaced by assertions that no creation control exists anywhere.

**Verification: 1174 passed, 0 failed across 35 harnesses** — the new drive proves the register row opens first, the guard fires on a duplicate, Continue forces past it with the current values, the role follow-up runs, and the new user lands pinned at the top.

---

## V4.2.0 — The admin table takes the summary's shape; name pills (2026-09-01)

**Files touched:** `index.html`, `js/adminPage.js`, `js/maktabSummary.js`, `css/admin.css`, `css/journal-table.css`, `js/sw.js`, tests (+2 pins, 5 realigned), docs. **FRONTEND ONLY.**

1. **The admin card is gone.** The table now has the maktab summary's shape — a coloured header row above a white rows region — both moving as ONE width (the journal-table lesson: a width on only one of them splits the table in half visually). The screen drops `.screen-content`, and with it the shared 30% desktop cap; the width now comes from **not opting in** rather than from an override a future change could silently defeat. Capped and centred at **80%** for the eight columns (the summary uses 70% for four), with the region scrolling sideways on narrower desktops instead of crushing cells. Five structural pins were realigned: admin has deliberately LEFT the card-pattern set, which base.css anticipated in as many words.
2. **Student names are light-blue pills** on the maktab summary — they were already buttons (tapping one opens her day) but gave no sign of it. The pill wraps the NAME only; the cell also carries the attendance icon.

**Verification: 1168 passed, 0 failed across 35 harnesses.**

---

## V4.1.1 — The maktab is the teacher's home (2026-09-01)

**Files touched:** `js/app.js`, `js/logDetailScreen.js`, `index.html` (?v), `js/sw.js`, tests (+2 pins, 2 realigned). **FRONTEND ONLY.**

Closing a screen dropped a teacher on the generic Home page — an unnecessary step in daily use. LANDING was already right (bootApp has sent teaching profiles to the maktab summary since V3.74.0); only the close paths disagreed. `homeScreenFor()` is now the single answer to "where does this user belong" — the maktab summary for a teaching profile, Home for a student — and both close paths read it: the generic wiring behind every `.screen-close-btn`, and the day card's own close, which is wired separately. bootApp now reads the same helper, so landing and closing can never drift apart again.

**Deliberately unchanged:** the menu's HOME button still goes Home. A button labelled Home going elsewhere was a bug once (V3.71.0, fixed in V3.74.1), and a teacher may still want her personal journal. Students see no change at all.

**Verification: 1168 passed, 0 failed across 35 harnesses.**

---

## V4.1.0 — Admin: one screen, inline editing (2026-09-01)

**Files touched:** `js/adminPage.js`, `index.html`, `css/admin.css`, `js/sw.js`, tests (+6 pins, 2 realigned), docs. **FRONTEND ONLY — no new backend:** every operation already had an API (list, register, update, change role, create teaching profile, reset PIN, delete).

The register box + list + per-user detail card become ONE editable table, per the user's mock.

- **Columns:** Unique ID (read-only) · Name · WhatsApp · Role · **Group** · **Teacher profile** · Status · actions (copy, share, Reset PIN, delete). Group and teaching-profile creation were absent from the mock but are existing functionality, so they became columns rather than being lost.
- **Per-field autosave** on existing rows (the user's call — the mock's Save column existed only because the old screens had both register and save). Each field commits on change, with one status line for the page; a failed save restores the stored value rather than leaving a lie on screen.
- **The create path keeps its explicit commit**, because a create needs its fields together and must run the duplicate-name guard. "+ Add new student" reveals the register row; it closes itself once the student exists.
- **Nothing was dropped:** copy, share, reset PIN, delete-with-confirm, the role-change confirm, the mark-inactive confirm, teaching-profile creation with its own confirm, and the V3.78.0 retired-group semantics (a retired group she is already in stays selectable, so a save cannot silently move her).
- **Mobile:** two rows per user — fields above, every icon and button below — tethered with no divider between them so the pair reads as one record; desktop keeps the single wide row.
- **Colour:** the app's own palette rather than the mock's pink — sage on the id column, mauve across the header, the pairing the journal and summary tables already use, so the admin table reads as their sibling.

**Note for a follow-up:** `openUserCard` (the old detail modal) is now unreachable from the UI — the table does everything it did. It is left in place because harnesses still drive it; removing it is a tidy-up, not a fix.

**Verification: 1166 passed, 0 failed across 35 harnesses.**

---

## V4.0.2 — Today is not an absence; the +N pill works on the student summary (2026-09-01)

**Files touched:** `worker/src/maktabAttendance.js`, `js/maktabDay.js`, `tests/verify_attendance_derived.mjs` (+7 drives), `tests/verify_v3850_batch.mjs` (+2 pins), `index.html` (?v), `js/sw.js`, docs. **Deploy: WORKER → FRONTEND. No migration.**

1. **ABSENCE WAS PREMATURE ON TODAY** (user). `deriveStudentAttendance` walked every maktab day and fell through to `absent` with no today-guard — so the moment anyone else's logs pushed today over the maktab-day threshold, every student who had not logged YET was scored absent. Because that one function feeds the journal cell, the **attendance percentage and absent-day list**, and the inactivity flag, a student's percentage genuinely **dipped through the day and recovered when she logged**: the statistics were wrong, not merely the wording. Per the user's rule, absence now derives only for days STRICTLY BEFORE today; today is **unresolved** and takes a status only from a teacher's explicit `absent` mark (a status the table already carried). Both callers now pass today and the explicit marks. This also brings the derivation into agreement with the V3.98.0 Attendance screen, which already drew the past/today line.
2. **The +N pill was inert on the student summary.** The cells rendered the badge but only the ROW was wired, so tapping the pill just opened the day. Fixed with the pattern the maktab summary already uses: retarget the badge, give it its own listener, stop propagation — the pill peeks at that cell's entries while the rest of the row still opens the day.

**Verification: 1158 passed, 0 failed across 35 harnesses** — the drives cover yesterday-still-absent, today-unresolved, a log on today, a teacher's mark on today, haidh precedence, the percentage consequence, and the pure function's unchanged behaviour when today isn't passed.

---

## V4.0.1 — The sabaq unit follows the amount; page counts follow the mushaf (2026-09-01)

**Files touched:** `shared/data.js`, `js/sabaqPage.js`, `tests/verify_v3991_linecalc.mjs` (+8 checks), `index.html` (?v), `js/sw.js`, docs. **FRONTEND ONLY.**

The user's report: sabaq should display in pages. Two faults behind it.

1. **The pill could never hold Pages.** `sabaqSyncUnitPill` showed pages only when the lines box was EMPTY — but the auto-calc fills both boxes, so it snapped back to Lines on every recompute. Replaced by the user's rule, which removes the question entirely: **more than one page's worth of lines → show PAGES; otherwise → LINES**, with pages meaning TEXT QUANTITY (lines ÷ linesPerPage, in quarter-page units) rather than the physical pages a span touches. The pill stays switchable by hand; the rule only decides what is shown first.
2. **The page derivation hardcoded ÷ 13** — so every 15-line maktab has had its page counts computed against the wrong divisor since the feature shipped, overstating them by about 15%. `linesPerPageForMushaf()` now supplies 13 or 15 from the maktab's own mushaf, and the same value sets the unit threshold, so the rule moves with the print. (This maktab is 13-line, so its own figures were never affected.)

The user's case, 3:187–200 on a 13-line mushaf: 36 lines → **2.75 pages**, and the unit flips to pages by the rule.

**Verification: 1151 passed, 0 failed across 35 harnesses** — the drive now covers both mushafs, the "more than" boundary at exactly one page, and the empty-box fallback.

---

## V4.0.0 — The student Attendance page reworked (2026-08-31)

**Files touched:** `index.html`, `js/haidhDetailScreen.js`, `css/detail-pages.css`, `js/sw.js`, tests (+5 pins, 2 realigned), docs. **FRONTEND ONLY.** First release since production launch; the per-student page now matches the chrome the rest of the app gained across V3.98–V3.99.

1. **The shared header card** (icon, title, close X) and the same `.screen-cap` width both cards now respect.
2. **The date row comes first** and reads **From [pill] to [pill] [✓]**, all three held on ONE line — phones included: the pills flex and shrink rather than wrap, and the native picker chevron is hidden so the date text keeps its room. The term's dates are the pills' own values; the "Calculate for another period" label is gone, as the user asked.
3. **Card 1 order:** date row, then "Attendance" with "Present on Y of Z maktab days : N%", then **Days absent on its own line**. End of card.
4. **The haidh selection is a full-width band** across the calendar — "N days selected" at the left, a bare X at the right — replacing the pill-plus-Cancel pair; and **the actions sit centred beneath the calendar** on their own line.
5. **"Mark absent"** joins Confirm/Predict as haidh, writing the V3.98.0 informed-absence marker for each selected day through the calendar's existing context client. Deliberately scoped: **maktab context only** (it records that a student informed the maktab — a teacher's observation, and the PJ-side setter was removed back in V3.40.2) and **future ranges only**. The V3.98.0 ruling stands untouched: an informed absence never excuses and never enters the percentage.

**Verification: 1143 passed, 0 failed across 35 harnesses.**

---

## V3.99.1 — BUG: Lines/Pages never calculated (2026-08-31)

**Files touched:** `js/sabaqPage.js` (3 lines), `tests/verify_v3991_linecalc.mjs` (NEW — the 35th harness), `index.html` (?v), `js/sw.js`, docs. **FRONTEND ONLY.**

The user's report: the Lines box stays empty. Root cause: `recomputeSabaqLineCount` read `profile && profile.mushaf`, but `profile` is declared `let profile = null` INSIDE the render function — a local. The reference threw ReferenceError on every call, the handler died before the assignment, and Lines/Pages silently never filled — **for every user, PJ and maktab alike, on every path** (to-ayah change, stepper, confirm tick). The calculator underneath was always sound: 3:183–186 returns 13 lines (waterval), 12 (indopak/uthmani). Fixed by hoisting the mushaf the render already fetches into module scope (`sabaqMushaf`), rather than paying for a second async profile lookup.

**The test gap, named:** 1132 checks were green while this was broken, because the suites pinned markup and wiring and nothing ever RAN the handler. The new harness drives the shipped function itself — lifted verbatim from the module — asserting the box fills for a same-surah range, a cross-surah range, and that the incomplete-range guard still holds. Writing it met the V3.85.1 eval-scope trap again (a `let` inside an indirect eval is private to that eval); the same-eval setter fix is applied and commented so the next person doesn't relearn it.

**Verification: 1138 passed, 0 failed across 35 harnesses.**

---

## V3.99.0 — Consistent screen chrome: header cards, one width cap, "Kaaba puzzle" (2026-08-31)

**Files touched:** `index.html`, `js/app.js`, `js/auth.js`, `js/juzTrackerScreen.js`, `css/detail-pages.css`, `js/sw.js`, tests (+3 pins, 1 realigned), docs. **FRONTEND ONLY.**

1. **Header cards** — Attendance and Maktab Calendar both carried a bare floating `<h2>`; they now wear the Kaaba puzzle's header card (icon, title, close X). The X needed no wiring: app.js binds every `.screen-close-btn` by class. Calendar's icon is the new V3.98.1 calendar glyph, Attendance's the check-calendar.
2. **Air under the header** on both maktab screens (user), so the card no longer sits flush against the content beneath it.
3. **One shared width cap** (`.screen-cap`, 1100px, centred) across Attendance, Calendar and the Kaaba puzzle — none of the three runs edge-to-edge on a desktop display any more, and the three now agree with each other by construction.
4. **"Kaaba puzzle" for the maktab** (user): a teaching profile sees that name in the menu AND as the screen heading; a student keeps "Juz Tracker", which is exactly what it is for her — her own hifz. Driven by role through one helper, the same pattern V3.98.0 used for the Attendance nav item.

**Verification: 1132 passed, 0 failed across 34 harnesses.**

---

## V3.98.1 — A distinct Calendar icon (2026-08-31)

**Files touched:** `js/icons.js`, `js/auth.js`, `index.html` (?v), `js/sw.js`, +1 pin. **FRONTEND ONLY.** V3.98.0 left three menu items — the student's Attendance, the maktab Attendance, and Calendar — sharing one calendar-with-a-check glyph. Calendar now carries the user's own lucide calendar-days icon (normalised to the registry's convention: viewBox only, stroke-width 1.8), leaving the check-calendar to mean attendance alone. **1128 passed, 0 failed across 34 harnesses.**

---

## V3.98.0 — The maktab ATTENDANCE screen (2026-08-31)

**Files touched:** `worker/migrations/0029_teaching_days_and_predicted_absent.sql` (NEW), `worker/src/maktabAttendance.js`, `worker/src/maktabSettings.js`, `worker/src/utils.js`, `worker/src/index.js`, `js/maktabAttendancePage.js` (NEW), `js/maktabSettings.js`, `js/auth.js`, `js/app.js`, `js/api.js`, `index.html`, `css/detail-pages.css`, `js/sw.js`, tests (+4 pins, a full week drive, six fixtures gain the new column), docs. **Deploy: MIGRATION 0029 (console) → WORKER → FRONTEND.**

A week at a time, ‹ › paging, four weeks of planning ahead and the register behind.

- **Columns come from a new TEACHING DAYS setting** (weekday chips on the General card, seeded Mon–Thu). This was the user's choice among three strategies, and it resolves a real conflict: a "maktab day" is DERIVED from logging activity, so no future date can ever be one — a configured weekday set is the only honest source for forward columns. The derived rule that governs the attendance PERCENTAGES is deliberately untouched.
- **No column is ever silently dropped** (user: "so that the user doesn't skip days as they scroll"). A holiday shows under its own calendar name, a date outside every term shows "Term break", and a past teaching day the maktab plainly didn't hold shows "No maktab day" — the V3.85 threshold rule stands there, so such a day is never turned into a wall of false absences.
- **Content follows the calendar, not the column:** before today, three lists — Present / Absent / Haa'idha, the same derived truth the per-student page computes. Today onward, predicted haa'idha and predicted absentees: today is a planning column, not a half-written register (user).
- **Predicted absentee** (new): the teacher can mark a student expected-absent when she has informed the maktab. Migration 0029 rebuilds `attendance` to admit `predicted-absent` (SQLite can't alter a CHECK in place — the 0007 pattern). Per the user's ruling, **informing is courtesy, not excusal**: the marker is forward-looking only, never enters the derivation or the stats, and once its day passes the derivation governs as always. Only haidh excuses.
- **The teacher's add-popup writes through the path that already existed** — `/attendance` with a student id, teacher-gated since V3.76.0 — so a teacher-entered haidh behaves exactly like a self-entered one, including in her own journal.
- **Nav:** the label "Attendance" is unchanged for everyone; the destination follows the role — students land on their own page as before, teacher/admin on this screen. The per-student view keeps its existing door, the icon beside her name.

**Verification: 1127 passed, 0 failed across 34 harnesses** — including a date-relative week drive proving the three-list register, the labelled holiday/term-break/no-maktab columns, the planning columns, and the student 403.

---

## V3.97.1 — The seam closed: the API base picks itself (2026-08-30)

**Files touched:** `js/api.js`, `index.html` (?v), `js/sw.js`, +1 pin. **FRONTEND ONLY.** The hardcoded production API URL was the last thread tying every frontend copy to production. The base is now an auto-select: a frontend served from any "-dev" hostname (or localhost) talks to the DEV worker; everything else talks to production; `localStorage 'hh_api_base'` overrides both for ad-hoc work. One identical codebase now serves both streams, and a dev page can never quietly write into real maktab data. **1114 passed, 0 failed across 34 harnesses.**

---

## V3.97.0 — (l) THE ARCHIVE: her journal survives losing the maktab (2026-08-30)

**Files touched:** `worker/migrations/0028_archive_columns.sql` (NEW), `worker/src/logHelpers.js`, tests (three fixtures gain the 0028 shape; full lifecycle drive), docs. **Deploy: MIGRATION 0028 (console) → WORKER. No frontend change at all** — archived copies present through the merged read exactly like live maktab rows (teacher provenance, id nulled, read-only by construction), so every UI surface works unchanged.

The last piece of the 2026-08-16 architecture, built to its recorded spec: *"hifz is a solo journey with the maktab helping during certain periods; even when one loses connection the journey continues, so the journal can always be used."*

- **The copy:** maktab entries older than 60 days are physically copied into her own log tables (`maktab_log_id` + `maktab_teacher` snapshot, migration 0028), triggered opportunistically on her own journal read — bounded (500/pass), idempotent by construction (unique index + OR IGNORE + the NOT-IN key), no cron. The maktab tables are never moved or emptied.
- **Exactness:** the live union now excludes any maktab row whose copy exists — every entry shows exactly once, whenever archiving runs, with no cutoff arithmetic and no window where a row doubles or vanishes.
- **Re-sync, not frozen (the user's call):** a teacher's edit patches the archived copy (one statement keyed on maktab_log_id); a teacher's **delete removes it** — the path the spec itself warned "is the one that gets forgotten" is built and driven: her journal never asserts what the maktab no longer says.
- **Driven end to end** in the merge harness: old row copied with provenance, recent row untouched, exactness across the union, idempotence over repeat reads, edit-sync, delete-sync, maktab tables intact, personal rows untouched by the machinery.

**Verification: 1113 passed, 0 failed across 34 harnesses.** With this, every delivery of the (i)–(l) architecture is shipped.

---

## V3.96.1 — The position switch, by its own contract (2026-08-30)

**Files touched:** `css/detail-pages.css`, `js/sw.js`, `index.html` (?v), 2 pins realigned. **FRONTEND ONLY.** Fourth attempt, first one made after actually reading the component: renderSwitch computes the thumb as PERCENTAGES of the track assuming N equal slots. Both forced-size debris rules (34px and 44px heights, 84px width) are deleted; the position options become equal flex slots so the percentage maths hold for 2-way and 4-way alike on one 140px track at the component's own height; and the row bottom-aligns — the verified cause of every failed alignment nudge was centring the bare switch against the LABELLED From column, parking it in the label gap. The earlier thumb-height claim is corrected in the record (the thumb self-derives; it was never the fault). **1105 passed, 0 failed across 34 harnesses.**

---

## V3.96.0 — The Haidh settings tweaks, off the books (2026-08-30)

**Files touched:** `index.html`, `js/settingsScreen.js`, `css/settings.css`, `js/sw.js`, tests (+2 pins), docs. **FRONTEND ONLY.** The three-part spec from 2026-08-08/17, built as one set: the Haaidha heading reads text-first with the opt-in checkbox to its RIGHT at twice the size (32px); the "Ruling" label above the Hanafi/Shafi'i switch is gone; the ruling hint sentence is gone from the screen — deleted TOGETHER with its constant and both JS writer lines, exactly as the recorded V3.51.2 trap demanded, so the cycle/period/next-expected population after the old writer runs untouched. The ruling itself remains fully alive: chosen, re-rendered, loaded, saved, and enforcing the 10/15-day cap in validation — all five keep-sites pinned. **1105 passed, 0 failed across 34 harnesses.**

---

## V3.95.0 — The follow-up set: Hijri under the name, the bordered Calendar, the space-and-alignment pass (2026-08-30)

**Files touched:** `js/maktabSettings.js`, `index.html`, `css/settings.css`, `css/detail-pages.css`, `js/sw.js`, tests (+3 pins, 1 realigned), docs. **FRONTEND ONLY.**

1. **The italic Hijri sits directly UNDER THE NAME BOX** (it was hanging beneath the date column) — the name and its Hijri now share a column in the popup rows.
2. **The Calendar card wears a border** (the user's pink outline, stated as the spec: "I don't have a border around calendar").
3. **The Space pass:** more air above the Teacher-note block and above the history row on all three cards; a margin above Dhor's Duration row.
4. **The dashed-line alignment:** the 1|2 position switch stands at the full row height beside the From select; the Duration, Mistakes and Tajweed boxes share one height (the tajweed trigger now fills its column, ellipsized).
5. **The history pair SPREADS** — one button to each end on every card (the boxed mock superseded the earlier flex-end reading) — and "Notes History" is capitalised.

**Verification: 1103 passed, 0 failed across 34 harnesses.**

---

## V3.94.0 — Deletions stick, Hijri properly, the dead card revived, three polish sets (2026-08-30)

**Files touched:** `worker/src/maktabCalendar.js`, `js/maktabSettings.js`, `js/maktabSetup.js`, `js/tajweed.js`, `css/settings.css`, `css/detail-pages.css`, `index.html` (?v), `js/sw.js`, tests (double-render net + enrichment drive + 4 pin blocks; 4 realigned), docs. **Deploy: WORKER → FRONTEND. No migration.**

1. **Calendar deletions STICK (design fix, admitted fault):** the standard list now proposes itself only into an EMPTY year — once any rows exist, the popup stages exactly what's saved, so a deleted day stays deleted ("deleted" vs "never had" was previously indistinguishable, which is why First Fast kept returning). Deleting everything and reopening = the deliberate full reset. Same rule for holidays.
2. **Hijri, honestly this time:** Confirm now upgrades any islamic label that matches a seed base name and lacks a Hijri part to the full "Name — Hijri" (the earlier "Confirm regenerates labels" claim was wrong and is corrected in the record). In the popup, the NAME input holds the base name and the **Hijri renders in italics on its own line beneath**; storage is unchanged (reassembled on confirm).
3. **The dead Calendar card, revived:** the run-once wire guard met a card whose HTML rebuilds every visit — second entries got an empty year pill and dead buttons. The guard is gone; the card wires every render, and the harness now renders the settings screen TWICE and asserts survival (the net that would have caught it).
4. **Calendar card polish:** "Calendar" is a real header, the Terms label is gone, the + is bigger, the content sits a notch lower.
5. **Ajzaa popup polish:** an "Ajzaa completed" title, the X in the LEFT corner, pills ~20% smaller with centred text.
6. **V3.93 follow-ups:** the suggestion-row pill now lands on the element that actually carries the border (.sabaq-dhor-row-text — the earlier radius sat on the wrapper); the inline 1|2 switch gets real dimensions (84×34) beside the juz select; the Duration/Mistakes/Tajweed labels share one line; the tag placeholder reads "Select tags"; the history pair rides the right edge per the arrows.

**Verification: 1100 passed, 0 failed across 34 harnesses.**

---

## V3.93.0 — The day-card set, the setup popup, the search unclipped for real (2026-08-30)

**Files touched:** `index.html`, `js/dhorPage.js`, `js/sabaqPage.js`, `js/maktabSetup.js`, `css/detail-pages.css`, `css/settings.css`, `css/journal-table.css`, `js/sw.js`, tests (+8 pins, 1 realigned), docs. **FRONTEND ONLY.**

1. **The search, third and final round:** V3.91 unclipped the header ROW; the header CELL's own `overflow:hidden` (label ellipsis) was still swallowing the dropdown a level lower — including the "No matching student." empty state, which is why typing gave no feedback at all. The search cell alone is now `overflow: visible`. Honest test note: jsdom can't see pixels, so both clippers passed green suites — the pins encode the rules; the user's eyes remain the layout test.
2. **The Calendar card content centres** (heading+year, terms, add, the two buttons).
3. **The day-card set** (the annotated mock): space before a BOXED timer on all three cards; ONE **Lines/Pages** box with the unit pill inside (both inputs keep their ids — the auto-calc still fills both; the pill is a view switch) and **Tajweed beside it**, the old row gone; the Sabaq Dhor suggestion rows as pills; the dhor **position switch inline with the juz select**; **"Ajzaa Completed"** replacing "Add Juz to Dhor"; **Duration/Mistakes/Tajweed on one row** with a single MINUTES box (stored as whole minutes ×60 — schema unchanged; the ss input and its helpers removed cleanly); history buttons matched (150px min, centred) for symmetry.
4. **The Ajzaa Completed popup:** paragraph gone; **save ICON top-right**; the juz list a **3×10 grid of selectable chips** (filled evergreen when selected; dashed border marks partial juz; the hidden checkboxes keep the save path identical).

**Verification: 1094 passed, 0 failed across 34 harnesses.**

---

## V3.92.1 — Year pill fixed + button row (2026-08-29)

**Files touched:** `css/settings.css`, `js/maktabSettings.js`, `js/sw.js`, `index.html` (?v), 1 pin. **FRONTEND ONLY — first delivery shipped WITH A DELTA ZIP** (4 files) alongside the cumulative. The V3.92.0 year pill collapsed to bare arrows on iOS (a borderless select has no intrinsic width there) — now appearance:none, min-width 104px, centred text, baseline-aligned with the "Calendar" heading. The two green buttons sit SIDE BY SIDE — Public Holidays left, Islamic Calendar right — and taller. **1086 passed, 0 failed across 34 harnesses.**

---

## V3.92.0 — Legend out, Hijri in; the year pill; chevron-free date pills (2026-08-29)

**Files touched:** `index.html`, `js/maktabCalendarPage.js`, `js/maktabSettings.js`, `css/settings.css`, `js/sw.js`, tests (+3 pins, list drive extended), docs. **FRONTEND ONLY.**

- **The calendar legend is GONE** (user) — the table below the grid is the naming surface. **Islamic rows there show the HIJRI DATE**, not the day name (the label's Hijri part; a manually added day with no Hijri recorded falls back to its own name). Holidays read "Public holiday" (or their edited text). The Hijri also shows in Maktab Settings' Islamic Calendar popup, carried by the V3.89 labels — saved pre-Hijri rows gain it on the one-press Confirm regeneration.
- **The year select is a blue pill beside the "Calendar" heading** instead of the far corner.
- **The date pills lost the native picker chevron** that overlapped their text (user's photo); the whole pill opens the picker — with an explicit showPicker() nudge for engines that don't open on field-click.

**Verification: 1086 passed, 0 failed across 34 harnesses** (the page drive now proves the Hijri-not-name list rendering and the manual-entry fallback).

---

## V3.91.0 — Verdicts and fixes: lavender marker, the search unclipped, the calendar header, blue pills (2026-08-29)

**Files touched:** `index.html`, `js/logDetailScreen.js`, `css/journal-table.css`, `css/detail-pages.css`, `js/sw.js`, tests (2 realigned, +5 pins), docs. **FRONTEND ONLY.**

1. **The merge-marker VERDICT** (the first of the standing three settled): Option A was "a little too subtle" — personal entries in the merged journal now carry a LAVENDER FILL (`--palette-lavender`) with no left border. The staged Option B/C blocks retired with the verdict.
2. **The header-cell search, visible at last.** The logic always worked; `overflow: hidden` on the header row (there for the rounded corners) was CLIPPING the results dropdown — and the magnifier — into nothing. The corners now round on the first/last cells, nothing clips, the dropdown stacks above the table (z-index 60), and the magnifier rides the LEFT of "Student" as asked.
3. **The Maktab Calendar header corrected:** the title shows in full at the card's width; the ‹ › buttons are compact and "August 2026" sits unwrapped and centred between them (they'd inherited a full-width button rule).
4. **The blue pills + the scribble set:** the selector family — sabaq from/to fields, the sabaq-dhor rows, the dhor juz selects — wears the palette's light blue (`--color-accent-soft`); the term-name label is gone from the day-card date rows (markers elsewhere untouched); the group heading reads just "Sabaq Dhor"; Add-Juz/Plan rides the far right of its row.

**Verification: 1084 passed, 0 failed across 34 harnesses.**

---

## V3.90.1 — The date row, properly this time; matching dhor selects (2026-08-29)

**Files touched:** `css/detail-pages.css`, `js/sw.js`, `index.html` (?v), 2 pins. **FRONTEND ONLY.** The V3.90.0 margin was real but the row's FIXED 44px height let a taller-rendering pill (desktop) spill past the row edge and over it — the honest root cause of "still touching". The row now grows with its content (min-height keeps the mobile geometry; the pill keeps its own 44px). And the dhor To select joins From under the one shared height rule it never had. **1079 passed, 0 failed across 34 harnesses.**

---

## V3.90.0 — The queued polish batch (2026-08-29)

**Files touched:** `index.html`, `css/detail-pages.css`, `css/settings.css`, `css/journal-table.css`, `js/sw.js`, tests (+7 pins, 1 realigned), docs. **FRONTEND ONLY.** Six queued items, one delivery:

1. **Terms neatened** — quiet borderless name inputs (edge on focus only), the from/to dates as grey pills, more air between term rows.
2. **Maktab summary header** — the date pill and X align to the table's 70% width on wide screens instead of floating at the screen corners.
3. **Student summary page** — the attendance icon sits directly after the name ("Umme's attendance"); X keeps the far corner.
4. **Day-card rhythm** — real margin under the date row on every card (the pill was touching/overlapping the blocks below on Sabaq and Dhor alike); the calendar-info label (e.g. "Term 2") rides its own line above the pill; air above the note blocks; air between the notes and the History/Notes-history buttons.
5. **Pill-selector trial** — `.verse-ref-field` takes a 999px radius; ONE shared class, so it cascades over every from/to selector on all cards, PJ and maktab alike (the user's confirmed intent; one rule to revert if the look doesn't land).
6. **Dhor From/To labels** above the two juz selector boxes (the sabaq cards' pattern; the To label hides with its range field).

**Verification: 1078 passed, 0 failed across 34 harnesses.**

---

## V3.89.1 — HOTFIX: Chrome desktop sliver cards (2026-08-29)

**Files touched:** `css/detail-pages.css` (one rule), +1 pin. **FRONTEND ONLY.** The user's Chrome-vs-Safari screenshots: on the desktop grid every rail card had `max-width: 30%` (a V3.45-era page-cap applied per card). A grid item resolves that percentage against its own COLUMN, so Chrome capped each card at ~30% of a third of the screen — the sliver cards — while Safari resolved it more generously and looked right. The card now fills its column (`max-width: none; width: 100%`); the 3-column grid itself is the cap. Applies to the day rail and settings rail alike; Safari's rendering was the intended one and is now what both engines produce. **1072 passed, 0 failed across 34 harnesses.**

---

## V3.89.0 — Popup rework + settings polish (2026-08-29)

**Files touched:** `worker/src/maktabCalendar.js`, `js/maktabSettings.js`, `index.html`, `css/settings.css`, `css/detail-pages.css`, `js/sw.js`, tests (three harnesses realigned; +4 pins), docs. **Deploy: WORKER → FRONTEND. No migration.**

**The popup rework (TODO 24b):**
- **The render bug fixed:** components.css gives every `.modal-card input` width:100%, which stacked the stage rows so only the date showed (the user's screenshot — no name field, no ×). Scoped overrides restore the row: date fixed, text flexes, × always visible — and pinned.
- **Islamic rows carry the day description AND the Hijri date** — the seed labels are now e.g. "First Taraweeh — 1 Ramadaan 1447", every entry transcribed with its Hijri date from the Jamiatul Ulama tables. Proposal dedupe keys on the BASE description (`calBaseName`), so entries saved under the older short labels are still recognised and never re-proposed or duplicated.
- **Delete works visibly on every row, both popups.**
- **Public holidays reverse the date-only call:** every row carries editable text prefilled "Public Holiday"; Confirm stores it (blank → "Public Holiday"); the worker no longer forces NULL.

**The settings polish (TODO 24c):** the MAJOR/MINOR pills are smaller (9px, tighter padding); the explanatory parentheticals are OFF the Terms and Groups headings (Tajweed's stays — not named); air between the add-row and RETIRE on both list cards; and **Groups folded INTO the General card** — the rail is back to THREE (General / Tajweed / Calendar), three dots, and the V3.88.0 four-column desktop override dies with the fourth card (the V3.45.8 lesson applied again: column count follows card count).

**Verification: 1071 passed, 0 failed across 34 harnesses.** Note for existing data: previously saved islamic entries keep their short labels; opening the Islamic Calendar popup and pressing Confirm regenerates the year with the Hijri-bearing labels, with the base-name dedupe guaranteeing no doubles either way.

---

## V3.88.2 — HOTFIX: term/calendar edits blocked by CORS (2026-08-29)

**Files touched:** `worker/src/index.js` (one line), `tests/verify_v3870_calendar.mjs` (+3 transport-net checks). **WORKER-ONLY DEPLOY — no frontend upload, no migration.**

The user's report: changing a term date → "network error", everything else fine. Root cause: the V3.87.0 term/calendar editors are the app's FIRST PUT requests, and the worker's CORS preflight response allowed only `GET,POST,PATCH,DELETE,OPTIONS` — the browser blocked every PUT before it left the device. `PUT` added to Allow-Methods. Honest note: the first diagnosis (a doubled-backslash route regex) was WRONG — the route was fine; the investigation's own test-net was buggy and initially "confirmed" it. Both lessons are now pinned: (1) every method js/api.js uses must appear in the worker's Allow-Methods (this would have caught the bug at build time); (2) the :id dispatch regexes, extracted verbatim from index.js, must match their real URLs. **1068 passed, 0 failed across 34 harnesses.**

---

## V3.88.1 — Term rows: name above the dates (2026-08-29)

**Files touched:** `js/maktabSettings.js`, `css/settings.css`, `js/sw.js`, `index.html` (?v), +1 pin. **FRONTEND ONLY.** Per the user's screenshot (the name input squeezed to a sliver beside two date pickers): each term renders on TWO lines — the name full-width above, then "from to to" with the delete X. **1065 passed, 0 failed across 34 harnesses.**

---

## V3.88.0 — The staged calendar, the attendance layout, and the format batch (2026-08-29)

**Files touched:** `worker/migrations/0027_calendar_dedupe.sql` (NEW), `worker/src/maktabCalendar.js`, `worker/src/index.js`, `js/maktabSettings.js`, `js/haidhDetailScreen.js`, `js/customDate.js`, `js/dhorPage.js`, `js/maktabCalendarPage.js`, `js/api.js`, `index.html`, `css/detail-pages.css`, `css/settings.css`, `js/sw.js`, tests (v3870 rewritten for the staged world; v3800/v3850 realigned; the migration fixtures run 0027), docs. **Deploy order: MIGRATION 0027 (console) → WORKER → FRONTEND.** Built as one delivery per the batching instruction.

1. **The duplicate bug, fixed in three layers** (the user's screenshot: doubled holidays). Migration 0027 deletes existing duplicates (oldest kept) and adds a UNIQUE expression index — `(type, date_from, date_to, COALESCE(label,''))` — so the database itself refuses repeats; the write path regenerates instead of appending; Confirm disables while in flight. The V3.87.0 root cause (a check-then-insert race with no constraint behind it) is recorded.
2. **Propose → edit → confirm replaces the blind loaders** (user's workflow). Two green buttons on the Calendar card — **Islamic Calendar** and **Public Holidays** — each opening a history-mechanism popup with the picked year's staged list: saved rows merged with the proposal (SA statutory set for holidays "atm"; the Jamiatul Ulama seed for significant days), editable/deletable/addable in place, **nothing saved until Confirm**, which makes the confirmed list BE that type+year. Holiday rows are DATE ONLY — no label input, no ghost text. The adjusted-prediction hole is closed by construction: islamic proposals dedupe by label within the year, so a sighted-and-adjusted day is never re-proposed; type-scoped regeneration means confirming holidays never touches the islamic set. The inline entries list, inline loaders, and the per-row add (with its save icon) are gone.
3. **Settings shape per the corrected schematic:** the Calendar stays the FOURTH RAIL CARD (year picker at the top beside the heading, then Terms, then the two buttons); the **Current term row is gone from General** (terms live in maktab_terms alone, and Save no longer sends term fields); on large screens the settings rail shows all **four cards side by side at 25%** (scoped to #msetRail — the day rail keeps its three).
4. **The attendance page to the user's layout:** card 1 is headed "Attendance this Term" (or "Attendance" off-term), the stats read as ONE sentence — "Present on X of Y maktab days : Z%" — with Absent Days beneath, then "Calculate for another period" over From [date] to [date] [✓]. The haidh card heading carries the name ("Haidh: Umme"), the explanation sits under the header ("Confirm, cancel or predict haidh. / Select a single day or a range."), the old "Tap a start day…" hint is REMOVED, the calendar spans 90% of the card, the range/decision bars span the full width, and the Confirm-as-haidh pill keeps its size but sits on its OWN line, centred (the circled clipping).
5. **dd-mmm-yy everywhere the app writes dates as prose** (user): one shared formatter (`fmtDMY`, e.g. 24-Sep-26) applied to the attendance period line, both attendance popups, notes-history dates, and the calendar page's lists. Date INPUTS follow the device's region (native pickers); the journal's two-line weekday cells keep their designed layout (recorded assumption).

**Verification: 1064 passed, 0 failed across 34 harnesses.** The rewritten calendar harness drives 0027's dedupe and unique index, the full staged flow (fresh proposal → edited confirm → adjusted-day never re-proposed → type-scoped regeneration → validation → student read-but-never-confirm), and the popup pins; the attendance harness drives the one-sentence layout over both period modes.

---

## V3.87.0 — The Maktab Calendar (2026-08-28)

**Files touched:** `worker/migrations/0026_maktab_calendar.sql` (NEW), `worker/src/maktabCalendar.js` (NEW), `worker/src/index.js`, `worker/src/maktabAttendance.js`, `js/maktabCalendarPage.js` (NEW), `js/api.js`, `js/auth.js`, `js/app.js`, `js/maktabSettings.js`, `js/journal.js`, `js/maktabDay.js`, `js/haidhDetailScreen.js`, `js/logDetailScreen.js`, `index.html`, `css/detail-pages.css`, `css/settings.css`, `js/sw.js`, tests (verify_v3870_calendar NEW, 39 checks; realignments across six harnesses), docs. **Deploy order: MIGRATION 0026 (console) → WORKER → FRONTEND.**

The full user spec of 2026-08-28, verbatim from TODO item 16:

- **TERMS drive attendance.** `maktab_terms` holds MULTIPLE named terms (one line each: name, start, end) managed on the new Maktab Settings **Calendar card** — an ADD TERM button while none exist, a small + thereafter, instant-commit edits. The migration carries the old General pair in as "Term 1". The attendance default period is now **the term containing today** (a finished term is rightly ignored — new behaviour, pinned); the rest of the chain (custom → term → last 28 days) is unchanged. The old settings columns stay but are no longer read.
- **The calendar itself is INFORMATION ONLY** — its own page (`screen-maktabCalendar`, in everyone's nav), a Monday-first month grid with term tint + islamic/holiday dots, a legend, and the month's entries listed beneath. The page is view-only for everyone; students get exactly what teachers see. All management lives in settings.
- **Islamic significant days pre-load from the Jamiatul Ulama (KZN) 2025–2030 Most Likely tables** (the user's PDF, transcribed into `ISLAMIC_PREDICTIONS`, 42 entries) via the settings "Add predictions" button — idempotent, marked `source: 'prediction'`, and **adjustable after actual moon sightings** (date edits commit instantly).
- **South African public holidays, dates only** (label NULL): the ten fixed days + Good Friday/Family Day from the Easter computus, with the statutory **Sunday → following-Monday** rule. Generated per year by the "SA holidays" button; idempotent; individually editable/deletable. (2026 lands 13 dates — Aug 9 is a Sunday; 2027 lands 14.)
- **"Info is displayed wherever dates appear":** journal + summary-page date cells carry a small dot with the label as its tooltip (via formatDateCell); the haidh/attendance calendar day cells take the classes + title; the day-view date headers name the day's info beside the date; the calendar page shows everything.

**Verification: 1058 passed, 0 failed across 34 harnesses.** The new harness drives the migration, terms CRUD + auth (students read, never write), the holiday generator (Easter 2026/2027 pinned; both Sunday-collision years counted), both loaders' idempotence, the page renderer (grid, dots, tint, list), and the marker helper; the attendance-default change is driven in the attendance harness, including the past-term case.

---

## V3.86.0 — The six-comment batch (2026-08-28)

**Files touched:** `index.html`, `js/haidhDetailScreen.js`, `js/maktabSettings.js`, `css/detail-pages.css`, `css/settings.css`, `js/sw.js`, tests (verify_v3800 realigned to the popup world; +8 pins in verify_v3850_batch), docs. **FRONTEND ONLY.** Built as one delivery per the user's batching instruction.

1. **Apply → a small check.** The attendance custom range's full-width Apply is a compact ✓ button sitting right after the two dates (same id — wiring untouched). "back to default" unchanged.
2. **Absent days + Haidh history as small green buttons.** Both in the History button's style; each opens a read-only POPUP (the shared modal pattern): the absent dates, and the last 3 haidh periods. The inline absent toggle-list and the inline ranges block below the calendar are GONE (the recorded assumption, applied); the haidh button hides when there are no confirmed runs.
3. **History buttons are NOT pills** (user's screenshot): the capsule came from height:100% + zero vertical padding inside the bottom row; standard padding + the app's small radius now — every `.history-btn` inherits, including the two new attendance buttons.
4. **Tajweed/Groups add-rows flipped**: the input takes the width, Add is a save ICON (46px, the mset icon pattern; ids kept so the V3.79.0 instant-commit wiring is untouched).
5. **SAVE on its own row** at the top of the General card, right-aligned with its Saved status; the Maktab Name row starts below it.
6. **Wider General inputs**: the label column shrank 38%→28% (42%→32% on phones); Name, Time Zone and the term dates stretch accordingly.

**Verification: 1017 passed, 0 failed across 33 harnesses** (the attendance-page harness now drives both popups; 8 new pins cover every item).

---

## V3.85.2 — Attendance cards capped at 50% (2026-08-28)

**Files touched:** `css/detail-pages.css`, `js/sw.js`, `index.html` (?v), one pin. **FRONTEND ONLY.** The two attendance cards sit at 50% width, centered, from the app's standard 768px breakpoint (the user's named figure). **1008 passed, 0 failed across 33 harnesses.**

---

## V3.85.1 — Summary-page header neatened (2026-08-28)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/sw.js`, `tests/verify_v3820_student_summary.mjs` (+2 pins), docs. **FRONTEND ONLY.**

Per the user's screenshot feedback on V3.85.0: the page header is now ONE single-row grid — icon · name · attendance · close — sharing the journal table's own 70% centering at its 768px breakpoint (the user's suggestion, adopted exactly), so nothing floats to the screen corners or wraps onto a second line. The attendance icon is 30px ("far too small" at 22).

**Verification: 1007 passed, 0 failed across 33 harnesses.** One latent HARNESS bug surfaced by wall-clock luck while shipping this (Karachi crossed midnight at 19:00Z): the appTodayISO drive's two-eval pattern meant its maktab-zone branch was never really exercised — a `let` at the top level of an indirect eval scopes to that eval, so the second eval's assignment never reached the closure. Fixed with a same-eval setter; production code was always correct (the file loads as one classic script in the browser).

---

## V3.85.0 — The batch of four: summary page, settings schematic, attendance card, notes history (2026-08-28)

**Files touched:** `index.html`, `js/app.js`, `js/maktabDay.js`, `js/logDetailScreen.js`, `js/maktabSummary.js`, `js/maktabSettings.js`, `js/haidhDetailScreen.js`, `js/dhorPage.js`, `js/api.js`, `css/settings.css`, `css/detail-pages.css`, `worker/src/maktabAttendance.js` (one additive field), `js/sw.js`, tests (verify_v3850_batch new; verify_v3820 rewritten for the page world; verify_v3790's tz drive rewritten; three pins realigned), docs. **Deploy order: WORKER FIRST (one additive response field), then frontend.** No migration.

**1. The student summary is a STANDALONE PAGE** (the user's V3.82 revision; "the maktab only sees maktab data"). The fourth rail card and its dot are GONE — the day rail is back to three (the dots hidden-card guard stays; it is correct in general). The name tap on the maktab summary opens `screen-studentSummary`: the PJ Journal PAGE's layout — 10 expanded recent days, the PJ's own rolling-7-day rollup rows, Load more widening the fetch window — over the MAKTAB'S entries only (teacher passes student_id + since; her own read-only path passes neither). Rows tap through to that day's log cards; the header carries her name, an ATTENDANCE icon opening her attendance page on the picked date, and close back to the summary. Cell-level routing on the maktab summary itself is unchanged.

**2. Settings General rebuilt to the user's schematic** (screenshots, 2026-08-28): label-left / control-right rows — Maktab Name (SAVE staying top-right), **ONE Time Zone field** (shows the staged zone or "Not set"; tapping opens the chooser — device zone, type-ahead, clear — and EVERY stage action closes it and repaints the field, which removes the standing "Use this device's timezone" button the user reported lingering), the boxed Mushaf group, then narrow rows with small right-hand numeric inputs ("Minimum number of students on a maktab day"; "No. of inactive maktab days before flagging a student") and the Current term row in the same style. Staging semantics untouched: everything writes the hidden `#mset_timezone`, Save commits, the worker validates. **A real crash caught while realigning:** the rebuilt template had dropped `#mset_status`, which Save writes to — the settings-rail harness crashed exactly there; restored and pinned.

**3. Attendance on cards.** All the attendance data — % present, the count line, the period, the custom range, the absent-days history — sits on one `.att-card`; the haidh calendar + ranges form a second card (the recorded assumption). The custom range reads as the user's sentence: "Choose a custom date range from [date] to [date]". An EMPTY period is now NAMED, not a bare line: "No maktab days in this period (fewer than N students logged per day)" — the worker's response gained `maktab_day_min` for exactly this line, closing off the user's verified "0 maktab days" report class forever.

**4. Notes history + the button moves** (the user's option (c)). Each log card gains a **Notes history** button opening ONE interleaved rail across dates of entry notes + teacher feedback — read-only, newest first, feedback rows carrying the confirming teacher's name, a same-entry note + feedback sitting adjacent. **No new endpoint and no new visibility logic:** the rows come from the same `logClient(type).get()` the History rail reads, and the worker has already applied every privacy rule per viewer — whatever text appears is exactly what this viewer may see, in PJ merged mode and maktab mode alike. Layout: **both history buttons moved to the bottom of each card, below the Notes block**; on the dhor card the **Add-Juz/Plan button and History swapped** — Plan rides the date row now (same id, wiring untouched).

**Verification: 1005 passed, 0 failed across 33 harnesses** (20 in the new batch harness + 19 in the rewritten summary-page harness, which drives the page's expanded/rollup/Load-more shape, both fetch modes, the attendance icon, and the tap-throughs). The one-line-comment trap struck a THIRD time — a trailing comment on app.js's keepsMaktabCtx line broke a harness's line-slice — and is now avoided by keeping that line comment-free; recorded so the pattern finally sticks.

---

## V3.84.0 — The summary search moves into the Student header cell (2026-08-28)

**Files touched:** `index.html`, `js/maktabSummary.js`, `css/detail-pages.css`, `js/sw.js`, `tests/verify_v3840_header_search.mjs` (new), `tests/verify_v3780_delivery3.mjs` (fixture follows the new markup), docs. **FRONTEND ONLY.** Built alone at the user's request ("implement the search and i will check it") ahead of the rest of the recorded batch.

**The change (user, V3.82 feedback):** the full-width search bar above the maktab summary is gone; the green **Student** header cell IS the search. **Tap-to-reveal — Claude's settled choice, open to veto** (the user left it open): the cell shows "Student" with a small search glyph; tapping swaps in a compact input sized to the cell; Esc, a tap anywhere outside the cell, or picking a result restores the label. The results dropdown anchors under the cell and spills right of the 25% column so names stay readable. V3.78.0 semantics untouched: a way TO a student — a result opens her day view carrying the summary's picked date.

**Verification: 984 passed, 0 failed across 32 harnesses** (11 new: the old row's absence, the cell's markup and CSS anchoring, and the reveal / search / pick / Esc / outside-tap / inside-tap paths all driven). The V3.78 harness's fixture DOM realigned to the cell markup; its own pins (clear-on-pick, date-carry, no-match text) pass unchanged.

---

## V3.83.0 — (k) THE MERGE: her journal is now the whole record (2026-08-28)

**Files touched:** `worker/src/logHelpers.js`, `worker/src/sabaqLog.js`, `worker/src/sabaqDhorLog.js`, `worker/src/dhorLog.js`, `worker/src/dhorSchedule.js`, `js/journal.js`, `js/dhorPage.js`, `css/journal-table.css`, `js/sw.js`, `index.html` (?v), `tests/verify_v3830_merge.mjs` (new), `tests/verify_roles.mjs` (fixture gains the maktab log tables), docs. **NO MIGRATION** — the merge is a read-time union. **Deploy order: WORKER FIRST, then frontend.**

**What it is (one-way, maktab → PJ; the truth principle governs every detail — user, 2026-08-28):** the student's OWN read of `/sabaq`, `/sabaq-dhor` and `/dhor` now returns her PJ rows PLUS the maktab's rows for her, interleaved by date (`getMergedLogs`, logHelpers.js). Maktab rows arrive with `source:'maktab'`, provenance (`teacher_name`, already snapshotted at confirm time), and their `id` NULLED and moved to `maktab_log_id` — so any PJ write path that ever forgets to check `source` fails LOUDLY on a null id instead of silently editing whichever of her rows shared the number. Her rows carry `source:'personal'` — in her journal THEY are the marked ones (the maktab record is the unmarked spine). Privacy is the SAME `applyPrivacy` pass the maktab endpoints already run: she sees her own comments; `teachers_only`/`private` feedback stays redacted. Duplicate days (she logged it AND the maktab did) are SHOWN, never collapsed — the user's explicit call.

**What stays PURE:** a teacher's named-student read (`?student_id=`) keeps the untouched PJ-only result — that is the three-inputs channel (sabaq frontier / haidh / notes), and mixing maktab rows back into it would double-count the maktab's own record. The maktab side gains NOTHING from this merge, anywhere.

**Counting follows the merge (the recorded build interpretation — ownership limits editing, not counting):** the sabaq frontier, position advance and the juz tracker's inputs all read through the merged GETs, so they now count maktab entries automatically with zero code of their own; and PJ Dhor prepop's "continue from last" queries the UNION of `dhor_log` + `maktab_dhor_log` (dhorSchedule.js) — her next dhor continues from her last dhor wherever she recited it. The maktab prepop variant remains maktab-only.

**Her surfaces:** the Journal marks personal entries (`pj-personal`); a cell whose latest entry is the maktab's opens the entries POPUP on tap (provenance visible, personal rows still editable from there) instead of an editor for a record she doesn't own; popup maktab rows are plain provenance rows; `openEntryForEdit` refuses maktab rows outright as the last line of defence. The History rail withholds its edit pencil from maktab rows and shows the teacher line V3.75.0 already prepared ("once (k) merges… no further change here" — landed exactly so).

**The marker — three options prepared (user leans colour/tint; pick by swapping one CSS block, css/journal-table.css):** **A (LIVE)** accent edge + faint tint; **B** a small "PERSONAL" chip after the text; **C** accent-coloured text only.

**Verification: 973 passed, 0 failed across 31 harnesses** (22 new: the merged own-read row by row — order, nulled ids, provenance, privacy, the duplicate day kept double; `since` across both sides; the teacher read's purity; dhor lap-parsing on both sides; a DECISIVE prepop fixture that passes only when the union is really consulted; every frontend guard and the CSS options). `verify_roles.mjs` fixture realigned: the merged own-read touches the maktab tables, so the fixture now has them (empty).

---

## V3.82.1 — HOTFIX: app.js broken since V3.80.0 (2026-08-28)

**Files touched:** `js/app.js`, `js/sw.js`, `index.html` (?v only), `tests/verify_syntax.mjs` (new), `CHANGELOG.md`, `TESTING.md`. **FRONTEND ONLY. Upload this INSTEAD of V3.80.0/V3.81.0/V3.82.0 — all three zips carried the break.**

**The bug (reported live: `SyntaxError: Unexpected identifier 'SCREEN_LABELS'` at app.js:36):** the V3.80.0 haidhDetail→attendancePage rename placed its explanatory comment INLINE in the single-line `SCREENS_BUILT` object literal, so the `//` swallowed every entry after it — `juzTracker` through `maktabSetup` AND the closing `};`. The unclosed object made the entire file unparseable, killing the app at load. It is the same one-line-comment trap already hit once in a test fixture during the V3.80.0 build (recorded there); this time it landed in shipped code. The comment now lives on its own lines above the object.

**Why 29 green harnesses missed a file that didn't parse:** every harness string-slices regions of source or drives extracted functions — none parsed the shipped files WHOLE. New permanent gate: `tests/verify_syntax.mjs` runs `node --check` over every `js/*.js` and `shared/*.js` (34 scripts; the worker's ESM files were never exposed — miniflare parses them whole in every worker harness). It fails today's bug retroactively and any future scripted-edit breakage of this class.

**Verification: 951 passed, 0 failed across 30 harnesses** (34 new: every shipped script parsed whole, plus the walker's own sanity check).

---

## V3.82.0 — The student summary card (2026-08-28)

**Files touched:** `js/logDetailScreen.js`, `js/maktabDay.js`, `js/maktabSummary.js`, `index.html`, `css/detail-pages.css`, `js/sw.js`, `tests/verify_v3820_student_summary.mjs` (new), `TODO.md`, `SPECS.md`, `TESTING.md`. **FRONTEND ONLY — no worker change, no migration** (the three maktab GETs already take a teacher's student_id).

**A FOURTH card on the day rail — maktab mode only:** the student summary, the PJ journal LAYOUT over the MAKTAB'S entries for that student ONLY — the maktab reading its own record, INDEPENDENT of the (k) merge (the user's correction, 2026-08-28). One row per date, newest first, the shared journal cells; tapping a row opens that day's log cards, exactly as the student's own Maktab Journal does. In the PJ the card and its dot are hidden, and the dots driver now skips hidden cards — a display:none card rects to 0,0 and would otherwise always claim the active dot. The desktop grid grows to four columns only when the card shows (the V3.45.8 lesson applied forward: column count follows real card count).

**Cell-level routing on the maktab summary** (user: name → summary, "student sabaq --> sabaq etc"): tapping a student's NAME opens her summary card; tapping her Sabaq / Sabaq Dhor / Dhor cell opens that card; the whole-row tap keeps its old target (day view on Sabaq). The picked date carries through every route, and `openMaktabDay` gained an `initialCard` parameter defaulting to 'sabaq' so every existing caller is byte-for-byte unchanged. The entry-peek badge still wins over the cell (it already stops propagation first).

**Her own read-only path benefits too:** a student opening a day from her Maktab Journal now sees the summary card as the fourth card, read-only, fetched without a student_id (the student-scoped endpoints refuse a student naming ids — the card routes own vs For accordingly).

**Verification: 917 passed, 0 failed across 29 harnesses** (18 new: the markup, the four-card order, the maktab-only toggle, the dots phantom-card guard driven with fake rects, the renderer driven in both modes plus empty state, and every routing pin). No existing pins needed realignment.

---

## V3.81.0 — Dhor juz-range: one Save, one sitting, one entry per juz (2026-08-28)

**Files touched:** `js/dhorPage.js`, `index.html`, `js/sw.js`, `tests/verify_v3810_juz_range.mjs` (new), `TODO.md`, `SPECS.md`, `TESTING.md`. **FRONTEND ONLY — no worker change, no migration.** The fan-out is N standard saves through the existing endpoint, so the worker's per-save pool merge and duplicate detection apply to each juz unchanged.

**Built to the user's answers (2026-08-28).** With the unit on **Full/Juz**, a second select appears beside the Juz picker: a dash (single juz — the default, the pre-V3.81.0 behaviour exactly) or any LATER juz. Picking one and saving records the whole range as read in ONE SITTING: **one entry per juz** (each individually editable and deletable afterwards), **time and mistakes divided over the range** — evenly, remainder to the earliest entries, totals preserved exactly — and **tajweed tags duplicated onto each**. Recorded build details: the note duplicates too (each entry stands alone); lap times belong to the sitting and ride the FIRST entry only; a plan id never attaches (a plan names a single portion). The edit path and Plan-Dhor raw-range mode never fan out.

**Failure is named, not swallowed:** the fan-out is sequential, and a mid-range failure stops with "Saved Juz 11, 12. Juz 13 failed: <the worker's message>" so only the unsaved tail needs re-selecting. A duplicate refusal on any juz gets the same OK/Cancel the single save has, per juz; Cancel stops cleanly and says where.

**Verification: 899 passed, 0 failed across 28 harnesses** (22 new: the division rule pure — even, remainder-first, totals preserved, null→nulls; the to-select's lifecycle; the 4-entry fan-out with every field checked; the single save byte-for-byte unchanged; the failure and both duplicate paths driven).

---

## V3.80.0 — The attendance page (2026-08-28)

**Files touched:** `worker/migrations/0025_term_dates.sql` (new), `worker/src/maktabAttendance.js`, `worker/src/maktabSettings.js`, `worker/src/index.js`, `js/haidhDetailScreen.js`, `js/maktabSummary.js`, `js/maktabDay.js`, `js/maktabSettings.js`, `js/auth.js`, `js/app.js`, `js/api.js`, `js/icons.js`, `index.html`, `css/haidh.css`, `css/settings.css`, `js/sw.js`, `tests/verify_v3800_attendance_page.mjs` (new), five harness realignments, docs. **MAKTAB DEPLOYMENT ONLY. ⚠ RUN MIGRATION 0025 IN THE D1 CONSOLE FIRST** (two additive lines; console-safe copy shipped), **then the worker, then the frontend.**

**The original list-of-11 intent behind item 5, stated in full 2026-08-28 and built whole.**

**The summary's leading icon is ATTENDANCE now, on EVERY student** (was the haidh icon, haa'idah only). It opens her attendance page; the haidh 'today' tint stays on the icon. **The student gets the same page** from her own nav — the Haidh item became **Attendance**, for all students, with the haidh calendar living INSIDE the page (haa'idah only). The standalone haidh screen is gone; its markup and every id moved into the page untouched, so the calendar, range bar, decision bar and prediction logic run unchanged.

**The page:** % present over the period — **present = activity logged OR haidh; the denominator is MAKTAB DAYS** (the user's standing definition: "day" = maktab day; haidh stays on calendar days) — with the count spelt out; a custom from/to to recalculate over any period; a button revealing the absent dates; the calendar below; and the **last 3 CONFIRMED haidh ranges** (predictions are plans, not history — V3.76.1's rule carried through).

**The period:** custom when applied → else the **CURRENT TERM** — new on Maktab Settings' General card as a from/to date pair (migration 0025; "the easiest way to set term dates") → else the last 4 weeks ending on the maktab's own today. One worker endpoint (`GET /attendance/page`) computes the whole thing server-side — derivation runs over ALL maktab days so haidh propagation from before the period stays correct, then the period filters. Auth mirrors the calendar endpoints: a student gets her own; a teacher passes `student_id`.

**Verification: 877 passed, 0 failed across 27 harnesses** (33 new — 0025, the term save rules, the endpoint's period resolution / percent / absent / ranges / auth against real SQLite, and the page driven in jsdom through custom-apply, reset, the absent list, both haidh-block states and both endpoints). Five existing pins realigned to the deliberate rewiring, including the harness lesson worth keeping: two "absent" fixture days after a haidh run came back haidh — the propagation rule working, not a bug.

---

## V3.79.0 — Maktab Settings as a three-card rail; group descriptions; the one-tap timezone (2026-08-28)

**Files touched:** `worker/migrations/0024_group_descriptions.sql` (new), `worker/src/lists.js`, `js/maktabSettings.js` (rewritten), `index.html`, `css/settings.css`, `js/sw.js`, `tests/verify_v3790_settings_rail.mjs` (new), `tests/verify_maktab_settings_form.mjs`, `tests/verify_v3780_delivery3.mjs`, `TODO.md`, `SPECS.md`, `TESTING.md`, `SCHEMA.md`. **MAKTAB DEPLOYMENT ONLY. ⚠ RUN MIGRATION 0024 IN THE D1 CONSOLE FIRST** (one additive line; a console-safe copy ships with the delivery), **then the worker, then the frontend.**

**Built to the user's schematic (2026-08-28) and the answers that followed it.**

**The screen is a THREE-CARD RAIL like the day view** — General / Tajweed / Groups as snap cards with the pill strip on top, reusing the log-detail rail classes wholesale (sizing, snapping and the desktop 3-up grid come for free; the dots driver is mirrored with the screen's own ids). Opens on General.

**Two save models, both the user's explicit calls.** GENERAL keeps the form + Save it has always had. TAJWEED and GROUPS have NO Save ("keep the existing save, remove the save from tajweed and groups"): every control commits instantly — the MAJOR/MINOR pill and the RETIRE checkbox on tap, the name and description inputs on blur or Enter. The browser rename-prompt is gone. A rejection shows against that card and the re-render restores the stored value; an emptied name restores itself without a write.

**Groups gained a DESCRIPTION** (migration 0024) — info-only, shown on the Groups card and NOWHERE else (user's call). Trimmed, ≤200 chars, empty clears to NULL.

**The timezone control is option 3** (user picked it over a grouped select and a curated list): the current setting plus a one-tap "Use this device's timezone (<zone>)", a "choose a different zone" type-ahead (input + datalist of every IANA zone) for the travelling-admin case, and a clear link. Everything STAGES into the hidden field the Save has read since V3.78.0 — General's Save commits it, and the worker's Intl validation remains the backstop. The 400-entry select is gone.

**Verification: 844 passed, 0 failed across 26 harnesses** (32 new: 0024 against real SQLite; the description save/trim/clear/length rules; the rail markup; the staging flow driven end to end including Save's payload; every instant-commit control; the rejection path). Realigned in the form harness: the settings screen left the `.screen-content` card pattern for the rail (its checks now assert the rail and the remaining three carded screens).

---

## V3.78.0 — Delivery 3: groups, tajweed tags, the maktab timezone (2026-08-27)

**Files touched:** `worker/migrations/0022_groups_tags_timezone.sql` (new), `worker/migrations/0023_clear_tajweed_words.sql` (new, run LATER), `worker/src/lists.js` (new), `worker/src/index.js`, `worker/src/maktabSettings.js`, `worker/src/maktabLog.js`, `worker/src/admin.js`, `worker/src/utils.js`, `worker/src/attendance.js`, `worker/src/profile.js`, `worker/src/sabaqLog.js`, `worker/src/sabaqDhorLog.js`, `worker/src/dhorLog.js`, `js/tajweed.js` (rewritten), `js/api.js`, `js/app.js`, `js/logContext.js`, `js/maktabDay.js`, `js/haidhDetailScreen.js`, `js/maktabSummary.js`, `js/maktabSettings.js`, `js/adminPage.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/dhorPage.js`, `index.html`, `css/settings.css`, `css/detail-pages.css`, `js/sw.js`, `tests/verify_v3780_delivery3.mjs` (new), nine fixture upgrades, `SCHEMA.md`, `TODO.md`, `SPECS.md`, `TESTING.md`.

**⚠ DEPLOYMENT ORDER: run migration 0022 in the D1 console FIRST, then deploy the worker, then the frontend.** Migration **0023 is separate and destructive** — run it only after verifying converted tags on a real entry (open an old entry that had tags; the picker should show them). Until then the old word column sits untouched as the fallback record.

**Item 7 — tajweed tags are maktab-stored rows now.** `tajweed_tags` table, seeded with the eleven defaults; entries hold CSVs of IDs (`tajweed_tag_ids` on all six log tables), so RENAMING a tag propagates to every entry that ever used it and RETIRE replaces delete. 0022 converts existing word-tags to IDs in place (a recursive-CTE split + join per table); words matching no tag are DROPPED, and device-local custom browser tags are NOT imported — both the user's calls. The picker offers live tags plus any retired tag the open entry already has, and lost its "+ add": additions are admin work on Maktab Settings now. The vocabulary loads once at boot for every role (students' PJ cards carry the same picker).

**Item 8 — groups.** `maktab_groups` table + `students.group_id` (one group per student — a column, not a join table). Names are managed on Maktab Settings (add, rename-by-tap, retire/restore); assignment is a select on the student's Admin card (a retired group can't be newly assigned; students already in one keep pointing at it). The summary is ordered by group name, alphabetical within, UNGROUPED LAST, with a tall spacer row where the group changes — the gap alone carries the meaning, no heading rows.

**Item 9 — summary search.** A search box above the table: typing lists matching students (with their group); picking one opens her DAY VIEW carrying the summary's picked date, exactly as the row tap does. A way TO a student, not a filter — the table never changes shape.

**The timezone — everyone sees maktab time (user, 2026-08-27).** `maktab_settings.timezone` (IANA zone, the screen's fifth setting, validated by constructing a formatter; empty clears). It rides on `GET /profile`, so every client learns it at boot; `appTodayISO()` (frontend) and `maktabTodayISO(env)` (worker) resolve "today" in that zone — the summary's default day, the maktab day view, the haidh calendars, and the worker's own confirmed-vs-predicted and superseded-prediction decisions all fall on the maktab's calendar day for every user everywhere. Unset = NULL = each device's own day, exactly as before, until the admin picks a zone.

**Verification: 812 passed, 0 failed across 25 harnesses** (54 new: 0022 and 0023 run whole against real SQLite over data with every edge — unknown words, whitespace, NULL/empty; the list endpoints with their gates; the roster order `Amina,Basheera,Zaynab,Aaliyah,Umme`; group assignment rules; timezone save/validate/clear and both today helpers; the picker, the gap rows and the search driven in jsdom). Nine existing fixtures gained the 0022 columns; two assertions realigned (e1's roster-shape leakage check now names the group fields; the (j) harness's roster-query regex).

---

## V3.77.0 — (j) Account separation (2026-08-27)

**Files touched:** `worker/src/maktabLog.js`, `worker/src/maktabAttendance.js`, `worker/src/logHelpers.js`, `worker/src/admin.js`, `worker/src/index.js`, `js/api.js`, `js/app.js`, `js/auth.js`, `js/adminPage.js`, `js/icons.js`, `css/admin.css`, `css/components.css`, `index.html`, `js/sw.js`, `tests/verify_v3770_account_separation.mjs` (new), `tests/verify_e1.mjs`, `tests/verify_v3742_ui.mjs`, `SCHEMA.md`, `TODO.md`, `SPECS.md`, `TESTING.md`. **MAKTAB DEPLOYMENT ONLY. ⚠ MIXED WORKER + FRONTEND — DEPLOY THE WORKER FIRST.** **No migration.** The ADMIN-01 discard (step 5 of the plan) was run on 2026-08-17; nothing to run now.

**Built to the plan recorded on 2026-08-17, in its order.**

**1. The roster filter.** `handleMaktabSummary` and the derived-attendance roster both select `role = 'student'`. Teaching and admin rows are rows in the same table with no journal; without the filter every one of them sat in the summary as a girl to be logged against — which is exactly how ADMIN-01 had been appearing with dashes. It no longer does.

**2. Create teaching profile.** `POST /admin/create-teaching-profile { id }`, admin-only. From an active student row it inserts `<id>TEACHER`, role `teacher`, name `<name> (Teacher)`, active, **no PIN** — she sets it on first login through the create-PIN screen every student takes, so the separate PIN (user's call) costs no mechanism. Refused: a teaching or admin source, an inactive source, a second attempt (409, naming the existing id), an unknown id. Nothing in the data links the two rows; the suffix is a convention the worker never compares. On the admin screen: a role chip on teacher/admin rows (student rows stay quiet); the student's card gets **Create teaching profile** only when active and without one; a student who has one shows its id instead; a teaching row shows whose it is and never offers the action.

**3. The switcher.** Device-local, PIN always, as agreed on 2026-08-16. The device records the accounts that have signed in on it — id, name, role, never a PIN or token (a harness feeds a PIN in and proves it is dropped). **Switch account** sits in the menu between Refresh and Log out: it clears the token, sets a session flag and reloads; the login router sees the flag and shows the accounts as chips. Tapping a chip makes that id the remembered one and goes straight to its PIN screen — or to create-PIN on a teaching account's first login. A × on each chip forgets it on this device. "Use another ID" on the PIN screens now offers the chips first when the device knows any, and the switch screen's own "Use another ID" goes to the plain ID+PIN screen.

**4. `updateLog` date validation.** A malformed date used to be both stored and to silently skip the attendance sync. It is refused (400) now.

**Kept deliberately:** `handleSave`'s `student_id === auth.id` guard in `maktabLog.js` — an authorization check, defence in depth, unreachable through the UI now that teaching rows are off the roster; asserted present so a tidy-up does not remove it.

**Verification: 758 passed, 0 failed across 24 harnesses** (43 new). Two old assertions realigned: the e1 roster expectation (it had counted the teacher and admin rows as students, which was the bug) and the V3.74.2 menu-tail check.

**Testing resumes with this delivery**, per the 2026-08-17 note that paused it pending (j).

---

## V3.76.2 — The teacher's decision on a gap refusal (2026-08-27)

**Files touched:** `worker/src/attendance.js`, `worker/src/utils.js`, `worker/src/index.js`, `js/api.js`, `js/haidhDetailScreen.js`, `index.html`, `css/haidh.css`, `js/sw.js`, `tests/verify_v3762_haidh_decision.mjs` (new), `tests/verify_v3760_phase2.mjs`, `TODO.md`, `SPECS.md`, `TESTING.md`. **MAKTAB DEPLOYMENT ONLY. ⚠ MIXED WORKER + FRONTEND — DEPLOY THE WORKER FIRST.** No migration.

**What the old toggle had, and V3.76.0 dropped, comes back — as three choices instead of two, and in the page instead of a dialog.** User, 2026-08-27: "the teacher can decide whether to mark absent or not", then asked for a way back to the dates. On a gap refusal in maktab mode the confirm bar is replaced, in place, by a decision bar carrying the worker's message and three buttons: **Mark as haidh anyway** (resubmits the same range with `override_gap`), **Mark absent** (resubmits with `status: 'absent'`), **Adjust dates** (back to the confirm bar, selection kept). Tapping a day while deciding counts as adjusting. Not a browser `confirm()`: it cannot offer three, cannot be styled, and on a phone it covers the dates being decided about.

**Worker.** `mark-range` honours `override_gap` — skipping the *gap* rule only; the run cap still refuses, as the old confirm never overrode it either — and `status: 'absent'`, which writes absent rows with no rules, as the old single-day Cancel did. Both are teacher-gated exactly like `student_id`: a student sending them is ignored and her own calendar keeps the plain rules. Refusals now carry a machine-readable `code` (`haidh_gap`, `haidh_run`) via `error()`/`respond()`, and `apiFetch` attaches it to the thrown error, so the calendar branches on *which* rule refused rather than matching prose. Bodies without a code are byte-identical to before.

**The student's own calendar is unchanged**: a gap refusal there is the plain message, and the own-endpoint call never carries a flag — both asserted.

**Verification: 715 passed, 0 failed across 23 harnesses.** The worker side runs against real SQLite (teacher override honoured, student's ignored, absent rows written, run cap still refuses under override); the calendar side drives the real screen through every branch — decision bar up with selection kept, each of the three buttons, a second refusal on "haidh anyway", a non-gap refusal, and the PJ path.

---

## V3.76.1 — Haidh: a future prediction no longer vetoes a real mark (2026-08-27)

**Files touched:** `worker/src/attendance.js`, `shared/haidhRules.js`, `js/sw.js`, `index.html` (cache-buster only), `tests/verify_v3761_haidh_predictions.mjs` (new), `TODO.md`, `SPECS.md`, `TESTING.md`. **MAKTAB DEPLOYMENT ONLY. ⚠ WORKER CHANGE — DEPLOY THE WORKER; the frontend files carry only the version stamp.** No migration.

**Device report:** marking 27–31 Aug from the new maktab calendar was refused with "15 days have not passed since the last haidh", with the last real haidh more than three weeks back. **Cause:** both attendance handlers fed every `haidh` AND `predicted-haidh` row to the rule, and `evaluateHaidhRange` measures the gap to the nearest mark on *either* side. A predicted day on 5 Sep — four days *ahead* of the range — was the blocker. A plan was vetoing a fact, and the message, written with only a mark behind in mind, pointed the wrong way.

**Rule now (`haidhEvidenceDates`):** a predicted-haidh row dated after today is never evidence for the run or gap checks. A passed prediction still is — the app already treats it as real (V3.39's lazy auto-confirm). Confirmed rows always count. Unchanged in the other direction: a prediction placed too soon after a real haidh is still refused.

**And a confirmed mark supersedes the predictions it contradicts** — user's call: "delete predicted rows that fall inside the 14-day window after the newly confirmed range, since they can no longer be true." `clearSupersededPredictions` deletes `predicted-haidh` rows from the day after the run ends through run end + 14, future-dated only, never a `haidh` row. Applied by both the range write and the single-day POST; the response lists what was cleared (`clearedPredictions`). `evaluateHaidhRange` now also returns `runEnd`, which the window starts after.

**Verification: 690 passed, 0 failed across 22 harnesses.** The new harness reproduces the device case against real SQLite with every date relative to today (so it cannot time-bomb), then proves the rule still refuses in every direction it should: a prediction 3 days after a real haidh, a real range 5 days after a real haidh, a passed prediction as evidence, a confirmed future row as evidence.

---

## V3.76.0 — Phase 2: the maktab haidh calendar (2026-08-27)

**Files touched:** `worker/src/attendance.js`, `js/api.js`, `js/haidhDetailScreen.js`, `js/maktabDay.js`, `js/maktabSummary.js`, `js/app.js`, `index.html`, `js/sw.js`, `tests/verify_v3760_phase2.mjs` (new), `tests/verify_e2.mjs`, `tests/verify_e1.mjs`, `tests/verify_v3750_phase1.mjs`, `TODO.md`, `SPECS.md`, `TESTING.md`. **MAKTAB DEPLOYMENT ONLY. ⚠ MIXED WORKER + FRONTEND — DEPLOY THE WORKER FIRST.** No migration.

**The summary's haidh icon is a link to the student's haidh calendar, and haidh is marked there as a range.** The earlier note that Phase 2 was frontend-only was wrong in one respect: the worker served another student's attendance for reading, marking and clearing a *single day*, but `POST /attendance/mark-range` — the range write the student's own calendar uses — was still hard-wired to the caller. It now carries the same one-line teacher override the single-day handlers have had since V3.40.2/V3.63.0 (`isTeacherOrAbove(auth) && body.student_id`); a student sending someone else's id is ignored, never a wrong-row write. Proven against a real SQLite attendance table.

**The calendar is shared, not copied** — the same choice as the day view (V3.64.0, Option A). `js/haidhDetailScreen.js` gains one `haidhCalClient()` that routes its three attendance touches (read, clear one day, mark a range) by log context: the PJ's own endpoints when opened from the nav, the `*For` endpoints with the student's id when opened from the summary. That is the only place the mode is consulted, so no call site can forget it; a harness check counts direct calls in code and finds none outside it. The heading carries the student's name in maktab mode and reverts to "Haidh" on the next PJ visit.

**`showScreen` keeps the maktab context for the calendar.** It dropped the context for every screen but `logDetail`, which would have cleared it before the calendar rendered. The opener passes `{ maktab: true, date }`; a string date or nothing (the nav) still drops it, so a student visiting her own calendar after a read-only maktab view cannot inherit that state.

**The single-day toggle flow is deleted**, not left dangling: `maktabHaidhGapDays`, `maktabMarkHaidhFlow`, `maktabToggleHaidh` and the summary's `aria-pressed` wiring. **One behaviour change to know about:** those carried a client-side 15-day confirm ("Ok to mark as Haidh, cancel to mark absent") that let a teacher override the gap. The range write applies the worker's rules — run cap, 14-day gap, whole range rejected on failure — exactly as the student's calendar always has, and the refusal is shown verbatim in the calendar's error line. A teacher no longer gets a confirm-to-override. Chosen with the range ("as the student has it") on 2026-08-27.

**Item 6's haidh error path moved with the flow.** The two alerts fixed in V3.75.0 were in the deleted functions; the surviving path is the calendar's own `#haidhCalError`, which has always shown `e.message`. The V3.75.0 and e2 harness blocks that drove the deleted flow now assert the deletion is complete; the new harness drives the calendar's error line under maktab context.

**Two stale TODO headings corrected:** "Dhor card UI changes" and "Maktab Setup takes over the Plan button" still read NOT BUILT two and four deliveries after they shipped (V3.72.0–V3.74.2). The revised three-delivery plan, the answers given for groups and tags, and the confirmation that there is no maktab-side haidh record (a teacher's mark IS a PJ attendance row) are recorded in TODO.md.

**Verification: 668 passed, 0 failed across 21 harnesses** (640 before; 34 new, 6 retired with the flow).

---

## V3.75.0 — Phase 1 of the list of eleven: items 1, 2, 3, 4, 6, 10, 11 (2026-08-26)

**Files touched:** `css/admin.css`, `css/base.css`, `css/detail-pages.css`, `index.html`, `js/maktabSummary.js`, `js/maktabDay.js`, `js/sabaqDhorPage.js`, `js/dhorPage.js`, `js/sw.js`, `tests/verify_v3750_phase1.mjs` (new), `tests/verify_v3742_ui.mjs`, `tests/verify_maktab_settings_form.mjs`, `TODO.md`, `SPECS.md`, `TESTING.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY. No schema, no worker.**

**Three of the seven fix V3.74.x changes that never took effect.** All three lost the cascade or the event order, and all three were green in the harness because the harness asserted the rule *existed*, not that it *won*.

**Admin header (1).** `.card-header-row-left` (V3.74.2) never applied: base.css's `.screen:has(> .screen-content) .card-header-row { grid-template-columns: 1fr auto }` matches at three classes and beat it regardless of file order. That forced a two-column grid onto a three-child header, which is why the close button sat centred on a row of its own. The class is deleted; Admin now carries an id-scoped rule in `admin.css`. **Wider than Admin:** the same base rule matched every card screen with a direct `.screen-content` — and Tadabbur and Haidh both have three-child headers. Both have been broken the same way since V3.74.2, unseen because they are student screens and testing is paused. The grid line is removed from base.css (the `h2 { white-space: normal }` that actually fixed the truncation stays; Maktab Settings keeps its own 1fr/auto rule in settings.css). A new check derives the affected set from the real `index.html` and asserts it is exactly Admin, Tadabbur, Haidh.

**Move to Dhor hidden until eligible (2).** User's call, reversing V3.74.3's visible-but-disabled button with its "(2 of 4 complete)" count — "nothing on screen that can't be used". The render filters to `enabled` options; the label is "Move Juz N to Dhor"; `moveJuzToDhor` still re-checks eligibility so hiding is not the only guard. Driven test: an ineligible juz renders no button, an eligible one renders exactly one.

**The pill is 20px tall now, really (3).** V3.74.4 fixed the width (an explicit `width` where `max-width` had been a no-op) but the *height* was a second no-op nobody noticed: the base `.switch-track { height: 42px }` lives in `settings.css`, which `index.html` loads AFTER `detail-pages.css`. One class against one class, so source order won and the track stayed 42px. Selector is now `.cb-note-box .mk-vis-switch`; the harness asserts the specificity relationship and that the load order really is the trap it looks like. Same cascade lesson as CONVENTIONS (d). *20px is the height V3.74.4 intended and never delivered — adjust once seen.*

**The +1 badge opens the peek and only the peek (4).** V3.74.2 wired it by delegation on `document`, but the row's day-view handler is attached to the `<tr>` itself — so during bubbling the row fired first, opened the day view, and the `stopPropagation` at document level came too late to matter. The listener is on the badge button now; the document listener only closes. Driven test: badge tap → no `openMaktabDay`, peek open with every entry; row tap → day view.

**The worker's real error is shown (6).** `apiFetch` already threw `body.error` as `e.message`; both haidh alerts and the summary load failure replaced it with a fixed sentence — which is why the 2026-08-26 haidh failure could not be read. All three carry the message now (the summary one via `textContent`, so markup in a message renders as text). Driven with rejecting stubs.

**Teacher name in the History rail (10).** Maktab rows carry `teacher_name` (provenance); the rail shows it under the entry when present, escaped. PJ rows have no such field and are unchanged. When (k) merges maktab entries into the journal this line becomes the provenance marker with no further change.

**Spacing above the note box (11).** `margin-top: var(--space-md)` on `.cb-note-box`, the same token the PJ's `.notes-header-row` already uses, so both modes of the card sit their notes at one height.

**Harness realignment:** four V3.74.2 assertions pinned the replaced behaviour (the delegated stop, the disabled state, the dead class, the `^`-anchored pill selector) and one in `verify_maktab_settings_form.mjs` pinned the removed base.css grid line. Each now asserts the new rule and says why.

**Verification: 640 passed, 0 failed across 20 harnesses** (596 before; 44 new). **Also recorded:** the full list of eleven and the four-phase plan into `TODO.md` — the docs-only V3.74.6 meant to carry it was never built.

---

## V3.74.5 — URGENT: repairs Sabaq Dhor, broken by V3.74.3 (2026-08-26)

**Files touched:** `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `tests/verify_v3742_ui.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY. V3.74.3 and V3.74.4 are BROKEN — deploy this one.**

**The Sabaq Dhor card rendered completely empty** — no rows, no history button, no manual field. Reported from a screenshot.

**Cause: a span replacement in V3.74.3 destroyed `rebuildRowsFromPosition()`.** The edit that swapped `moveRowToDhor` for `moveJuzToDhor` sliced from the function's opening line to the next `\n}` following a `renderSabaqDhorRows` reference — and swallowed the whole of `rebuildRowsFromPosition` on the way. Nothing assigned `sabaqDhorRows` after that, so the render read an empty array and produced an empty card. Restored, with the V3.74.3 move-options line included where it always belonged.

**Every other function in the file was verified present** against the pristine copy: only `moveRowToDhor` is gone and only `moveJuzToDhor` added, as intended.

**This is the third over-reaching span replacement in this project** — the earlier two destroyed the derived-id block in `TODO.md` and `.card-header-row-left` in `detail-pages.css`. The other two were caught within minutes, one by an assertion and one by a failed anchor. This one shipped in two releases.

**It shipped because nothing tested it.** 591 assertions passed over a card that rendered nothing, because no harness drives that render path — the same failure as the Maktab Settings form, where the suite stayed green through a full rewrite of untested code. New assertions now check that `rebuildRowsFromPosition` exists, that it assigns the rows the render reads, and — stated generally — that every module-level list the render consumes is assigned somewhere rather than merely declared. That last one is the shape of this bug rather than the instance of it.

**Verification: 596 passed, 0 failed across 19 harnesses.**

---

## V3.74.4 — The visibility pill actually resizes this time (2026-08-26)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/sw.js`, `tests/verify_v3742_ui.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY.**

**Two attempts at this had no effect, and the reason is that both were no-ops.** They set `max-width` on `.mk-vis-switch`. The track is a flex container that sizes to its content — three short words — so a max-width only ever capped it and never widened it. 110 → 187 → 240 changed nothing at all. It now sets an explicit `width: 240px`, with `flex: 0 0 auto` so the note-head flex row cannot shrink it back below that.

**Height set to 20px with `line-height: 1` on the options.** The earlier 14px and 11px were below what the inherited line-height would hold, so even where the height applied the options could keep the track taller.

**Three stacked generations of the same rule, consolidated into one.** V3.73.2, V3.74.0 and V3.74.2 each APPENDED a new `.mk-vis-switch` block rather than editing the existing one, leaving three contradictory sets of numbers in the file with the last winning by source order. Now a single rule. A new assertion fails if a second ever appears.

**A rule was deleted by accident and restored.** The span replacement that removed those three blocks reached past its intended end and took `.card-header-row-left` — the admin header grid from V3.74.2 — with it. The second time in this project a span replacement has over-reached and destroyed an unrelated block. Caught immediately by the assertion covering that rule, which is precisely why it existed.

**Verification: 591 passed, 0 failed across 19 harnesses.** The new checks assert an explicit width, that `max-width` has not crept back, and that exactly one `.mk-vis-switch` rule exists.

---

## V3.74.3 — Move to Dhor rewritten: per juz, not per row (item 12) (2026-08-26)

**Files touched:** `js/position.js`, `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `tests/verify_v3742_ui.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY.**

**The Dhor option now belongs to the juz, not to a row.** It ignores roll-up entirely, so collapsing or expanding the quarters no longer makes it appear or vanish; it activates only when all four quarters are complete; and moving takes all four, after which the juz leaves Sabaq Dhor.

**What this retires.** Each half previously carried its own option, sequenced — the Second Half stayed locked until the First had actually moved (`firstHalfMoved`). That machinery existed solely to stage half-moves and is gone, along with `canMoveToDhor` on every row that carried it. `computeJuzMoveOption` and `computeSabaqDhorMoveOptions` replace it.

**The juz leaves Sabaq Dhor without a separate removal step.** The lingering-row builder already returns nothing for a juz whose units are all in the pool, so the disappearance falls out of the same condition that decides eligibility. Nothing to keep in step with the write, and nothing that can half-succeed.

**Shown disabled rather than appearing from nowhere.** Before the fourth quarter the button reads *"Move Juz N to Dhor (2 of 4 complete)"* and is inactive — it tells the teacher the option exists and what it is waiting for. A juz already in the pool offers nothing at all.

**A lingering juz is complete by definition** — that is what makes it linger, the student having moved on. So its option is live immediately, and nothing is stranded by the new rule. Worth recording because the opposite was assumed during specification and was wrong: "First Half" in that card describes the ROLL-UP, not how much of the juz is done.

**Both reads and writes stay routed** — `logProfile()` and `logSavePool()`, so this remains correct in the maktab. The confirmation names the juz and says it will leave Sabaq Dhor.

**Verification: 588 passed, 0 failed across 19 harnesses.** Three assertions from V3.74.2 asserted the per-row button and were replaced rather than worked around; twelve new ones cover the rewrite, including that no row carries an option and the sequential unlock is gone.

---

## V3.74.2 — UI batch, items 1-11 (2026-08-26)

**Files touched:** `js/auth.js`, `js/maktabSummary.js`, `js/sabaqDhorPage.js`, `js/maktabSettings.js`, `js/adminPage.js`, `css/detail-pages.css`, `css/journal-table.css`, `css/settings.css`, `index.html`, `js/sw.js`, `tests/verify_v3742_ui.mjs` (new), `tests/verify_nav.mjs`, `tests/verify_maktab_settings_form.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY.** Item 12 (the Move-to-Dhor rewrite) and 13 (tajweed tags) are NOT in this.

**Three of the eleven change behaviour; the rest are layout.**

**The +1 badge opens a read-only peek (8).** It had been downgraded to a `<span>` in the maktab summary — which is exactly WHY tapping it opened the day view: with no button to catch the tap it fell through to the row. It is a button again, stops propagation, and opens a floating panel listing every entry in that cell including the one already shown. Deliberately not tappable; the row still opens the day view, so no route is lost. Anchored to the badge and flipped above it when there is no room below.

**Move to Dhor gets its own row and a confirmation (10, 11).** The button spans the grid below its portion rather than sharing the middle column, and carries the portion in its label — on its own line it loses the visual tie to the row above, and two movable rows would stack two identical buttons. The confirmation names the portion so a mis-tap on the wrong row is caught before the pool changes. Both survive item 12 unchanged: a per-juz button still sits on its own row and still confirms; only the eligibility rule changes.

**Menu order in three groups (7).** Home/Maktab/Maktab Settings/Admin, then Surahs/Juz Tracker/Timer with the personal screens, then Refresh/Log out. Home, Timer, Refresh and Log out were previously appended as raw HTML AFTER the items, which is why they could not be interleaved; they are now placed by the group builder, keeping their original ids so existing listeners still bind. Empty groups are dropped and dividers appear only BETWEEN survivors — a student sees Home alone in group 1 and gets no stray line under it.

**Layout:** the visibility pill is 240×11 with the thumb radius tied to its height, fixing a thumb that rendered as a circle overlapping "Teachers" (1). Maktab Settings gains spacing between its four settings, a save icon on the name row replacing the bottom text button, and "Mushaf" as a normal label aligned with "Maktab name" rather than a legend inset in a border — plus the numeric labels no longer strand "day"/"days" on a wrapped line (2-4). The Admin header groups its icon and heading left with the close on the right (5), and the id column is hidden while copy, search and tap-to-see keep working (6). The haidh control loses its border but keeps a hover state and its full tap target — it is the only place haidh is marked since V3.73.0 (9).

**Two harnesses needed realigning, and one was a genuine test fault.** `verify_maktab_settings_form.mjs` extracted the template by slicing from the "Maktab name" label markup, so a layout change broke three assertions for a reason unrelated to what they check; it now anchors on `host.innerHTML` alone. Two `verify_nav.mjs` checks pattern-matched the old `visibleNavItems` expression and now assert the rule, with the per-role jsdom runs proving the behaviour.

**Verification: 579 passed, 0 failed across 19 harnesses**, 35 of them new.

---

## V3.74.1 — Home button goes Home; the menu becomes a right-hand strip (2026-08-26)

**Files touched:** `js/auth.js`, `css/nav.css`, `index.html`, `js/sw.js`, `tests/verify_nav.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.** Supersedes V3.74.0's frontend files; the worker change in V3.74.0 still applies and must be deployed.

**The Home menu button goes Home again.** V3.71.0 pointed it at the maktab summary while trying to change where the app LANDS — the wrong target entirely. The result did neither job: the landing stayed on the personal journal (fixed in V3.74.0's `bootApp`) and a button labelled Home stopped going home. A harness assertion written at the same time pinned the mistake in place, which is why it survived two deliveries. That assertion now checks the Home button goes Home, and the landing is asserted separately in `verify_setup_sheet.mjs` — kept apart so the two are not confused for each other again.

**The menu is a vertical strip down the right**, 25% wide, opening under the auth band beside the toggle that opens it. It only ever holds six to eight items; a 4- or 6-column grid stretched across the full width meant long labels wrapped while most of the row sat empty. Each item is now a row — icon, then label, left-aligned — with a fixed icon column so every label starts at the same x.

**Three details that matter more than they look.** The width is clamped between 200px and 320px: 25% of a phone is too narrow for "Surahs in my Heart", and 25% of a wide monitor is far more than a short list needs. The old 4- and 6-column grid rules are DELETED rather than overridden — left in place they would fight the vertical layout at particular viewport widths, which is the equal-specificity trap this project has hit three times. And `max-height` for the open state now clears the tallest case with `overflow-y: auto`, so a longer menu scrolls rather than clipping its last item silently.

**The Home tiles are untouched.** They share `.nav-icon-item` with the menu, so the row layout is scoped inside `#authDropdown` only; the tiles keep their stacked, centred shape. Asserted, because the tempting edit is the one that changes both.

**Verification: 544 passed, 0 failed across 18 harnesses.**

---

## V3.74.0 — Maktab settings rebuilt, landing fixed, panel sizing, icons (2026-08-26)

**Files touched:** `worker/src/maktabSettings.js`, `js/maktabSettings.js`, `js/app.js`, `js/dhorPage.js`, `js/auth.js`, `js/icons.js`, `css/base.css`, `css/settings.css`, `css/detail-pages.css`, `css/journal-table.css`, `index.html`, `js/sw.js`, `tests/verify_maktab_settings_form.mjs` (new), `tests/verify_setup_sheet.mjs`, `tests/verify_nav.mjs`. **MAKTAB DEPLOYMENT ONLY. ⚠ MIXED WORKER + FRONTEND — DEPLOY THE WORKER FIRST.** No migration.

**Maktab settings.** Mushaf is three radios, not a dropdown: what separates the three options is which boundaries they support, and a dropdown shows that one line at a time. `15line_indopak` added — `shared/data.js` already understood the value, but **the worker's whitelist did not**, so offering it in the UI alone would have failed with a 400 at save. The worker's error message is now derived from its list rather than naming values in a string that goes stale. Labels reworded to "Minimum no of students to mark a Hifz maktab day" and "Students will be flagged as inactive after X days"; explanatory hints removed.

**Admin landing — a V3.71.0 bug, not a new feature.** That delivery claimed teaching profiles land on the maktab and changed the Home DROPDOWN BUTTON instead, which is not the landing path, so an admin still opened on the personal journal. Fixed in `bootApp`, which actually decides. The `setup_complete` branch is skipped for teaching profiles: Settings is a PJ screen hidden from them, so a teacher sent there would land with no way out. The harness now extracts `bootApp` and asserts the logic is inside it — the old one passed because the string existed somewhere in the file.

**Green panel sizing, fixed as a rule.** `.screen-content` capped the white card at 30/50 but the `<section>` painting the olive background was left full-width, so the card floated in a band of green across the viewport. Four screens had it: maktab settings, admin, tadabbur, haidh detail. Home never did, because it caps the SECTION. Now `.screen:has(> .screen-content)` — by shape, not a list of ids, because a hand-written screen-id list drifted and killed the boot two deliveries ago. Where `:has()` is unsupported the rules are ignored and the panel is full-width as before. Truncated headings ("Maktab Set…") given room by the same rule.

**Summary date pill and header.** The pill stretched the screen because `.maktab-summary-toprow`'s grid NEVER APPLIED: the element also carries `.screen-top-close-row` (display:flex), equal specificity, and detail-pages.css loads later. Qualified with both classes so it wins on specificity rather than file order — the third equal-specificity/source-order bug in this project. V3.63.0 had already chosen this grid as the fix and it has been inert ever since. A width override on the shared date wrap was tried and REJECTED by `verify_e1.mjs`, which guards that hack staying gone; the guard was right, and the structural fix needs no override. The header's leading cell was painted — it always existed, it was just invisible, which is what made the header look inset.

**Icons.** The Maktab item had its own icon added (an open book) rather than repointing `sabaq`, which the Sabaq card header and journal column also use. The stroked-chevron style is retired app-wide: `chevronDown`, `rollupMerge` and `rollupSplit` are solid triangles matching the surah selector, with the roll-up pair pointing inward/outward so direction carries the meaning.

**Other:** the Dhor card's maktab button reads "Add Juz to Dhor"; the note-visibility pill is 187×14.

**Verification: 536 passed, 0 failed across 18 harnesses.** The settings form previously had NO coverage at all — the suite stayed green through its entire rewrite, which is worse than red because it reads as assurance. Its new harness cross-checks the form's mushaf options against the worker's whitelist in both directions, so they cannot drift apart again.

---

## V3.73.3 — The running version, shown on the login screens (2026-08-26)

**Files touched:** `js/versionStamp.js` (new), `js/app.js`, `index.html`, `css/base.css`, `js/sw.js`, `tests/verify_version_stamp.mjs` (new). **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY. Supersedes V3.73.0–V3.73.2 — deploy this one.**

**Every login card now shows the running version.** Visible before signing in, so it can be checked without an account.

**It is DERIVED, never hardcoded**, and that is the whole point. V3.68.0 shipped without its cache bump, so browsers ran V3.67.0's JavaScript while the source said 3.68.0 — which cost a debugging session and produced a wrong diagnosis of a real field report. A hardcoded string would have read "3.68.0" throughout that failure and actively misled. Instead the app version comes from the `?v=` on the real `<script>` tag the page loaded, and the cache version from `caches.keys()`, i.e. what the service worker is actually holding.

**A mismatch is stated in words**, not left to be spotted: `v3.68.0 — cached v3.67.0, reload`, styled amber. That is precisely the state that went unnoticed for a full session.

**Attached by query to `.login-card`**, not to a list of screen ids. There are four login screens, and a hand-maintained list would drift — which is exactly how the boot crash two deliveries ago happened.

**Degrades quietly:** no `caches` API (Safari private mode, older browsers) still shows the app version; no version on the tag says "version unknown" rather than guessing; no login cards present returns without throwing, since this runs during boot.

**One assertion had to be corrected before it was trustworthy.** The check for "no hardcoded version" scanned the raw source — but the module's own comments cite 3.68.0 and 3.67.0 while explaining why it exists, so it read its own documentation as evidence and failed. It now strips comments and inspects code. Second occurrence of that mistake in two deliveries; both times the fix was to test the code rather than the prose around it.

**Verification: 496 passed, 0 failed across 17 harnesses**, fifteen of them new — including the V3.68.0 mismatch driven for real, not asserted from source.

---

## V3.73.2 — Invisible switch option, invisible X, spacing, and the crash list removed (2026-08-26)

**Files touched:** `js/commentPrivacy.js`, `js/app.js`, `css/detail-pages.css`, `css/journal-table.css`, `index.html`, `js/sw.js`, `tests/verify_setup_sheet.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY. Supersedes V3.73.0 and V3.73.1 — deploy this one.**

**"Teachers" was invisible on the new switch.** Reported from a screenshot showing only Public and Private. `.switch-option.active` is `color: white`, designed to sit on the dark sliding `.switch-thumb` — and the V3.73.0 markup omitted the thumb. The selected option, which defaults to Teachers, was white on white. **A component reused without the element its styling assumes.** The thumb is now rendered, positioned on load for whatever value is already selected, and moved on selection.

**The Setup sheet's X was invisible although the corner was clickable.** `iconHtml('close')` returns an inline `<svg stroke="currentColor">` with no intrinsic size, so with neither colour nor dimensions set it inherited nothing and drew nothing. Colour and size are set on the button and the svg; the body also gains top padding so the instruction text does not run under it. The button was always there — only the icon was missing, which is exactly why tapping worked.

**The hand-written close-button id list is GONE**, replaced by `querySelectorAll('.screen-close-btn:not(#logDetailClose)')`. Every one of those buttons already carried the class, so the list only ever restated it — and drifted the moment V3.72.0 deleted a screen, throwing on a null and killing the boot. A query cannot drift: delete a screen and its button leaves the set. `#logDetailClose` is excluded because it is wired in its own file and would otherwise navigate twice on one tap. V3.73.1's guard is superseded by removing the thing that needed guarding.

**Spacing:** the note box gains a top margin — it sat flush against Duration. **The visibility switch is halved**, 220px→110px and 34px→17px, as an override on `.mk-vis-switch` rather than an edit to the shared `.switch-track-small-wide` variant, which would silently shrink any future user of it.

**One process note worth recording.** The render-time thumb placement was written with a string replacement that matched nothing and failed silently, so the first attempt shipped a thumb that never moved — the same invisible-option bug in a different form. The harness caught it. An edit that "succeeds" without matching is the failure mode to watch for in this kind of scripted change.

**Verification: 481 passed, 0 failed across 16 harnesses.**

---

## V3.73.1 — Fixes a boot crash introduced by V3.72.0 (2026-08-26)

**Files touched:** `js/app.js`, `index.html`, `js/sw.js`, `tests/verify_setup_sheet.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY. Deploy this with or before V3.73.0 — V3.72.0 alone is broken.**

**`TypeError: null is not an object (evaluating 'btn.innerHTML = iconHtml('close')')` at startup.** V3.72.0 deleted the maktab setup screen and its close button, but `js/app.js` wires a hand-maintained list of close-button ids at boot and still named `maktabSetupCloseBtn`. The unguarded `getElementById` returned null and threw, taking down everything after it in the boot sequence.

**Both halves fixed.** The stale id is removed, and the loop now skips a missing element rather than throwing. The guard matters more than the removal: that list names ids in `index.html` and is edited by hand, so it will drift again the next time a screen is deleted — and an unguarded lookup in BOOT code turns a stale entry into a dead app rather than a missing icon. Same shape as the V3.51.2 `haidhRulingHint` bug and the `homeHeaderIcon` removal in V3.69.0, where the write was deleted rather than null-guarded for exactly this reason.

**Four new assertions in `verify_setup_sheet.mjs`**, including that every id the boot list names still exists in the markup — which is the check that would have caught this before shipping, and did not exist.

**Verification: 477 passed, 0 failed across 16 harnesses.**

---

## V3.73.0 — Dhor card: note-visibility switch, student notes dropped, haidh icon off the day cards (2026-08-26)

**Files touched:** `js/commentPrivacy.js`, `js/maktabDay.js`, `js/logContext.js`, `css/detail-pages.css`, `index.html`, `js/sw.js`, `tests/verify_context.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.** Completes items 2–4 of the Dhor card list; item 1 shipped as V3.72.0.

**Note visibility is a compact three-way switch inside the note box.** Three full-size radios became the same segmented control the Quarter/Half/Juz selector uses, at the `.switch-track-small-wide` size — a variant that already existed in `detail-pages.css` and had never been wired to anything. It sits in the note box because it governs who can see THE NOTE, not the entry; detached above it, it read as unrelated chrome. Wired by delegation on `document`, once, rather than per render: `renderCommentBlock` rewrites `innerHTML` on every entry load and mode change, so per-render listeners would leak or silently stop working. The read uses `.dataset.value` — these are buttons now, not radios.

**The maktab no longer reads student notes.** That drops one of the three permitted PJ→maktab inputs, leaving two: the sabaq_to extension and haidh. It also removes THREE `apiGetPJLogsFor` calls that fired on every day-view open purely to fetch her notes — a real latency saving, not only tidying. `apiGetPJLogsFor` survives for the sabaq_to extension. `setLogCtxPjNotes`, `logCtxPjNote` and `LOG_CTX_PJ_NOTES` are deleted outright rather than left as no-op shims; a shim there would be the same dangling read V3.64.1 had to fix in that area once. **Notes already frozen onto saved maktab rows still show** — that is maktab data on a maktab row, and hiding it would mean entries visible today showing less tomorrow.

**The haidh icon left the day cards.** Marking happens in one place now, the summary. It was a CONTROL there, not a badge — it marked and cleared including the 15-day gap confirm — so this removed one of two ways to mark, and a teacher inside a student's cards now backs out to the summary. `maktabToggleHaidh`, `maktabMarkHaidhFlow` and the gap check are untouched; the summary still uses them.

**Harness assertions updated, not worked around.** `verify_context.mjs` drove the radios and the deleted PJ-note feature. Its checks now assert the REMOVALS held: the context accessors are undefined, nothing in shipped code still calls them, the day view makes exactly one `apiGetPJLogsFor` call, no `[data-haidh-toggle]` survives on the day cards, and a frozen note still renders. One of those assertions was itself wrong first time — it counted the substring `apiGetPJLogsFor`, which the new explanatory comments also contain; it now counts real calls.

**Verification: 473 passed, 0 failed across 16 harnesses**, from a confirmed-green 474 baseline (the net −1 is the deleted PJ-note feature's own checks, replaced by fewer removal checks). Cache bump as its own operation, verified after writing.

---

## V3.72.0 — Setup takes over the Dhor card's Plan button (2026-08-26)

**Files touched:** `js/maktabSetup.js`, `js/dhorPage.js`, `js/maktabDay.js`, `js/maktabSummary.js`, `js/app.js`, `index.html`, `css/journal-table.css`, `js/sw.js`, `tests/verify_setup_sheet.mjs` (new), `tests/verify_e1.mjs`, `tests/verify_e2.mjs`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.**

**In the maktab the Dhor card's Plan button is now Setup**, opening the juz checkboxes as a sheet over the card. In the personal journal it stays Plan, unchanged. Nothing was lost: the upcoming-plans queue is PJ-only with no maktab table, and since V3.64.0 it had been deliberately showing an empty sheet in the maktab — a dead control became a live one.

**The old full-screen Setup is deleted**, with its route, its heading and the `maktabSetupName` population. The Setup chip is gone from the summary row: Setup configures the Dhor pool and nothing else, so it belongs with Dhor rather than on a row spanning all three log types.

**Closing needs no routing**, which is why this replaced two earlier approaches. A popup via `enterEditScreenMode` and a chip-move were both specced and discarded; each had to answer "where does Setup return to". A sheet leaves the card underneath — same student, same date. The X sits on the card rather than on a screen above it, which is what the full-screen version got wrong.

**Two things deliberately preserved through the move.** The destructive save still names the ajzaa being removed rather than a bare "sure?" — a sheet is easier to open by accident than a screen was. And the pool is still read for the student the context names; the new harness asserts Setup contains no own-only profile call, so the wrong-row class (i) removed cannot creep back in here.

**A time bomb in `verify_e2.mjs`, found and defused.** The haidh-flow test called `maktabMarkHaidhFlow` with no date, so it used the REAL today against a fixture whose last haidh was 2026-08-10. It passed when written and began failing permanently once real time passed the 15-day gap — the confirm correctly stopped firing. Not a code bug. The date parameter exists for exactly this (V3.63.0 added it after hardcoded "today" went wrong); the test was not using it. Now pinned. **Both failures were present in the uploaded repo before any change here**, and had been wrongly attributed to the previous session's abandoned work.

**One `verify_e1.mjs` expectation updated, not worked around** — it asserted the Setup chip in the summary name cell. Names in the second cell and the haidh control staying out of it are still asserted.

**Verification: 474 passed, 0 failed across 16 harnesses**, from a confirmed-green 451 baseline. Cache bump done as its own operation and verified after writing.

**Items 2–4 of the Dhor card list are NOT in this delivery** — the note-visibility switch, dropping the student-note lookup, and the haidh icon leaving the day cards. Specced, unbuilt.

**Note:** the uploaded repo's CHANGELOG topped out at V3.71.0, so **V3.71.1 was never applied** (the Surahs-in-my-Heart harness assertions). Nothing in this delivery depends on it.


---

## V3.71.0 — Student read-only maktab day; teaching profiles open on the maktab (2026-08-17)

**Files touched:** `js/logContext.js`, `js/logDetailScreen.js`, `js/app.js`, `js/maktabJournal.js`, `js/auth.js`, `css/detail-pages.css`, `index.html`, `js/sw.js`, `tests/verify_nav.mjs`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.**

**A student can now open her own maktab day.** Tapping a row in the Maktab Journal sets the log context to HER and shows the same shared log cards a teacher sees, read-only. Reusing the cards rather than building a viewer is what keeps the maktab from drifting away from the personal journal, and that reuse was worth preserving for the read-only case too.

**Read-only is ONE flag, applied in ONE place, as a SWEEP.** `logCtxReadOnly()` on the context; `applyLogDetailReadOnly()` disables every `input`, `textarea` and `select` on the screen and every button that is not on a positive READ allow-list (History, count badges, close, nav). A deny-list of known write controls would have left the next control anyone adds live by default — the same failure shape as the four scattered pool writes before (i). It is called from the single `showScreen('logDetail')` path, so no entry point can forget it, and it is turned off again rather than latching.

**Belt and braces, not the only lock.** Every maktab write is already teacher-gated in the worker (`maktabLog.js` :51, :97, :146), and the journal names her own id so the worker would 403 anything else. This hides controls that would be refused anyway.

**Styling deliberately avoids `display:none` on individual card children** — hiding some children of the shared card grids is what scrambled auto-placement through the V3.45.6-.11 saga. Disabled controls read as inert and the layout is unchanged; only the save wrap and Delete, which are pure write chrome with nothing to read, are removed outright.

**Teaching profiles now land on the Maktab summary instead of Home.** Read as the summary rather than "Maktab Journal" as phrased, because Maktab Journal is the student's own-rows screen and teaching profiles deliberately do not have it (V3.70.2). If a journal-shaped teaching landing view is really wanted, that is a different screen and does not exist. Students still land on Home.

**Verification: 451 passed, 0 failed across 15 harnesses**, twelve of them new in `verify_nav.mjs` — including that the sweep stays a sweep, that History survives it, that read-only does not leak into a PJ session when the context clears, and that the journal never names another student. Cache bump as its own operation, verified after writing.

---

## V3.70.4 — Student read-only maktab view + teaching landing screen, specced (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. Nothing built.**

**A student gets the Maktab Journal and the maktab log details, view only.** The data path already exists and is already safe: `handleGet` defaults to the logged-in id and 403s a non-teacher naming anyone else, and every maktab write is teacher-gated at three separate handlers. So view-only is enforced at the server today — what is missing is purely the UI route and a read-only rendering of the shared log cards.

**The design note that matters:** the maktab day view reuses the PJ's own cards deliberately, so a read-only mode should be ONE flag on the context that the cards ask once — not a list of individually suppressed controls. The latter is the same shape as the four scattered pool writes before (i), and would leave the next control added uncovered.

**The teaching app opens on the maktab rather than Home.** Recorded with an ambiguity flagged rather than assumed: the phrasing was "maktab journal", but that is the student's own-rows screen, which teaching profiles deliberately do not have — they have the multi-student summary. Read as the summary; if a journal-shaped teaching view is really wanted, that is a different screen and does not exist yet.

---

## V3.70.3 — (j) is build-ready: separate PIN, and the plan written out (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. Nothing built — (j) still needs its own "start building".**

**Separate PIN on the teaching account**, and it costs nothing: `pin_hash` is already set on first login rather than at creation, so a new teaching row starts NULL and the teacher sets its PIN the first time she enters — the same path every student already takes.

**That settles the switcher too, without another question.** "Switch to teaching" pre-fills the derived id and asks only for the PIN, which is what makes it not "logging in as someone else" — nothing to remember, four digits to type. The derived id is a username; the separate PIN is the secret. Which matters, because ids cannot be truly hidden from a teacher's browser even though no screen shows them.

**The full (j) plan is now written into TODO.md** in build order: roster filter, create-teaching-profile action, switcher, the `updateLog` date validation riding along as scheduled, and the admin PJ discard run by hand afterwards.

**No migration.** `students.role` already carries the type and the derived id encodes the relationship, so (j) is a gating-and-flow change rather than a structural one against live data — worth having established before touching auth, which is where this project has been bitten before.

---

## V3.70.2 — The student Maktab Journal is hers, and that is verified not assumed (2026-08-17)

**Files touched:** `js/auth.js`, `index.html`, `js/sw.js`, `tests/verify_nav.mjs`, `tests/verify_e1.mjs`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.**

User: *"students only see their own rows in the maktab journal."* Correct, and checked rather than taken on trust, because this screen reads maktab tables and the entire point of the separation is that a student sees only herself. It is scoped at two layers: `js/maktabJournal.js:28` calls the three maktab getters with **no argument**, so no `student_id` is sent; and `worker/src/maktabLog.js:138-139` defaults to `auth.id` and returns 403 to any non-teacher who names someone else. The server refuses — it is not merely that the client asks nicely.

That is what makes it a personal screen rather than "maktab stuff", so it goes back on the student's nav. Teaching profiles still do not get it; they have the Maktab summary, the multi-student view built for them.

**Two new harness checks tie the nav decision to the reason for it** — that the journal sends no `student_id`, and that the worker 403s a non-teacher naming another student. If either ever stops holding, the item must come off the student's nav again, and now the suite says so rather than relying on someone remembering.

**This item has now moved three times in one day** — removed for everyone in V3.69.0, given to students in V3.70.0, removed again in V3.70.1, restored here. All three were Claude's misreadings of scope, not changes of instruction. The stable statement of what a student sees now lives in `TODO.md` rather than being reconstructed from the CHANGELOG each time.

Resulting nav:

| role | nav |
|---|---|
| student | Summary, Detail, Tadabbur, Juz Tracker (full), Surahs, Settings, Haidh, Maktab Journal |
| teacher | Juz Tracker (free play), Surahs, Maktab |
| admin | Juz Tracker (free play), Surahs, Maktab, Maktab Settings, Admin |

**Verification: 439 passed, 0 failed across 15 harnesses.** Cache bump as its own operation, verified after writing.

---

## V3.70.1 — Students keep their whole personal journal and no maktab items (2026-08-17)

**Files touched:** `js/auth.js`, `index.html`, `js/sw.js`, `tests/verify_nav.mjs`, `tests/verify_e1.mjs`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.**

User: *"give students everything except the maktab stuff back."* V3.70.0 had already restored the personal journal to students after V3.69.0 wrongly hid it from everyone; what it got wrong was also handing students the **Maktab Journal**, on the reasoning that it was the one place a student could see what the maktab recorded for her. That reasoning was mine, not stated, and it cut across the clean separation being asked for.

`MAKTAB_JOURNAL_NAV_ITEM` is now shown to **nobody**. Students get their personal journal entire and no maktab entry points; teaching profiles reach the same rows through the Maktab summary and never needed it.

**Parked, not deleted** — the same treatment as the real juz tracker. The screen and its module still exist and still work; (k)'s merged journal is what decides how a student sees maktab records again, and this is the obvious carrier. Restoring is one line.

**Consequence, recorded in the code so it is not later mistaken for a bug:** a student now has no route to her maktab records until (k) lands. That is the intended separation.

Resulting nav — the two sides are now cleanly disjoint, and `verify_nav.mjs` asserts no screen appears for both:

| role | nav |
|---|---|
| student | Summary, Detail, Tadabbur, Juz Tracker (full), Surahs, Settings, Haidh |
| teacher | Juz Tracker (free play), Surahs, Maktab |
| admin | Juz Tracker (free play), Surahs, Maktab, Maktab Settings, Admin |

**Verification: 436 passed, 0 failed across 15 harnesses.** Cache bump done as its own operation and verified after writing.

---

## V3.70.0 — The PJ is hidden for teaching profiles only; students keep theirs (2026-08-17)

**Files touched:** `js/auth.js`, `js/juzTrackerScreen.js`, `index.html`, `js/sw.js`, `tests/verify_nav.mjs`, `tests/verify_e1.mjs`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker, no migration.**

**Corrects V3.69.0, which was too broad.** Confirmed in chat: *"those items are only hidden for teacher profiles. Students see everything except admin profiles."* V3.69.0 hid Summary, Detail, Tadabbur, Settings and the haidh calendar from **everyone** — including the students whose journal it is. Now hiding is gated on `isTeachingProfile()` (teacher or admin, matching `isTeacherOrAbove` parity everywhere else in this codebase).

**Maktab Journal is restored for students.** V3.69.0 removed it outright. It is the student's read-only view of what the maktab recorded for her — the one place she sees it — so it belongs to students and is withheld from teaching profiles, which reach the same rows through the Maktab summary instead.

**Free-play-only follows the same rule.** `FREEPLAY_ONLY` is now `isTeachingProfile()` rather than a blanket `true`. A student's tracker reads and writes her own pool, which is what it is for; there was never a reason to withhold it from her. Still temporary for teachers, and the tracker path stays intact either way.

**This is still not the account separation.** `role` is the only discriminator available until (j), and it happens to give the right answer, because an account that teaches is exactly the one that should not be offered a personal journal. (j) replaces it with a real account type.

**Verification: 436 passed, 0 failed across 15 harnesses.** `verify_nav.mjs` now drives the real `visibleNavItems()` under jsdom for all three roles rather than trusting regexes, asserting that a student sees every PJ screen plus Maktab Journal and no admin items, a teacher sees none of them, and an admin is treated as a teaching profile. Two `verify_e1.mjs` student expectations were corrected — the same two V3.69.0 had updated hours earlier, now back to asserting the student keeps her journal.

**Cache bump done as its own operation this time**, after V3.68.0 shipped without one because the bump was chained behind an assertion that failed. Both `index.html` (43 tags) and `js/sw.js` are on 3.70.0, verified after writing.

---

## V3.69.1 — (j) decisions recorded; admin PJ discard script (2026-08-17)

**Files touched:** `worker/discard-admin-pj.sql` (new), `TODO.md`, `CHANGELOG.md`. **Documentation and one un-run SQL script. No application code, nothing to deploy, no migration.**

**`worker/discard-admin-pj.sql` — written, NOT run.** Removes the admin account's personal-journal data so it can become the maktab teacher. Deliberately console SQL rather than a numbered migration: a one-off deletion of one account's rows is data, not schema, and a migration file can be run twice, never, or against the wrong database — the gap behind an earlier real login outage. The id is a placeholder; "ADMIN-01" appears in `TODO.md` as prose and is never a literal id, so the script finds it in step 0 rather than guessing. Step 1 is a dry-run count, step 2 deletes one statement at a time, step 3 verifies zeros and that the account still exists with its role.

**The table list previously quoted was incomplete.** It omitted `plans`, the PJ's upcoming-plans queue, which would have left orphan plan rows pointing at deleted logs. Every column in the profile-level `UPDATE` was checked against `SCHEMA.md` before shipping. The account row, its role and its `pin_hash` stay — clearing the hash would lock the only admin out.

**Ordering matters and is stated in the script: run it only after V3.68.0 and V3.69.0 are deployed and confirmed.** Before (i), maktab mode read the teacher's own pool and profile; deleting those earlier changes maktab behaviour and the cause gets misattributed.

**(j) decisions recorded.** A teaching account never gets a personal journal — a person who both teaches and does hifz holds two accounts. Since `students.role` already carries the type, this makes (j) a gating change plus a one-time discard rather than a schema change. Two consequences found while checking: `handleMaktabSummary` selects active students with **no role filter**, so teaching accounts would appear in the maktab summary as students to log against — a small fix that must ship inside (j); and the proposed derived-id scheme (teaching id = PJ id + `teacher`) re-links the two accounts, which restores the "a teacher cannot log her own hifz" guard that unlinked accounts would have lost, at the cost of making the privileged id derivable from one every teacher can already see in the roster. Mitigation options recorded, with a separate PIN on the teaching account recommended.

---

## V3.69.0 — The personal journal hidden in the maktab; Home header row removed (2026-08-17)

**Files touched:** `js/auth.js`, `js/juzTrackerScreen.js`, `js/app.js`, `index.html`, `css/nav.css`, `js/sw.js`, `tests/verify_nav.mjs` (new), `tests/verify_e1.mjs`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. FRONTEND ONLY — no worker changes, no migration, no schema change.**

**Hidden, via one reversible switch.** `HIDDEN_PJ_NAV_IDS` in `js/auth.js` withholds `journal` (Summary), `logDetail` (Detail), `reflections` (Tadabbur), `settings` and `haidhDetail`. Not a role gate: (j) is what introduces a real teaching-vs-student distinction, and inventing a half-separation now would be a second mechanism to unpick later. Restoring any screen is deleting a line from that set. `MAKTAB_JOURNAL_NAV_ITEM` is dropped from the nav entirely — it is the student's read-only view of her own maktab logs, not a PJ screen being hidden.

**Hiding withholds the way in, not the screen — and that distinction is load-bearing.** `js/maktabDay.js` routes straight into the logDetail screen, so removing logDetail rather than hiding its nav entry would have taken the maktab day view down with it. Verified that `showScreen` never consults the nav list, so every hidden screen stays reachable by route; `verify_nav.mjs` asserts both.

**Juz Tracker: free play only, tracker parked.** A `FREEPLAY_ONLY` flag opens the screen in free play and withdraws the toggle. `setFreeplay(false)` still restores the real tracker intact, and delivery (i)'s routed `logProfile()` / `logSavePool()` calls are untouched — unreachable while the flag is true, and precisely what makes the tracker safe to switch back on. The harness asserts they survive, and that the screen has not quietly regained an own-only call while nobody could see it. Reverting is one boolean.

**Home header row removed whole**, not just `#homeHeaderIcon` — V3.43 had already taken the text label, so removing the icon alone would have left an empty row and a gap above the tiles. The unguarded `getElementById('homeHeaderIcon')` write in `js/app.js` was **removed rather than null-guarded**: left in place it would throw and kill the rest of that function, the same TypeError shape as the V3.51.2 `haidhRulingHint` bug.

**Two `verify_e1.mjs` nav expectations were updated, not worked around** — they asserted `maktabJournal` in the nav, which this delivery deliberately removes. Per the maintenance rule in `tests/README.md`.

**⚠ A DEFECT IN V3.68.0, FOUND AND FIXED HERE — read this before deploying.** V3.68.0's cache-busting bump never landed: `index.html` was still serving `?v=3.67.0` on every script tag and `js/sw.js` still named its cache `hifzhelper-v3.67.0`. The bump was written into the same script as an earlier edit that failed an assertion, so it died before running and the re-run only covered the other two changes — a scripting mistake, not a design one.

**Consequence, and the likely explanation of the field report in V3.68.2:** any browser with a warm cache would have kept running the V3.67.0 JavaScript after V3.68.0 was deployed. That means the History rails would still have been calling the own-only client — so a Dhor logged for a student appears on the summary (server-rendered from the maktab tables) but not in her history (stale client-side JS asking for the wrong person's rows). That is exactly the reported symptom, and it fits better than "not deployed yet". Both `index.html` and `js/sw.js` now go to `3.69.0`, so this delivery carries the bump V3.68.0 should have.

**On resuming testing: hard-refresh, or confirm the service worker picked up `hifzhelper-v3.69.0`, before judging any behaviour.**

**Verification: 414 passed, 0 failed across 15 harnesses** — the new `verify_nav.mjs` (31 checks) plus all 14 prior harnesses green.

**NOT built, and not attempted:** (j) and (k). See the CHANGELOG note and TODO for what they still need.

---

## V3.68.4 — Haidh hidden too; the tracker restriction is explicitly temporary (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. Nothing built — the nav-hiding spec still awaits its own "start building".**

**Haidh joins the hidden items.** `HAIDH_NAV_ITEM` is hidden alongside Summary, Detail, Tadabbur and Settings, answering the first of the two questions V3.68.3 left open. Recorded with a boundary, because "hide haidh" reads wider than it means: this removes the route to the personal haidh **calendar screen** and nothing else. `trackHaidh` keeps its value, the maktab's own haidh marking from (e2) is untouched, and (f)'s derived attendance keeps propagating haidh across maktab days on calendar-day counting exactly as built.

**The Juz Tracker restriction is temporary and the code is parked, not retired.** The real tracker may come back, so its code stays intact behind the gate rather than being deleted — a deliberate exception to convention 3 (delete superseded code promptly), because it is not superseded. The routed pool reads and write that (i) added become unreachable while free-play-only is in force, and the entry now says explicitly that they must not be stripped as dead code: they are what makes the tracker safe to switch back on.

Surahs in my Heart remains unanswered and visible — the one open question left in this spec.

**On cadence:** V3.68.2 committed to batching doc-only changes rather than cutting a version per exchange, and this breaks it deliberately. Spec decisions have to reach the repo, because the build sandbox does not survive the session — the lesson that produced `tests/` in V3.67.2. Batching applies to trivia; a decision the next session needs does not qualify.

---

## V3.68.3 — Nav-hiding spec for (j) (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Nothing built — this is the spec, awaiting its own "start building".

The "remove the PJ icons from the maktab" item is now specified against the real nav list. **Hide** is the user's word, so a reversible gate rather than a deletion, and one change covers both surfaces: `visibleNavItems()` in `js/auth.js` feeds the Home tile grid and the dropdown alike.

Hidden: `journal` (Summary), `logDetail` (Detail), `reflections` (Tadabbur), `settings` (Settings). Removed: `MAKTAB_JOURNAL_NAV_ITEM` — the student's read-only view of her own maktab logs, which has no place on a teaching account. The Juz Tracker stays but free-play only: today it opens in tracker mode and offers a toggle, so free-play-only means opening in freeplay and retiring that toggle.

That last one makes the tracker's pool reads and writes unreachable — the exact three calls (i) routed a few hours earlier. The routing remains correct and costs nothing; it simply goes unexercised until the real tracker returns, which is worth knowing before someone reads it as dead code.

**Two things flagged rather than assumed.** The Haidh nav item is gated on `trackHaidh`, and that flag is only settable from the Settings screen this change hides — so on an account where it is already true the item keeps showing with no UI route to turn it off. And Surahs in my Heart was not named: a personal activity, arguably a PJ icon by the same logic, left visible pending a word.

---

## V3.68.2 — Field report recorded; two (j) decisions landed (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.**

**Field report:** a Dhor entry logged for a student as admin appears on the maktab summary but not in her history. Recorded rather than chased — the user has paused testing until the maktab/PJ separation is complete. The most likely explanation is that V3.68.0 was not yet deployed when it was observed: before it, the History rail called the own-only client and so showed the logged-in person's entries, which is precisely item 4 of the V3.68.0 checklist in `TESTING.md`. First thing to establish on resuming is whether V3.68.0 was deployed, worker first.

Server side ruled out by inspection: `handleGet` takes `student_id` from the query and `getLogs` filters on it alone, with no date window and no row-dropping privacy filter. So a correctly-addressed request returns the row, and suspicion falls on which student id the rail asked for — exactly what (i) changed. If V3.68.0 *was* deployed, one disambiguation is needed before tracing: whether "her history" meant the rail on the maktab card, the student's Maktab Journal, or her personal journal — where a maktab entry legitimately does not appear yet, since the merged view is delivery (k).

**Open question 1 answered: ADMIN-01 loses its history and becomes the maktab teacher.** Discard, not migrate. Its journal rows go and the account becomes a teaching account with no personal journal, which also disposes of the stray haidh mark and the known-wrong stored position — both dev residue on that row.

**New for (j): remove the PJ icons from the maktab.** Under the separation a login is either a teaching account or a student account, so the personal journal's entry points have no meaning in a teaching session, and their presence is what makes the two feel merged. Scope to settle when built: which nav items count (Home tiles and the dropdown both mirror `NAV_ITEMS` in `js/auth.js`), and whether they are hidden by role, by active context, or removed from the teaching account's list entirely.

**(j) is now the blocking item** — testing does not resume until the separation lands.

---

## V3.68.1 — V3.68.0 test plan + one stale comment in its own code (2026-08-17)

**Files touched:** `TESTING.md`, `js/dhorPage.js`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Frontend + docs. Supersedes V3.68.0's `js/dhorPage.js`; everything else in V3.68.0 is unchanged, so deploy V3.68.0 as described there and take this file with it.**

`TESTING.md` gains the manual checklist for delivery (i) — the things 381 automated checks cannot see: that a rendered rail shows the right student, that the worker-first deploy order actually landed, and that removing a juz stays removed end to end. It leads with the deploy-order check because there is a genuine window: the frontend no longer writes the Dhor pool and the worker now does, so a frontend-first deploy means nobody writes it, silently.

Also flags Tadabbur history as the highest regression risk in V3.68.0: dropping the client argument shifted every caller's argument positions, and Tadabbur is the only caller passing a third one.

**And a stale comment in V3.68.0's own code, fixed.** `js/dhorPage.js` still described `onRowClick` as "the optional 4th parameter" after the same delivery made it the 3rd. Trivial in isolation; recorded because it is the exact mechanism §13 exists to stop — a true statement left behind by a change that moved past it — and it appeared in code written hours earlier the same day.

---

## V3.68.0 — Delivery (i): read-routing rewrite, the guard flipped, Dhor pool moved server-side (2026-08-17)

**Files touched:** `js/logContext.js`, `js/dhorPage.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/reflectionCard.js`, `js/juzTrackerScreen.js`, `js/api.js`, `shared/data.js`, `worker/src/dhorSchedule.js`, `worker/src/dhorLog.js`, `worker/src/maktabLog.js`, `index.html`, `js/sw.js`, `tests/verify_routing.mjs`, `tests/verify_pool.mjs` (new), `tests/README.md`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed worker + frontend — DEPLOY THE WORKER FIRST (`shared/data.js` and `worker/src/*` carry the pool merge the frontend now relies on having), then the frontend. No migration, no schema change.**

**All 16 unrouted call sites are routed; `verify_routing.mjs` flipped from measuring 16 to asserting 0.** Any new own-only call reachable in maktab mode now fails the suite instead of shipping unnoticed.

**The ten History rails.** `renderRecentEntries` no longer takes a client — it asks `logClient(type)`. Ten call sites each handed over a hardcoded own-only constant, so a teacher opening a student's card saw her own recent entries. There is no longer a constant to pass wrongly. `logClient` also gained `reflections` and became a switch rather than an object literal: building a map dereferenced every client on every call, so one absent global broke lookups for unrelated types — the harness caught precisely that.

**The four pool writes became one routed writer,** `logSavePool` in `logContext.js`, serving Sabaq's auto-move, Sabaq Dhor's rollup and the juz tracker. The maktab branch writes the same `position_json.baselineSelection` shape `maktabSetup.js` already uses. The juz tracker's two `apiGetProfile()` reads now go through `logProfile()`.

**The Dhor pool write moved into the worker.** `mergeDhorUnitsIntoPool` merges the logged quarter-units inside the same request that writes the row, for the same `studentId`, and the client block in `dhorPage.js` is deleted. Two faults go by construction rather than by discipline: there is no second request left to fail silently (the old one neither awaited nor surfaced its error), and the pool written is always the pool of the student the row was written for — the maktab wrong-row case is unroutable, not merely routed. `segmentRangeToPicker` and `segmentToQuarterUnits` moved to `shared/data.js`, which was already dual browser+worker; both are pure and depended only on `segmentsPerJuz`, already there.

**Removal stays entirely free,** and the harness guards it. The merge only ever ADDS what was just logged — clearing juz from the pool is a legitimate action and nothing here re-asserts or repairs it. Re-logging a removed juz adds back that juz and nothing else.

**A pool failure cannot destroy a committed log row.** The merge runs after the insert, so it is wrapped: a fault is reported to the worker log rather than thrown, because throwing would turn a good save into a 500 and invite a retry that duplicates the row. This is not the silent `.catch(() => {})` it replaces — that one sat between two requests and lost real failures to the network; anything reaching this one is a schema or DB fault, and it is visible.

**`apiMaktabSabaq` / `apiMaktabSabaqDhor` / `apiMaktabDhor` deleted.** Zero call sites, and they were the token-deciding form of the very endpoints `makeMaktabLogClient` student-scopes — the wrong-row footgun under inviting names. `verify_routing.mjs` could never guard them because it scans call sites and they had none, so deletion was the only guard.

**Verification: 381 passed, 0 failed across 14 harnesses** — the new `verify_pool.mjs` (24 checks, a D1-shaped stub over `node:sqlite` driving the real merge for both the PJ and maktab paths) plus all 13 prior harnesses re-run green.

---

## V3.67.10 — Dhor pool: design (B) withdrawn, scope collapses to one change (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3–V3.67.9. Cut immediately after V3.67.9 despite the batching commitment, because V3.67.9 records a design that is wrong — a wrong design left sitting in `TODO.md` is exactly the failure §13 exists to stop, and a correction must not lag the claim it corrects.

**Design (B) — "make the pool a derived union" — is withdrawn.** User, 2026-08-17: *"There may be legitimate reasons for resetting or removing juz from dhor — it's not your call, and all it means is that the prepop changes."* Removing a juz from the Dhor pool is a normal action, not corruption. A derived union would have made removal impossible, since the unit would be re-derived from history on the next read — it would have removed a capability while claiming to prevent a bug. The value judgement underneath it, that a student cannot un-memorise something she has demonstrably revised, was never the user's and should not have been assumed.

**Most of the item collapses as a result.** An empty pool alongside real history is a legitimate state meaning the pool has been cleared, so the prepop has nothing to offer. The Setup-reset path is not a fault, and "setup RESETS the pool" (2026-08-16) stands exactly as decided. The emptiness gate at `dhorSchedule.js:176` is correct ahead of the history query at `:179` — with an empty pool there is genuinely nothing to continue from. Only its wording is loose: *"No memorised juz'/quarters recorded yet in Hifz Setup"* implies she never set it up when she may have cleared it deliberately. Reword eventually; not a bug.

**One real change survives: (A).** The only genuine fault is the pool diverging from what the student actually did without her asking — `js/dhorPage.js:1436` neither awaits nor surfaces its failure, and is one of the four unrouted pool writes so it grows the teacher's pool in maktab mode. Move the Dhor contribution into `handleSaveDhor`, which already has the segment, the ref and the target `studentId` in the same request, and delete the client block. Removal stays entirely free — adding on log and removing on demand are independent, and re-logging a removed juz simply adds it back under the existing rule.

Both earlier framings of this item — "rebuild from history" and "derived union" — are recorded in `TODO.md` as withdrawn, with reasons, so neither gets revived.

---

## V3.67.9 — Dhor pool: prevention design replaces the repair; Haidh hint scope confirmed (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3–V3.67.8 — the zip carries all four files. Batched rather than shipped per-answer; V3.67.8's note explains why.

**Dhor pool — the rebuild-from-history repair is withdrawn.** User's direction: prevent the mistake rather than mitigate the failure. Rebuilding a corrupt pool is mitigation, so it is out. The structural cause is recorded instead: `students.baseline_selection` is one mutable array that four client-side writers read-modify-write, each as a non-atomic two-request sequence, any of which can clobber another's contribution. The model is "the pool grows in three ways"; the storage is "one array anyone can overwrite," and all three failure paths are that mismatch showing through.

**(A) The Dhor contribution moves server-side, into the log insert.** `handleSaveDhor` already has `segment_from`/`segment_to`/`ref` and the target `studentId` in the same request that writes the row; it merges the units there, and the client block at `js/dhorPage.js:1426-1437` is deleted. Feasibility confirmed: `shared/data.js` is already dual browser+worker and `dhorSchedule.js` imports from it; only `segmentToQuarterUnits` needs moving out of `js/dhorPage.js:637` into `shared/` and adding to the export list. This removes the silent-failure path (no second request left to fail) and makes the maktab wrong-row case unroutable rather than merely routed — `verify_routing.mjs` loses a site instead of gaining a guard.

**(B) The pool becomes derived rather than stored.** `pool = explicit marks (Hifz Setup, Juz Tracker) ∪ units derived from logged activity (Dhor logs, Sabaq-Dhor overflow)`. An empty pool alongside real history stops being a representable state. Flagged for the user's word because it changes a stated decision: "setup RESETS the pool" (2026-08-16) would become a reset of the marked portion only, with history-derived units surviving.

**Scope note added for (i):** (A) removes the Dhor pool write from (i)'s set of four rather than routing it, so (A) belongs inside (i) — otherwise (i) builds a routed writer for a call about to be deleted. The cost is that (i) stops being frontend-only and gains a worker-first deploy order. Still no schema change.

**Haidh ruling hint — scope confirmed.** The sentence comes off the screen; the ruling stays a working part of the app. Verified that the four-piece removal leaves `setupSelectedRuling`, the switch callback, the profile load/render, the 10/15-day duration validation and the `haidh_ruling` save all intact — only the two hint writes, the constant and the `<p>` go. The separate deletion of the "Ruling" label remains a distinct item, still standing from 2026-08-08.

---

## V3.67.8 — updateLog date fix scheduled onto (j) (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3–V3.67.7 — the zip carries all four files.

**The unvalidated-date fix rides along with (j)**, the next worker-touching delivery, rather than getting a release of its own. This was raised with the user as a question; it should not have been. Whether a few lines of server-side validation ship alone or bundled is a delivery-mechanics call with no product consequence and no information the user held — and a recommendation had already been given. Recorded here so the pattern is visible: questions go to the user when the answer depends on something only they know (a design preference, a visual choice, what an earlier message meant), not for scheduling or packaging.

Same note applies to the `apiSetAttendance` question in V3.67.5, which tracing the code would have dissolved before it was ever asked — the function had been gone since V3.40.2. Verify first; ask only what verification cannot settle.

---

## V3.67.7 — Empty-pool question re-scoped upwards; a swallowed pool-write found (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3–V3.67.6 — the zip carries all four files.

**The suggestion to close the empty-pool question as "working as intended" was wrong, and is withdrawn.** The user's rule — logging Dhor adds to the pool, so history implies a non-empty pool — is correct as design and *is* implemented at `js/dhorPage.js:1426-1437`. Checking whether that makes the state unreachable turned up three ways it is reachable.

**`dhorPage.js:1436` is the only one of the four pool-write sites that does not `await` and swallows its error** — `apiSaveProfile({...}).catch(() => {})`. `sabaqPage.js:415`, `sabaqDhorPage.js:190` and `juzTrackerScreen.js:146` all await. So a Dhor log can commit while its pool write fails with nothing surfaced. Same empty-catch shape as the swallowed `savePosition` failure that caused the real stuck-prepopulation bug in the V3.45.x saga.

**In maktab mode the state is not an edge case but the current behaviour**, because that same line is one of the four unrouted pool writes in the read-routing audit: it grows the teacher's pool, so a maktab student's pool never grows past setup while her maktab history does. Delivery (i) removes this cause and only this one. A Setup reset is the third path.

**Why it matters:** the emptiness gate at `dhorSchedule.js:176` fires before the history query at `:179`, so such a student is told *"No memorised juz'/quarters recorded yet in Hifz Setup"* — false, and it points her at the wrong screen. Recorded explicitly: moving the gate alone would NOT produce a next segment (empty pool → `buildChunks` returns `[]` → `:188` returns none regardless), only a truthful message.

**Decision recorded as needed before this is buildable:** rebuild the pool from history when history exists but the pool is empty — every logged segment is by definition memorised, so history is a valid pool source and this self-heals all three causes — or report accurately and leave repair to Setup. Independent of that: `dhorPage.js:1436` should await and surface failures like its three siblings.

---

## V3.67.6 — Dhor start-point question confirmed and closed (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3–V3.67.5 — the zip carries all four files.

**Confirmed: Setup does not set the Dhor starting point; the prepop starts from the marked completed ajzaa in ascending juz order — which is what the code already does.** No change needed. Verified rather than assumed, by driving the real `computeUpcomingDhorQueue` with a D1-shaped stub: `baseline_selection` sorts ascending (`dhorSchedule.js:256`), `buildChunks` preserves that order (`:71`), and `startIdx` stays `0` with no `dhor_log` row (`:276-280`). Scenario with ajzaa entered 5, 9, 2 produced the queue 5,6,7,8,17,18,19 — juz 2's four quarters, then juz 5's, unmarked juz skipped. 6/6.

**Trap recorded alongside it:** "Setup does nothing" holds only for the starting point. `setupConfigured` (`:260`) still drives granularity (`:261`) and the per-day count (`:262-264`) — the same run showed 4 items/day configured against 1 unconfigured. Stripping that branch on the strength of this answer would silently break both. Same over-deletion shape as the `settingsScreen.js:381` note added in V3.67.5.

The second dhorSchedule question — empty pool with real Dhor history never reaching continue-from-last — stays open, with "close as working as intended" as the suggested resolution.

---

## V3.67.5 — Four TODO decisions recorded; a fourth stale item closed (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3 and V3.67.4 — the zip carries all four files, so upload it regardless of which earlier zips went up.

**Home header icon — decided: remove the whole header row**, not just `#homeHeaderIcon`, so no blank strip is left above the tile grid. The open sub-question in that entry since 2026-08-09 is now closed.

**Settings Haidh heading — clarified and extended to three changes.** Confirmed that the checkbox resize-and-move has NOT been built. Added a third: delete the ruling hint text ("Hanafi: haidh cannot exceed 10 days."). That one carries a trap now documented in full — `#haidhRulingHint` is written by `js/settingsScreen.js` at two sites (:65, :273) with no null guard, and :273 sits immediately before the haidh cycle/period/next-expected population. Deleting the element alone reproduces the exact V3.51.2 bug it was added to fix: TypeError kills `renderSettingsScreen` mid-function, those three fields go blank, and a save can overwrite real values. Correct removal is four pieces — the `<p>`, the `HAIDH_RULING_HINTS` constant, and both write lines. The entry also flags `settingsScreen.js:381` to KEEP: similar wording, but a real validation error rather than a standing label.

**Parked attendance — closed as already done, and it was a fourth stale claim.** The item still named `apiSetAttendance` as an unused function to build a UI for or delete. It does not exist: **removed in V3.40.2**, with `js/api.js:161` carrying the comment recording that. Every attendance client that exists is live — `apiGetAttendance` (4 call sites), `apiDeleteAttendance` (1), `apiPredictHaidh` (1), `apiMarkHaidhRange`, and (e2)'s three teacher-side `*For` variants. The worker's `handleSetAttendance` stays; `apiSetAttendanceFor` uses it. Nothing to delete on either side. That is now four stale claims found in one day's pass — same mechanism each time, and the reason for §13.

The live list is down to **nine items, one of them closed**: (i)–(l), the timezone decision, the unvalidated-date rider, two dhorSchedule confirmations, and two cosmetic sets that are now fully specified and need only "start building".

---

## V3.67.4 — TODO priority order + timezone decision (2026-08-17)

**Files touched:** `TODO.md`, `CHANGELOG.md`. **Documentation only. No application code, nothing to deploy, no migration.** Supersedes V3.67.3 — the zip carries all four of that delivery's files, so upload it whether or not V3.67.3 went up; `SPECS.md` and `CONVENTIONS.md` are byte-identical to their V3.67.3 copies.

Numbered separately rather than repackaged as V3.67.3 because a zip may already have been uploaded under that number, and reusing a number for changed content is what produced the V3.67.0/V3.67.1 split in the first place.

**`LIVE ITEMS` is now priority-ordered** and carries a `Blocked on` column. It replaces the previous grouped version rather than sitting alongside it as a summary — a summary kept separately from the detail is a second thing to keep in sync, which is what §13 exists to stop. Ordering: (i) first as the only item producing wrong data now; then the timezone decision; then (j); the unvalidated-date fix as a rider on (j)'s worker delivery rather than its own; then (k), (l); then four cosmetic or confirm-the-behaviour items. The (i) → (j) → (k) → (l) chain is fixed; everything else slots between them freely.

**Shared timezone — decided: a per-maktab setting on the maktab settings screen**, making it that screen's 5th setting alongside the mushaf, the maktab-day threshold, the absence-flag days and the maktab name. Admin-only to change, like the rest of the screen. It moves from #10-ish to #2 because its own "Phase 2 hasn't started" premise expired — (a)–(h) have shipped, and (f)'s haidh propagation counts calendar days, exactly the arithmetic that breaks across timezones. Cheapest now, with no real users and nothing yet recorded against a wrong day boundary. One sub-decision remains: display in the viewer's local timezone while calculating in the maktab's, or show the maktab's everywhere.

---

## V3.67.3 — Documentation restructure: TODO split, live-items index, migration status, convention 13 (2026-08-17)

**Files touched:** `TODO.md`, `SPECS.md` (new), `CHANGELOG.md`, `CONVENTIONS.md`. **Documentation only. No application code, nothing to deploy, no migration.**

`TODO.md` had reached 4,465 lines, of which 84% were `## Done` entries — a spec archive wearing an action list's name. Nobody reads 64k tokens of it, so sessions grep; grep returns a fragment with no signal that it is frozen delivery-time text. That mechanism had produced three false statements, all found in one pass: migration 0019 marked NOT YET RUN three deliveries after it was run; delivery (e2) marked OPEN three deliveries after V3.60.0 built it; and the V3.51.1 bottombar section whose heading read "awaiting start building" directly above its own body recording all ten items as built and verified. The two false open items are corrected and archived; their headings carry a note saying what they used to claim.

**The split.** All 90 `## Done` entries moved to `SPECS.md`, which keeps the third thing neither other document holds — why it was built that way and what was rejected. `TODO.md` drops to 673 lines and holds only what is not done. Verified lossless by line accounting: 4,470 in, 4,470 out, 90 sections archived, 0 left behind.

**`LIVE ITEMS`**, at the top of `TODO.md`: the entire action list — four architecture deliveries (i)–(l) and six open bugs/flags. Every one was re-verified against the code rather than trusted, which is how the parked-attendance item turned out to be two-thirds closed (`apiGetAttendance` has 4 call sites, `apiDeleteAttendance` 1; only `apiSetAttendance` is unwired). Deliberately carries no line numbers — they go stale on the next edit, which is the failure being fixed.

**`MIGRATION STATUS`** now appears in both `TODO.md` and `CHANGELOG.md`, dated, stating all three migrations RUN. The stale imperative inside the V3.65.0–V3.67.0 entry is rewritten to past tense pointing at that block.

**CONVENTIONS.md §13 — mutable state never lives in append-only prose.** Current state lives in one dated block per file and gets edited; delivery entries say what was required at upload time and point at it; the mirrored status blocks are updated together; a delivery that closes a flagged item edits the flag rather than superseding it further down the file. This is the part that stops the next one being generated.

Suite re-run after every step: 357 passed, 0 failed across 13.

---

## V3.67.2 — Verification harnesses moved into the repo (2026-08-17)

**Files touched:** `tests/` (new — 13 harnesses, `run-all.mjs`, `README.md`), `TODO.md`, `CHANGELOG.md`. **No application code. Nothing to deploy, no migration.**

The harnesses have always lived in the build sandbox, which is discarded at the end of each session — so 357 checks, including the routing guard the architecture entry depends on, would have been lost on the next handover. They now live in `tests/`, with every hardcoded path rewritten to resolve relative to the repo so they run wherever it is checked out.

`node tests/run-all.mjs` runs all 13 and reports one total; `npm install jsdom` is the only dependency (`node:sqlite` is built into Node 22). The README explains what each harness covers, the two techniques they use (a D1-shaped stub over `node:sqlite` for worker code, jsdom over the real modules for frontend code), and the maintenance rule that has mattered most: when a delivery changes behaviour a harness asserts, update the assertion rather than working around it.

`verify_routing.mjs` gets its own section, including the fact that its own first draft was broken — it skipped one-line functions and so missed `apiSaveProfile`, one of the exact sites it exists to catch, reporting 13 where the truth was 16.

---

## V3.67.1 — TODO.md only: architecture write-up and routing audit (2026-08-17)

**Files touched:** `TODO.md`. **Documentation only.**

Carries the maktab/PJ separation architecture agreed in chat — separate teaching and student accounts, the device-local account switcher, the merged-with-provenance journal, union-at-read-time plus a 60-day archive with re-sync — together with the mechanical read-routing audit and the delivery split (i)–(l). Issued separately because V3.67.0's zip was repackaged twice under the same number after its code was already uploaded; only `TODO.md` differed, and reusing a version number for changed content breaks the convention that deliveries increment.

---

## V3.65.0 – V3.67.0 — Maktab settings, student setup, derived attendance: deliveries (g), (h), (f) (2026-08-16)

**Files touched:** `worker/migrations/0020_maktab_settings.sql` (new), `worker/migrations/0021_maktab_position.sql` (new), `worker/src/maktabSettings.js` (new), `worker/src/maktabAttendance.js` (new), `worker/src/maktabLog.js`, `worker/src/dhorSchedule.js`, `worker/src/index.js`, `js/maktabSettings.js` (new), `js/maktabSetup.js` (new), `js/logContext.js`, `js/position.js`, `js/maktabDay.js`, `js/maktabSummary.js`, `js/api.js`, `js/auth.js`, `js/app.js`, `index.html`, `js/sw.js`, `css/journal-table.css`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed worker + frontend. Required at upload time: run migrations 0020 and 0021 on hifzhelper-maktab1, then deploy the worker, then the frontend. — 0019/0020/0021 are all RUN as of 2026-08-17; see the MIGRATION STATUS block at the top of this file.**

**(g) Maktab settings.** An admin-only screen holding four settings: the maktab mushaf, the number of students that makes a date a maktab day, the days-without-an-entry that flags a student, and the maktab name. The two numbers were going to be worker environment variables; here they change without a redeploy. Storage is a single row with a constraint that keeps it single, and the migration inserts it, so no code ever handles a "not configured yet" case. The gate is deliberately asymmetric: only admins see or change the screen, but every teacher's cards read the mushaf, so the read is teacher-level and the write is admin-only. This retires the interim 13-line constant introduced in V3.64.1, which was written as one line precisely so this could replace it.

**(h) Maktab position and student setup.** The maktab gets its own position store, mirroring the personal journal's table, so the journal's own Sabaq Dhor logic — lingering rows, rollup level, what has already moved to Dhor — works against maktab state with no changes to the computation itself. V3.64.0 had disabled position in maktab mode because the endpoint is keyed to the login token and would have overwritten the teacher's own row; that skip is now replaced by a real store rather than worked around. The Dhor pool lives in that blob rather than on the student's row, which keeps it maktab-owned. A teacher-accessible setup screen marks a student's completed ajzaa and writes their quarter units as the pool, replacing rather than merging — with a confirmation that names the ajzaa being removed. This also fixes a server-side bug found while tracing Dhor prepop: the worker was reading the student's own pool and mushaf, so maktab Dhor was rotating through her personal journal's pool.

**(f) Derived attendance.** Nothing is stored; every value is computed from the three maktab log tables and the existing haidh marks. A date is a maktab day once enough distinct students have logged; present is assumed; absent means a maktab day with no log and no haidh; and a haidh mark propagates onto later maktab days with no logs until the student's ruling maximum — counted in calendar days, so a fortnight when the maktab doesn't meet still consumes the allowance. Students who go the configured number of maktab days without an entry are flagged on the summary.

Verified 352 across twelve harnesses, including the case that distinguishes calendar-day propagation from maktab-day propagation, which is the only scenario where the two rules disagree.

---

## V3.64.1 — V3.64.0 audited against the three-inputs rule: two defects fixed before release (2026-08-16)

**Files touched:** `js/logContext.js`, `js/maktabDay.js`, `js/commentPrivacy.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/dhorPage.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Frontend-only. Folds into the V3.64.0 delivery — V3.64.0 was never uploaded.**

Audited against the rule that the personal journal feeds the maktab exactly three things — a sabaq_to extension, haidh days, and notes/tadabbur shown in that day's record — and found two failures.

The notes input was dead. The shared notes block read a dataset attribute that nothing ever set, so a student's note never reached the maktab record; the fetch existed in V3.63.0 and was dropped in the rewrite, leaving the read behind. The day view now fetches the student's non-private note per type for the day being logged, before the cards render, into a context-held carrier that clears with the context like every other per-student value.

The bigger one: eight `apiGetProfile()` calls across the three cards. That endpoint answers "whose?" from the auth token, so in maktab mode the student's card was using the *teacher's* mushaf and the *teacher's* Dhor pool — a fourth input, from the wrong person. Profile reads now follow the context: unchanged in the personal journal, and in maktab mode the maktab's own values. Per the design the maktab picks one mushaf for all its students on a settings screen that doesn't exist yet, so the interim is 13-line, held as a single named constant the settings screen will retire. The Dhor pool is empty in maktab mode rather than the teacher's, which the coming maktab student setup will fill by marking completed ajzaa.

Tadabbur is still not surfaced in maktab mode — half of the third input — left deliberately and flagged rather than quietly counted as done.

Verified 271 green, with new checks asserting that the personal profile passes through untouched, that the own-only endpoint is never called in maktab mode, and that the student's note actually reaches the card — the bug the previous harness missed by passing a note in directly instead of exercising the real path.

---

## V3.64.0 — The maktab day view IS the PJ day view (reuse, not copy) (2026-08-16)

**Files touched:** `js/logContext.js` (new), `js/maktabDay.js`, `js/maktabSummary.js`, `js/commentPrivacy.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/dhorPage.js`, `js/position.js`, `js/app.js`, `index.html`, `js/sw.js`, `css/journal-table.css`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Frontend-only — no worker change. Load order matters: `logContext.js` must come after `api.js` and before the page modules (already wired in index.html and the SW cache list).**

Two previous attempts hand-built maktab cards and both drifted from the personal journal immediately. This replaces them with reuse: tapping a student on the maktab summary opens the PJ's own day view — same rail, same dots, same three cards, same verse pickers, Lines/Pages, Tajweed, date pill, History, Timer, duplicate-confirm and edit popup — pointed at a different student and the maktab tables through a new context module.

PJ mode is the default and unchanged: `logClient('sabaq')` *is* `apiSabaq`, and saves still carry no student id because the worker infers it from the auth token. Maktab mode swaps in student-scoped clients, so none of the 16 routed call sites in the three page modules knows the difference. Position and the upcoming-plans queue are skipped in maktab mode rather than faked — both are keyed off the auth token and would otherwise have written the teacher's own rows while they logged a student.

Only two things inside the shared cards are maktab-specific: a student-name row carrying the yellow haidh toggle (hidden entirely in PJ mode), and the shared notes block gaining a teacher side — teacher note above with three small visibility radios, the student's note below, read-only, shown only when one exists. The old maktab day screen, its rail markup, and every rule that styled the hand-built cards were deleted rather than left behind.

The real hazard of sharing a screen is shared module state, so leaving the day view drops the context on any navigation away, and the harness asserts the full round trip — maktab, back to the personal journal, then maktab for a *different* student — proving reads return to the right tables and no student identity survives. Verified 259 green, including a static guard over every routed call site (a mistyped type string would return undefined and surface only in the live journal).

One thing left as the PJ has it: the Timer and History buttons appear on maktab cards too, with History correctly showing that student's maktab history.

---

## V3.63.0 — Date pill on the PJ's own grid; haidh as a yellow toggle, no banner (2026-08-16)

**Files touched:** `worker/src/attendance.js`, `js/api.js`, `js/maktabSummary.js`, `js/maktabDay.js`, `css/journal-table.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed — deploy the worker first (`attendance.js` gains a teacher override the frontend now relies on).**

The date pill is now constrained the way the PJ constrains its own: `.card-date-row` is a `grid` with `auto 1fr` columns, so a `width: 100%` pill sizes to its content inside the auto column. V3.61.1 had instead overridden the shared wrapper and indented the row by a hardcoded 7% that duplicated the haidh column's share — both hacks deleted in favour of the same grid.

The haidh banner is gone. Haidh now reads as one thing on both surfaces: a small icon, bright yellow when marked, in the summary's leading column and beside the student's name on each day-view card — and it's a toggle in both places. Marking routes through the existing shared flow, so the 15-day guard and its confirmed wording apply wherever it's used; un-ticking clears the day back to unset rather than writing "absent", since absence is a different claim and the maktab derives it anyway.

Tracing that toggle's date and student through both paths surfaced two silent wrong-row bugs, neither of which would have thrown: `handleDeleteAttendance` hardcoded `auth.id`, so a teacher clearing a student's mark would have cleared their own day — it now takes the same teacher override `handleSetAttendance` has always had; and the mark flow hardcoded today, so marking from a past-day summary (possible since the date picker arrived in V3.61.0) would have marked today instead.

Verified 252 across the suite, including the picker regression as a permanent check: toggling on marks the date on screen, toggling off clears that date and never writes "absent", no banner exists anywhere, and both retired CSS hacks are asserted absent rather than merely overridden.

---

## V3.62.0 — Maktab day view rebuilt as a true copy of the PJ day view (2026-08-16)

**Files touched:** `index.html`, `js/maktabDay.js`, `css/journal-table.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Frontend-only — no worker change. Ships together with V3.61.1 (summary alignment + date pill), which was built but never delivered.**

V3.61.0 borrowed the PJ's card chrome but kept its own stacked container, so the maktab day view had no swipe rail, no dots, and no responsive grid — not the copy that was asked for. Rebuilt on the PJ's actual structure: a static dots row and `#maktabDayRail` holding three `.log-detail-card` elements, mirroring `#screen-logDetail`. Every layout behaviour then comes free from the existing `detail-pages.css`: one card per screen with scroll-snap swiping on mobile, two-up on tablet, and the full three-card grid at 1180px with the dots hidden — none of it re-implemented in maktab CSS.

Dot navigation is copied from `logDetailScreen.js` in behaviour, including its V3.18.0 fix (compare `getBoundingClientRect` edges, never `offsetLeft`, because `#appContent`'s `translateZ(0)` makes it the offsetParent). The card contents keep every rule agreed in V3.61.0: student name as the first row, PJ header row with the Save button, teacher note above a read-only student note, small visibility radios, no Tadabbur card, no Mark-haidh control. Two stated judgement calls: the haidh banner repeats on all three cards, since each card saves independently and saving overwrites the mark; the tadabbur strip appears once, being context rather than a save consequence. The dead `.maktab-day-card` wrapper and its CSS went with the old container.

Verified 41/41 in the day-view harness — three `.log-detail-card` children of the rail, name-first-row plus PJ header on every card, cards mapping to sabaq/sabaqDhor/dhor in order, dot clicks scrolling the rail (the active-dot state is layout-derived and jsdom computes no layout, so the wiring is asserted and the limitation noted in the check), banner 3x, strip 1x. Full suite 247 green.

---

## V3.61.1 — Maktab summary: header/column alignment + date pill (2026-08-16)

**Files touched:** `css/journal-table.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Frontend-only — no worker change.**

Two defects reported from the device, both introduced by V3.61.0. The summary header stopped lining up with its rows: the PJ's flex header and table body align only because the header's four nth-child percentages happen to match a four-column auto-layout table, and the maktab grid now has five columns — so the date column's 20% landed on the narrow haidh column and the fifth column got no rule at all. Fixed at the cause: one set of percentages (7/21/24/24/24, summing to 100) now drives both the header cells and the table columns, with `table-layout: fixed` so the table obeys them instead of sizing to content.

The date also stretched the full width — it's the shared date pill, whose wrapper is `width: 100%` by design for the PJ cards' full-width slots. Constrained to fit-content here, with the top row indented by the haidh column's own share so the pill sits over the Student column and the close icon stays right.

Alignment is CSS, which the jsdom harness can't lay out, so the checks assert what actually broke: all five columns carry an explicit width on both sides, the two sets match column-for-column, they sum to 100%, the table is fixed-layout, and the date wrapper is fit-content. Suite: 243 green.

---

## V3.61.0 — Maktab UI round from device screenshots: haidh gating, date picker, PJ-format cards (2026-08-16)

**Files touched:** `worker/src/maktabLog.js`, `js/maktabSummary.js`, `js/maktabDay.js`, `index.html`, `js/sw.js`, `css/journal-table.css`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed worker + frontend; deploy worker first (one roster column added). Requires the V3.60.0 worker already deployed and migration 0019 run.**

Haidh options now appear only for students who opted into haidh tracking (the global rule) — the shipped e2 showed the control on every row, including ADMIN-01, which is how a stray haidh mark landed on that account (clearable from the PJ Haidh calendar). The roster carries `track_haidh`; the summary's haidh control moved to a narrow leading column — a small haidh-icon checkbox lining up on the extreme left, empty cell for everyone else so the grid stays aligned.

The summary's date now sits in line with the close icon as a real date picker (the V3.50.1 native-input pattern, whose value-setter interception handles programmatic sets — a first draft invented a refresh event that doesn't exist and was caught by reading `customDate.js` before relying on it). Picking a past date re-renders that day's grid, and the date follows all the way through: row-tap, day-view heading, prepop, PJ note/haidh/tadabbur lookups, and the save itself — backfill and corrections on past days now work end to end.

The day-view cards were rebuilt in the PJ log-card chrome (`.log-detail-card`, header icon + title + header Save), with the student's name as the first row of each card. The Mark-haidh button left the day view — marking lives only on the summary column now; the informational banner stays, gated. The teacher's note sits above the student's note; visibility is three compact radios on one slim line (Public / Teachers / Private, Teachers default); and the student's note is view-only, rendered only when a non-private PJ note exists for that day, frozen into the save exactly as displayed. Every superseded V3.60.0 CSS rule was deleted rather than left behind.

Verified 236 across the suite, including: leading-column gating both ways, the picker's date landing in the row-tap param, all three cards carrying the PJ chrome with the name first, DOM order of the two notes asserted, the radio driving the save payload, and a full past-date scenario keyed on 2026-08-01.

---

## V3.60.0 — Maktab delivery (e2): teacher day view, prepop, write path (+ the V3.59.1 fix) (2026-08-16)

**Files touched:** `worker/src/maktabLog.js`, `worker/src/dhorSchedule.js`, `worker/src/index.js`, `js/api.js`, `js/maktabDay.js` (new), `js/maktabSummary.js`, `js/maktabJournal.js`, `index.html`, `js/sw.js`, `css/journal-table.css`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed worker + frontend; deploy worker first. One zip carrying both V3.59.1 (the fix) and V3.60.0 (e2), confirmed in chat.**

**V3.59.1 first:** the summary screen crashed ("Loading…" stuck, `TypeError` on `data.sabaq`) because the V3.59.0 frontend assumed a `{data:...}` envelope that the worker's `respond()` unwraps — the body IS the payload. Both e1 screens fixed and shape-guarded (a malformed response now renders the error row); the Maktab Journal had the same bug in quieter form, silently showing "No maktab entries yet". The harness stubs had encoded the same wrong assumption — corrected to the wire shape, with the reported crash kept as a permanent regression check.

**e2:** tapping a summary row now opens the real day view — the student's name above three prepopulated cards. Sabaq prepops from the maktab's own frontier (the PJ's pure functions reused), with the one agreed PJ amendment: the student's PJ sabaq may only ever extend `sabaq_to`, proven including the juz'-30 descending-direction case. Sabaq Dhor carries the last maktab zone; Dhor prepops via a new `GET /maktab/dhor-default-entry` — `computeDefaultDhorEntry` gained `{table, includePlans}` options (maktab history, no plans) with PJ callers proven unchanged. A non-private PJ note for today prepopulates the student-note field; a public tadabbur shows as a read-only strip; an empty PJ is a first-class normal case, proven to render clean. Teacher haidh entry lands on both agreed surfaces — a day-view button and a summary-row control — through one shared flow: the re-activated `POST /attendance`, with the 15-day min-gap guard (from `haidhRules.js`) and the exact confirmed popup wording; OK marks haidh, Cancel marks absent. The summary also now shows "Haidh" in a no-log row and the roster carries `mushaf` for the day view's ref (the profile endpoint is own-only by design). Entry fields are plain inputs by deliberate choice — the PJ's verse-ref pickers are coupled to PJ page state, and threading a second consumer through them is the mode-flag risk the spec ruled out.

Verified 30/30 (e2) + 22 (corrected e1) + 176 regression = 228: prepop across six sabaq scenarios, both PJ-richness extremes of the day view, the haidh flow's three branches with the wording asserted verbatim, save payload assembly, and the worker variant with the PJ's plans-win path re-proven.

Still (f), the last delivery: haidh propagation across maktab days, thereafter-absent, the ≥N maktab-day rule, and the 30-day attention flag.

---

## V3.59.0 — Maktab delivery (e1): summary screen, student Maktab Journal, read paths (2026-08-15)

**Files touched:** `worker/src/maktabLog.js`, `worker/src/logHelpers.js`, `worker/src/index.js`, `js/api.js`, `js/auth.js`, `js/app.js`, `js/maktabSummary.js` (new), `js/maktabJournal.js` (new), `index.html`, `js/sw.js`, `css/journal-table.css`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY. Mixed worker + frontend. Deploy worker first (pure addition — one new GET endpoint, one export); the frontend calls it on the new screens. Requires migration 0019 already run.**

The first visible maktab surface. Teachers (and admins) gain a "Maktab" nav item: today's Hifz day at a glance — one row per active student, Sabaq | Sabaq Dhor | Dhor cells in the same shorthand as the PJ journal, whole row tapping through to the student's day view (a placeholder until (e2) delivers the real 3-card entry screen). Everyone gains "Maktab Journal": a read-only view of their own teacher-confirmed maktab record, separate from the PJ journal by design.

Backend: one new `GET /maktab/summary?date=` (teacher+) returning the active-student roster (id+name only — the admin list stays admin-gated for a reason) plus all three tables' rows for the date in one response; a roster-only endpoint per the original spec would have forced 1+3-per-student requests, so it was folded in (documented deviation). Privacy runs on summary rows exactly as everywhere else — proven in the harness: one teacher's `private` feedback is nulled for another teacher and visible to its author.

Verified 22/22: worker gating/shape/date-filter/privacy plus jsdom over the real new frontend modules (roster rows, PJ cell formats, badge downgrade to non-interactive text, whole-row tap routing with the student's id, XSS-safe name rendering, read-only journal with zero buttons) and the real auth.js nav block across all three roles. Full prior suite re-run green — 198 checks this round.

---

## V3.58.0 — Maktab delivery (d): worker endpoints for the three maktab logs (2026-08-15)

**Files touched:** `worker/src/maktabLog.js` (new), `worker/src/index.js`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY — from V3.57.0 onward, deliveries go to the maktab repo/worker/DB alone; the personal deployment stopped at V3.56.0 (see TODO.md's fork note). Worker-only — no frontend changes. DEPLOY ORDER: migration 0019 must be RUN on hifzhelper-maktab1 first; these endpoints 500 against a DB without the maktab tables. Deploy maktabLog.js and index.js together — index.js imports from the new file.**

Twelve endpoints — GET/POST/PATCH/DELETE for `/maktab/sabaq`, `/maktab/sabaq-dhor`, `/maktab/dhor` — in one module with a per-table config map rather than three near-clone files (the PJ modules differ in fields/validation; the maktab versions share everything else, so three files would be pure duplication).

The rules as agreed: all writes require teacher-or-above; a save requires an explicit `student_id` and rejects self-recitation for everyone including admins (another teacher must confirm); any teacher can edit or delete any maktab log — `teacher_id`/`teacher_name` are provenance (snapshot at save), not an ownership lock, and are immutable on edit; a student can GET their own maktab logs only, with the existing privacy layer hiding `teachers_only` teacher notes from them. Saves are a direct INSERT (the reflections V3.51.2 precedent — `insertLog` can't write the NOT NULL provenance pair) with duplicate detection on content fields only, so the same recitation confirmed by two different teachers still triggers the duplicate confirm. A save resolves a haidh conflict with a *targeted* update (haidh/predicted-haidh → present) — it never writes new rows into the PJ's attendance, which keeps reflecting PJ activity; maktab attendance itself is derived at read time (delivery (f)).

Verified against the real 0019 tables (created by executing the actual migration file) and real handlers: 36/36 — the full role matrix, self-recitation edges, the snapshot, cross-teacher duplicates + force, the targeted haidh overwrite (absent rows untouched, no rows created), note stamping (student's note to the student, teacher's to the teacher), privacy on GET proven from both sides, provenance surviving a PATCH that explicitly tried to overwrite it, and the dhor lap_times round-trip. All four prior worker harnesses re-run green — 147 checks this round.

---

## V3.57.0 — Maktab delivery (c): migration 0019, the three maktab tables (2026-08-15)

**Files touched:** `worker/migrations/0019_maktab_tables.sql` (new), `SCHEMA.md`, `TODO.md`, `CHANGELOG.md`. **MAKTAB DEPLOYMENT ONLY (corrected same day — originally said both DBs; the personal deployment stopped at V3.56.0 and never gets maktab tables or code). Migration + docs only. The migration must be RUN, one statement at a time in the D1 console, on hifzhelper-maktab1 — a delivered migration file is not a run migration. Purely additive (three CREATE TABLEs, nothing existing touched, nothing reads them until delivery (d)), safe to run any time — but (d) will fail against a DB where it hasn't been run.**

The first maktab-specific schema — where the PJ and the Maktab start differentiating. `maktab_sabaq_log`, `maktab_sabaq_dhor_log`, `maktab_dhor_log`: each mirrors its PJ counterpart's full current column set (assembled from the real migration history, not the stale 0005 snapshot), plus `teacher_id` (the confirming teacher — a students-table row) and `teacher_name` (a deliberate snapshot: provenance reads as it was when confirmed). One agreed default divergence: `teacher_feedback_visibility` defaults to `'teachers_only'` here versus the PJ's `'all'`. The no-self-recitation rule is deliberately NOT a CHECK — it's an auth rule for the endpoints (delivery (d)).

Verified in node:sqlite with the comparison side built by replaying the actual migration files: 26/26 — every PJ column present with matching type on all three tables, exactly the two agreed extras (both NOT NULL), the `teachers_only` default proven by insertion (PJ's `all` confirmed untouched), all CHECKs enforced, and the file confirmed to split into exactly three statements for the console process.

---

## V3.56.0 — Lost-note bug fix + Maktab delivery (b): PJ notes private by default (2026-08-15)

**Files touched:** `worker/src/sabaqLog.js`, `worker/src/sabaqDhorLog.js`, `worker/src/dhorLog.js`, `js/commentPrivacy.js`, `SCHEMA.md`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **Mixed delivery: worker AND frontend. Deploy worker first — the fix is pure addition and safe against the old frontend, but old worker + new frontend would keep dropping notes on fresh saves.**

The bug, pre-existing on all three activity logs: a note typed on a brand-new entry was silently lost. The frontend payload has always carried `student_comment` + `student_comment_private`, but the save handlers never read either — `insertLog` writes only `FIELDS`, which rightly excludes them. Notes only survived when added by editing an existing entry. Fixed by having each save handler, after a successful insert, write the note + flag onto the fresh row via `updateLog`'s existing special-case branch. Deliberately NOT fixed by adding the columns to `FIELDS` — that list also drives duplicate detection, and identical content with a different note is still the same recitation logged twice (verified: such saves still trigger the duplicate confirm). Note-only trigger: a flag with no note protects nothing, so note-less rows stay completely clean, no stamp noise.

Delivery (b): the Private checkbox on the note block now defaults to CHECKED for new entries; existing entries keep their stored value untouched, and existing rows in the DB are left exactly as-is (confirmed). The `DEFAULT 0` in the DDL was deliberately not changed — SQLite would need a full rebuild of all three log tables for a default no code path reaches now — documented as dead in SCHEMA.md instead.

Verified against the real handlers (node:sqlite) + the real `commentPrivacy.js` (jsdom): 18/18 — notes/flags/stamps landing on fresh saves for all three logs, explicit-false flag as 0, clean note-less rows, duplicate detection proven unaffected, forced duplicates keep their note, edit path regression, and the three frontend default states. V3.54.0 (22) and V3.55.0 (45) harnesses re-run green on the same worker files.

---

## V3.55.0 — Maktab delivery (a): `isTeacherOrAbove` refactor (2026-08-15)

**Files touched:** `worker/src/utils.js`, `worker/src/attendance.js`, `worker/src/dhorLog.js`, `worker/src/plans.js`, `worker/src/position.js`, `worker/src/reflections.js`, `worker/src/sabaqDhorLog.js`, `worker/src/sabaqLog.js`, `TODO.md`, `CHANGELOG.md`. **Worker-only — no frontend changes, nothing to bump on that side. Deploy the worker files; same manual, non-atomic, file-by-file process as always. Deploy `utils.js` FIRST or together — every other touched file imports the new helper from it and would fail to load against an old `utils.js`.**

First of the six maktab deliveries laid out in TODO.md's design entry. Roles are now a strict hierarchy (student < teacher < admin) rather than independent flags: a new `isTeacherOrAbove(auth)` helper in `utils.js` replaces every literal `auth.role === 'teacher'` / `!== 'teacher'` permission gate in the worker — 12 sites across 7 files — so an admin passes all of them. Previously an admin failed every one.

**This is a live behaviour change, not a no-op:** an admin can now do everything a teacher can against the existing app — save into another student's PJ, read their logs/plans/position/attendance. Low risk today (ADMIN-01 bootstrap account, no real users) but real. Deliberately left as-is: `admin.js`'s `requireAdmin` (admin-only screens stay admin-only — the hierarchy runs one way) and its role-value validator, and `js/auth.js`'s admin-nav gate.

Verified with a `node:sqlite` simulation driving the real refactored handlers with student/teacher/admin auth against another student's data: 45/45 — every GET gate returns 403 for a student and passes teacher and admin identically; every POST gate confirms which `student_id` the row actually lands on (student's foreign id silently ignored → own; teacher's honoured; admin's now honoured); a student's own-data access unchanged; helper edge cases (null/undefined/unknown role → false). Every touched module confirmed to import cleanly. V3.54.0's 22-check harness on the same files re-run green.

---

## V3.54.0 — Attendance stays in sync with edited/deleted log dates (2026-08-15)

**Files touched:** `worker/src/logHelpers.js`, `worker/src/dhorLog.js`, `worker/src/sabaqLog.js`, `worker/src/sabaqDhorLog.js`, `TODO.md`, `CHANGELOG.md`. **Worker-only — no frontend files changed, nothing to bump on that side. Deploy the worker files; same manual, non-atomic, file-by-file process as always.**

Editing a Sabaq/Sabaq Dhor/Dhor log's date, or deleting one entirely, previously left attendance untouched — a date a log moved away from stayed marked present with nothing left to justify it, and the date it moved onto didn't get marked at all. Fixed with two new shared helpers in `logHelpers.js`: `releaseAttendanceIfNoActivity` checks all three log tables for the date before reverting it (so a day with more than one entry on it correctly stays present when only one of them moves or is deleted), and `markAttendancePresent` marks the new date present unconditionally — same "log wins" rule as a fresh save, including overwriting an existing haidh mark there.

Both `updateLog` and `deleteLog` gained an opt-in `trackAttendance` parameter (default off) rather than doing this unconditionally, specifically because `reflections.js` (Tadabbur) shares these exact same two functions and is deliberately exempt from the attendance rule — confirmed by reading it, not assumed. Only the three activity logs' update/delete handlers pass `true`; reflections needed zero changes.

One accepted limitation: if a log had briefly overwritten a genuine haidh mark and later moves or is deleted with nothing else that day, the date reverts to unset, not back to haidh — there's no stored history to restore from.

Verified with a real `node:sqlite` simulation of the actual schema (pulled from the live `FIELDS` constants, not the original migration — sabaq_log/sabaq_dhor_log have both evolved columns since), driving the real exported handlers end to end: 22/22, covering same-day-sibling protection on both edit and delete, reverting to unset with no sibling, overwriting a haidh mark, reflections staying untouched on both edit and delete, a non-date edit leaving attendance alone, and a malformed date neither crashing nor writing anything bogus.

Found while testing, unrelated, not fixed here: `updateLog` writes an unvalidated date straight into the log row itself (pre-existing, only reachable via a direct API call, not the frontend's date picker) — flagged in TODO.md.

---

## V3.53.2 — Lap list moved down + taller, fits ~10 rows (2026-08-15)

**Files touched:** `js/session-timer.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.** Frontend-only — no worker deploy. CSS only — no JS/markup changes.

Follow-up on V3.53.1's centring fix, from a second screenshot: only 6 laps were visible before scrolling, and simply growing `.laps` taller wasn't the whole fix — it was `top:50%` + `translateY(-50%)`, centred on `.dial`, so a taller box would have grown upward into the icon row just as much as down.

Row height back-calculated from what was actually on screen (6 full rows in 168px → 24px/row, confirmed exactly: 6×24 + 5×4px row-gap + 4px padding = 168), then reapplied for 10 rows: 280px. `.laps` now anchors at a fixed `top:24px` instead of centring — a small, deliberate step down from the ring's own inset, and a stable point that only grows downward as laps are recorded rather than re-centring (and shifting) on every new lap.

Re-verified against the real `session-timer.js` in jsdom: 29/29, unchanged since this round is CSS-only too. The 280px figure and the room-to-grow-into below it are traced against this file's own documented section heights, not live-rendered — worth a look to confirm the fit lands as intended.

---

## V3.53.1 — Maximised-timer layout fixes from a device screenshot (2026-08-15)

**Files touched:** `js/session-timer.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.** Frontend-only — no worker deploy. CSS only — no JS/markup changes.

Follow-up on V3.53.0's lap-list-beside-the-ring layout, from a real device screenshot showing four issues. The ring wasn't actually centred — `.dial`'s `justify-content:center` was centring the laps+ring group as a unit, not the ring alone, so the ring's true centre sat well right of the card's centre once a 140px column was attached to its left. Fixed by pulling `.laps` out of the flex flow entirely (`position:absolute`, pinned left, vertically centred against the ring) so the ring goes back to being the only thing that gets centred.

The gap between "Lap N" and its time was too wide — a `1fr` grid column was stretching to fill the full 140px regardless of how short the label text is. `.laps` is now the grid itself, with content-sized columns, and each row is `display:contents` so it joins that one shared grid directly — tighter, and columns stay aligned even once lap counts run to two digits.

The Start/Stop and LAP controls were clustered near the top with dead space below — `margin-top:auto` on the LAP button now pushes it and Start/Stop down to fill the leftover height, while the ring and icon row stay where they were. The gap between LAP and Start/Stop was widened (`padding-top` 6px → 18px).

Re-verified against the real `session-timer.js` in jsdom (wake-lock state machine + all-laps rendering, unaffected since this round is CSS-only): 29/29, unchanged from V3.53.0. Layout itself isn't harness-checkable — worth a fresh screenshot to confirm the centring and spacing actually land as intended.

---

## V3.53.0 — Journal→Summary rename, timer wake lock, full lap list (2026-08-15)

**Files touched:** `js/auth.js`, `js/session-timer.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.** Frontend-only — no worker deploy.

Three small, independent items, spec agreed earlier this session (full spec in TODO.md's now-closed V3.53.0 entry). The nav dropdown and Home tiles now read "Summary" instead of "Journal" — a single label edit in the shared `NAV_ITEMS` array, since both surfaces already draw from it; every other "journal" string in the app (Settings, PIN hints, account-duplicate dialogs) was confirmed out of scope and stays as-is.

The maximised timer now holds a screen wake lock — but only while actually running, not just while maximised; pausing releases it even if the timer stays full-screen, and it re-acquires automatically if the OS silently drops it while the app is backgrounded. Feature-detected throughout, so it's a silent no-op on anything that doesn't support the API.

The maximised timer's lap list is no longer capped at 4 — every lap now renders, in a scrollable column beside the ring (ring sized down ~20% to make room) rather than below the LAP button, where in practice there'd rarely been more than one row's worth of space for it anyway.

Verified against the real `session-timer.js` (jsdom, mocked `navigator.wakeLock`): the request/release state machine across every start/pause/stop/reset/mode-change path, a race where pause lands before an in-flight request resolves (caught by the harness, fixed — the late sentinel is now released rather than kept), visibilitychange re-acquisition after a simulated browser-forced release, graceful no-op on a browser without the API, and the lap list rendering all entries with correct numbering — 29/29.

---

## V3.52.0 — Tadabbur gets the popup editor (2026-08-15)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/reflectionCard.js`, `js/logDetailScreen.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.** Frontend-only — no worker deploy.

The pencil in Tadabbur History now opens the same edit popup the three log cards use, instead of the original silent behaviour (quietly loading the entry into the main form — which read as "nothing happens"). Same experience throughout: "Edit Tadabbur" beside the editable date pill, the X as Cancel, Confirm changes gating Save, and a red Delete with the usual warning — deletion included, which Tadabbur's editor never offered before. The main form's quick today-flow and the tap-to-read view are untouched.

Under the hood, the edit-mode styling was generalized so it covers Tadabbur's different card type — and the test suite caught a subtle specificity regression that generalization initially introduced (log cards in the popup would have regained their full-screen height formula), fixed before shipping with explicitly-ranked selectors. Verified by driving the real Tadabbur card through the full load → edit → confirm → cancel cycle plus all five earlier harnesses: 153 checks this round.

---

## V3.51.2 — Tadabbur saves fixed; two companion regressions repaired (2026-08-15)

**Files touched:** `worker/src/reflections.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos. DEPLOY ORDER: worker file first (or everything together) — the 500 lives server-side.**

Saving a Tadabbur entry has been failing with "Internal error" since V3.45.15: the shared log inserter unconditionally writes an `is_duplicate` column that the three activity logs have and the reflections table never did — reproduced exactly by running the real worker handler against the real production schema in a simulated database, and fixed by giving reflections its own direct insert (the honest design too, since reflections deliberately has no duplicate concept — one per day, updated in place). The same simulation surfaced a second regression: the V3.44.1 update whitelist had been clobbered out of the file by a later delivery, so backdating an existing reflection silently discarded the date change — restored, and the backdate test now proves the row actually moves.

Third, the console TypeError: the haidh ruling hint element was written to by the Settings code since V3.39 but never existed in the markup. The crash it caused was killing the Settings render mid-function — silently leaving the haidh cycle, period and next-expected fields blank instead of loading saved values, which a save could then overwrite. The element now exists, the render completes, and the hint shows the selected ruling's day cap. Verified with the bug-exposing simulation re-run green plus all five earlier harnesses: 143 checks this round.

---

## V3.51.1 — Edit popup: desktop legibility, cleaner heading, distinct Save (2026-08-15)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/sabaqDhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.** Frontend-only.

Ten fixes from desktop testing of the new edit popup. The illegible narrow strip is gone — the card was keeping its rail sizing (30% max-width on desktop) inside the popup, now neutralized — and the popup caps at about three-quarters of the screen height. The heading is simply "Edit Sabaq" / "Edit Sabaq Dhor" / "Edit Dhor" beside the date control, without the grey band, and the X sits pinned in the popup's top-right corner. The empty row that used to sit under the heading (the card's own date row, dateless once its control relocates) is hidden, closing the gap. The bottombar's grey band is gone too, Delete has more room above it, and an activated Save is now visually distinct from the confirmed button beside it — white with a green border, leaving solid green unique to "Changes confirmed".

The Sabaq Dhor edit now truly shows only From/To: the quarter rows aren't rendered at all while editing (they return on cancel), rather than being CSS-hidden — the original hide had lost a specificity fight, and hiding only some of a shared grid's children would have scrambled the surviving rows' columns anyway. The "Confirm Sabaq Dhor" group label hides in edit too. Verified with 18 new checks — including running the real section renderer through normal → edit → normal and watching the quarter rows leave and return with the manual fields intact — plus all four earlier harnesses re-run green: 137/137.

---

## V3.51.0 — Edit screens become popups; dates and portions editable; Confirm-changes flow (2026-08-14)

**Files touched:** `worker/src/sabaqLog.js`, `worker/src/sabaqDhorLog.js`, `worker/src/dhorLog.js`, `index.html`, `css/detail-pages.css`, `js/logDetailScreen.js`, `js/dhorPage.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos. DEPLOY ORDER MATTERS: upload the three worker files first (or everything together) — the old worker silently drops the new `date` field, so deploying the frontend alone would make date edits look like they worked while saving nothing.**

Editing an entry now opens as a popup over the app, History-style, instead of taking over the whole screen — the card itself moves into the overlay and back, so every live field keeps working, and a placeholder keeps its slot so nothing shifts beneath. Tapping outside deliberately does not close it; the X in the heading is Cancel. The heading reads "Editing <type> entry for" followed by the entry's real date in the card's own date control — fully editable at last, on all three cards (previously Dhor showed the wrong date entirely, and Sabaq/Sabaq Dhor silently discarded date changes on save; the worker now accepts date on update, via a separate whitelist so the create path's positional field mapping stays untouched).

Portions are editable too. Dhor shows its real Quarter/Half/Juz pill, Juz picker and position switch, prepopulated from the stored segment — decomposed into the label triple and re-emitted in your current mushaf's system (they map one-to-one across systems, per the design discussion; saving re-stamps the entry's ref accordingly). Only plan-path raw ranges that don't reduce to a clean quarter/half/juz remain view-only, in a greyed box. Sabaq Dhor's range edits through its manual From/To pickers, prepopulated — ayah-level, so reference systems don't come into it. Sabaq's range was always in its form.

The old icon bar (Cancel/Delete/Update) and the edit-mode confirm checkboxes are gone, replaced by the confirmed flow: **Confirm changes** stays grey until anything differs from the loaded entry, turns green when something does, and goes solid green with reversed text once tapped — at which point **Save** activates. Any further change drops back to unconfirmed, so Save always saves exactly what was confirmed. The red **Delete** below keeps its existing pop-up confirmation. History popups are now titled per card ("Sabaq History", "Dhor History", …). The Quarter/Half/Juz pill also regained its breathing room above the Juz row (a V3.50.2 side-effect).

Verified with 37 new checks — the decompose maths including a cross-system round-trip, the popup enter/exit cycle, the full Confirm/Save state machine, and every markup, CSS and worker contract — plus all three earlier harnesses re-run green against the changed files: 119/119 in total.

---

## V3.50.2 — Tadabbur header rework; Dhor and Sabaq UI adjustments (2026-08-14)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/dhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.**

Tadabbur's Save and the floating X-to-Home stopped competing for the same corner: Save now sits in a title group directly after the heading — the position the timer occupies on the other cards — and the heading itself moved left, with the icon column now hugging the icon instead of holding a fixed 10% width. The header's right side keeps a small spacer reserving the X's corner. On the three log cards, the timer icon grew slightly (20→24px) and sits slightly further right of the heading.

The Dhor card got its confirmed adjustment set: the Plan button moved to the bottom of the card below Notes, at 30% width, left-aligned, keeping its look; the vacated row now follows Sabaq and Sabaq Dhor's own date-row layout exactly — date pill left, History button right, same sizing — replacing the bespoke three-column row, with its History button finally named "Dhor History" like every other card's. The Quarter/Half pill sits slightly lower, its third option now reads "Juz" instead of "Full" (display only — the internal value and all logic are untouched, verified), and the "Juz" label above the picker is gone along with the invisible placeholder that existed only to match its height, so both controls rise together. The confirm checkboxes on both Dhor and Sabaq nudged right, widening their gap from the controls beside them.

Verified with jsdom against the real files — 27 new checks — and, since this touched markup the two previous releases depend on, both earlier harnesses were re-run green against the changed files: the confirm-checkbox relocation suite (28/28) and the date-wiring suite (31/31), 86/86 in all. Frontend-only deploy; upload the same zip to both repos.

---

## V3.50.1 — Date pickers fixed on iOS; date displays unified as pills (2026-08-14)

**Files touched:** `js/customDate.js`, `css/detail-pages.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos.**

The date selector on Sabaq, Sabaq Dhor, and Dhor stopped opening on iOS — root cause outside this codebase: `showPicker()` for date inputs has never been implemented on iOS (WebKit bug 268114, still open), and the method *exists but silently does nothing*, so the code's focus-and-click fallback — which only ran when `showPicker` was missing or threw — never fired. Tadabbur alone kept working by accident: its date field arrived six days after the custom date display was written and was never wired into it, leaving a bare native input — which is precisely the pattern that works. The fix makes that the design: the invisible native input now sits on top as the actual tap target, so every tap is a direct tap on a real date input, which iOS opens reliably and always has. The visible display underneath is purely visual — an aria-hidden span rather than a button, with the input carrying the accessible label and a keyboard-focus ring drawn on the pill beside it. The click handler and every `showPicker` path are deleted outright, not kept as a fallback.

Two styling directions confirmed from the Tadabbur screenshot ship with it: all four cards' date displays are now pills (fully rounded, borderless, the iOS-native neutral grey the user preferred over the bordered box), and all four show the app's own "Fri 14-Aug" format — Tadabbur included, now that it's wired in, trading its browser-native "14 Aug 2026" wording for consistency with the rest. Verified with a jsdom harness running the real rewritten `customDate.js` against the real `index.html`: 31/31 checks across wiring, accessibility contract, programmatic-set and change-event re-rendering, and the CSS tap-target inversion. Frontend-only deploy; upload the same zip to both repos.

---

## V3.50.0 — Confirm-selection checkboxes joined to the Sabaq Dhor pattern (2026-08-12)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/dhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`. **One identical set for both repos** — upload this same zip to the original and the personal repo.

Sabaq's and Dhor's "Confirm selection" checkboxes now look and sit the way Sabaq Dhor's always have, using the same classes rather than lookalikes. On Sabaq, the standalone labelled checkbox above the fields is gone: "Sabaq from" and "Sabaq to" now live inside one bordered group styled identically to Sabaq Dhor's section group, with a bare checkbox in a `.checkbox-box` beside the To field — same position, same size, same ≥768px enlargement, and mobile keeping the native checkbox size automatically, all inherited from the one shared class (confirmed in chat). The From row keeps the established empty-placeholder column. On Dhor, the checkbox joins the Juz/portion row at its right end. The words "Confirm selection" are dropped on both cards (confirmed in chat); the text survives as each checkbox's aria-label. Behaviour is untouched everywhere: the same hard-block until checked, the same auto-clear after saving, the same ids read by the same save handlers.

One traced subtlety drove the Dhor implementation: the confirm requirement applies to every save path, but the Juz row's whole container hides in plan-range mode (V3.24.0) and edit mode — so the checkbox is one element that relocates through the four existing mode-transition functions: onto the plan-range row's own right end in raw mode, into a small right-aligned holder in the picker's flow position while editing, and back to the Juz row on every exit — carrying its checked state with it, since it's the same DOM node moving. Verified with a jsdom harness loading the real `index.html` and executing the real functions extracted verbatim from the shipped `dhorPage.js`: 28/28 checks, covering placement in all three modes, both round-trips, the checked state surviving relocation, Sabaq's grid landing the checkbox on the To row, and both save handlers' unchanged contracts. Frontend-only deploy, no ordering constraints.

---

## V3.49.0 — Juz Tracker: Free play mode (2026-08-12)

**Files touched:** `index.html`, `js/kaabaTracker.js`, `js/juzTrackerScreen.js`, `css/juzTracker.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A fidget-toy mode for the Kaaba. A "Free play" pill sits in the tracker's header row; the screen always opens in normal tracker mode, and free play is opt-in each visit — nothing about it persists. Selecting it swaps in a blank, unnumbered Kaaba: no juz numbers, nothing pre-marked, and every tile is now tappable — the 30 juz tiles plus the two upper wall rows on both sides — each toggling dark and light on its own. The gold kiswah band becomes its own toy, separately on each side: one tap turns the strip black, a second brings up the gold, a third clears it. The door works the same way as one unit — tap anywhere on it to darken its tiles, again to reveal the gold door, again to clear — whether the tap lands on the tiles or the door graphic itself. While playing, the Save button, saved-status, and the count/progress/Reset bar step aside, since there is nothing to save or count; switching back re-renders the real tracker exactly as it was, because the play state is deliberately kept in throwaway DOM classes and never touches the tracker's own state or the Dhor pool wiring.

Implementation-wise this is a `mode="freeplay"` attribute on the `<kaaba-juz-tracker>` component riding its existing rebuild path, with tracker mode regression-checked as byte-for-byte unchanged. Verified by driving the real custom element in a jsdom harness — real shadow DOM, real click events — through 36 checks covering the markup of both modes, independent tile toggles, both bands' independent 3-state cycles, the door cycling as one unit from either entry point, zero storage writes, and the tracker surviving a full free-play round-trip untouched, plus a rendered visual inspection of all three states. Frontend-only deploy, no ordering constraints.

---

## V3.48.0 — Surahs in my Heart: Eraser (2026-08-11)

**Files touched:** `index.html`, `js/sihScreen.js`, `css/sih.css`, `js/icons.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A third mode next to Solid and Gradient: Eraser. With it active, tapping a coloured surah clears that one region back to white — tapping an already-clear one does nothing. It's a genuine undo-stack citizen rather than a shortcut: erasing pushes one more action onto the same history as a fill, so pressing Undo right after an erase brings the region's previous colour straight back, solid or gradient alike. The colour wheel, lightness slider, and swatches have nothing to offer in this mode, so they step aside for a short "Tap a coloured surah to clear it" hint, and the toolbar's colour indicator swaps to an eraser glyph so it's clear at a glance which mode is active. The surah-name chip still appears on every erase, now with " — cleared" appended.

Nothing about save, export, or the V3.46.0→V3.47.0 picture migration needed special-casing: an erased region is simply "this region's most recent action says no colour," which is exactly how an untouched region already worked, so those code paths carry it for free. The Node harness grew 15 checks against the real shipped engine — no-ops on already-white and already-erased regions, exactly one action per real erase, the chip wording, Undo restoring the precise prior colour, one region's erase never touching a sibling's fill, and the export path handling an erase cleanly — for 43/43 overall.

---

## V3.47.0 — Surahs in my Heart: vector-region engine, letter specks fixed at the root (2026-08-11)

**Files touched:** `index.html`, `js/sihScreen.js` (rewritten), `css/sih.css`, `assets/quran-heart-regions.json` (new), `assets/quran-heart-lines.svg` (new), `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The white specks inside letter counters (the loops of ة، م، ص and so on staying white when their surah was coloured) are gone — not patched, but removed at the root by replacing the pixel flood-fill engine with a vector one ("Option C", chosen in chat over two alternatives after inspecting the master archive and the reference implementation). The scene is now three layers in one SVG: the optional background photo at the bottom; 115 closed region shapes in the middle (one per surah, Ash-Shu'ara in two parts) that are what actually get coloured and tapped; and the original artwork on top, untouched, with its names now sitting *above* the colour so their counters show the region colour through. Two behaviour upgrades came confirmed with the rewrite: tapping a printed surah name now fills its region (names are big natural tap targets), and a small chip appears after each fill naming the surah in Arabic and English, then fades — helpful when zoomed out. Taps landing exactly on boundary lines stay ignored as before, via the new text-free lines asset, which is precisely why the names themselves remain tappable. Zoom is now genuinely vector-crisp at every level: the SVG re-renders at its true size after each gesture instead of scaling a fixed-resolution bitmap.

The region shapes were not taken from the reference site — its tracing measurably wanders around the original lines — but traced from this artwork's own verified segmentation, in its own coordinate frame, dilated to tuck under the linework so adjacent shapes meet beneath the lines. Audited at export resolution with a real SVG rasterizer under the criterion users actually experience: every region 100% covered by its shape, zero foreign colour visible anywhere the artwork's ink doesn't cover, with one documented sub-perceptual anti-aliased pixel at the image's left edge where the artwork itself is clipped by the viewBox. Surah identities were transferred spatially from the reference data as a clean 115-for-115 match and independently confirmed by three glyph anchors (the ص of Sad, the طه of Ta-Ha, and the hyphen of "Al-Anfal"), full surah-number coverage, and a name cross-check against the app's own surah list — the chip uses the app's `surahName(n)` as the single source of truth.

Saved pictures are safe: the save format moves from tap coordinates to region keys, and any picture saved under V3.46.0 migrates silently on first load — the migration was tested against real old-format data, with every action landing on its independently-computed region. Export stays at 1191x1684 as confirmed. A Node harness ran the actual shipped engine against the actual shipped assets: 28/28 checks passed. No worker or migration changes; frontend-only deploy, no ordering constraints — note the two new files land in the existing `assets/` folder.

---

## V3.46.0 — "Surahs in my Heart": the colouring activity (2026-08-11)

**Files touched:** `index.html`, `js/sihScreen.js` (new), `css/sih.css` (new), `assets/quran-heart.svg` (new — **note: new `assets/` folder**), `js/icons.js`, `js/auth.js`, `js/app.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A whole new screen: the user's uploaded anatomical-heart artwork, divided into all 114 labelled surah regions, coloured in by tapping — a relaxation/connection activity as surahs are memorised, deliberately connected to no progress tracking anywhere in the app. Solid fills and two-colour vertical gradients, chosen from a full free colour picker (hue/saturation wheel + lightness slider), with multi-step undo. Pinch/scroll zoom and pan with a Zoom-to-fit reset, since several regions are small. A background image can be added that sits only around the heart (the regions themselves stay opaque), changed or removed separately, and is never persisted. Explicit Save keeps one picture per user on the local device only (no backend involvement at all), restored on the next visit; Reset clears the colours while the last saved picture survives until the next Save — the confirmation says so. Save as PNG exports at the full fixed internal resolution, asking with-or-without background only when a background is actually loaded.

On large screens the heart takes up to 75% of the width with the controls fully expanded in a left-hand panel; on mobile the controls roll up — a slim always-visible toolbar (colour swatch, solid/gradient toggle, undo, zoom-to-fit, menu), with the colour picker and the picture actions each sliding up as a bottom sheet, dismissed by tapping the canvas or the sheet's chevron. New nav entry + Home tile ("Surahs in my Heart", a simple heart glyph in the existing icon style), with undo and zoom-to-fit icons added to the shared set alongside it.

Under the hood, since the artwork's 1,603 paths carry no per-region ids: the SVG is rasterized once at a fixed 1191x1684 internal resolution (the same on every device, so exports are always crisp), every open pixel is labelled into connected regions at load, and a tap paints its whole region into a fill layer, dilated a couple of pixels under the line art so anti-aliased edges never show a white halo. The exterior is the corner-connected region rather than anything touching the border — two real surah regions on the artwork's left edge are clipped by the viewBox and genuinely touch it. All of this was verified directly against the real artwork and the real shipped code (a Node harness ran `js/sihScreen.js` itself against the true rasterized pixels: 21/21 checks — no leaks between surahs, taps on line art / the exterior / text-glyph holes correctly ignored, undo and save/restore byte-identical round-trips), plus a visually inspected composed render. The only change to the artwork file itself is added `width`/`height` attributes on the SVG root, which Safari requires to size an SVG drawn onto a canvas.

---

## V3.45.15 — Genuinely-abortable duplicate confirmation, a real regression fixed, checkbox refined (2026-08-11)

**Files touched:** `worker/src/logHelpers.js`, `worker/src/sabaqLog.js`, `worker/src/dhorLog.js`, `worker/src/sabaqDhorLog.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `js/dhorPage.js`, `css/detail-pages.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Sabaq Dhor's manual field — the checkbox and its From/To ayahs — now correctly clears after a successful save. It was a real regression from V3.45.10: that version's state-preservation logic, built specifically to protect a student's in-progress manual entry across an incidental re-render like a rollup-toggle tap, had no way to tell that case apart from a save just having genuinely completed — so it was faithfully restoring the just-saved values right back onto what should have been a fresh screen. Fixed by explicitly clearing those 3 elements immediately before the post-save re-render runs, so the preservation logic finds nothing left to preserve.

The bigger piece: a duplicate-save confirmation across all 3 log cards that can genuinely be cancelled, not just a warning shown after the fact. The previous shape of duplicate detection always inserted the row regardless, only flagging it afterward — which meant there was never actually anything to abort, since the entry already existed by the time any response reached the browser. `insertLog` now takes a `force` parameter: when it finds a duplicate and isn't told to force through, it returns without touching the database at all. Each of the 3 save handlers checks for exactly that response, shows the specified native confirmation, and either re-sends the same payload with `force: true` or leaves the form untouched if the student cancels. Dhor's own handler needed particular care, since it has a pool-update step that follows the save and must not run until a save has actually happened.

A smaller, more mechanical piece: each of the 3 worker handlers now guards its plan-linking and attendance-marking steps on the insert having actually produced a row — both would otherwise fire against an entry that was never written, since the previous code assumed `insertLog` always returned one.

Verified directly rather than assumed correct: the `insertLog` change against a simulated database covering 5 scenarios (a first entry, a genuinely-blocked duplicate with nothing written, that same content forced through afterward, distinct content passing through unblocked, and the same content from a different student — since the duplicate scope is per-student). And Sabaq Dhor's checkbox gets one further pass on top of V3.45.14's own work — a touch smaller, with breathing room added on its left this time rather than its right.

---

## V3.45.14 — Bigger checkboxes on medium/large, manual field becomes a real From/To range (2026-08-11)

**Files touched:** `css/detail-pages.css`, `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Two independent changes to Sabaq Dhor. The checkbox itself is genuinely bigger now on medium and large screens — `transform: scale(1.8)` on the native input, deliberately not its own width/height, since that specific approach was already found unreliable across browsers earlier in this app's own history. The requested space reduction came along with it: the container itself narrows, and the outer group's own right-edge padding trims down too, together covering both readings of "the space to the right of the checkbox" an annotated screenshot confirmed were meant together, not separately. Mobile is untouched throughout.

The bigger piece: "Set Sabaq Dhor" is no longer a single ayah — it's a real From/To range now, matching the exact shape Sabaq's own card already has. Rather than inventing a new pattern, the 3 functions driving this field were generalized to take the same `side` parameter Sabaq's own picker fields have used since early in this project. The one shared confirmation checkbox sits next to "To" specifically, with "From" getting the same empty placeholder the section rows already use when they have no Move-to-Dhor action of their own — so the grid's shared column structure holds without needing a special case. `compositeCheckedSabaqDhorRows` folds in a genuine 2-point range from this now, rather than the zero-length single-point range it used to build, falling back cleanly (not crashing) if only one side happens to be filled in when the box is checked.

The state-preservation mechanism this screen already depends on — reading the manual field's live values before every rebuild and writing them back after, since this grid's content gets rebuilt from scratch several times during ordinary use — was extended to carry both sides through together rather than just one point. Verified directly against the real function bodies before shipping: 7 checks on the actual generated markup, plus 5 scenarios run against the real composite-range logic itself.

---

## V3.45.13 — Sabaq Dhor large/mobile breakpoint refinement (2026-08-10)

**Files touched:** `css/detail-pages.css`, `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Live checks of V3.45.12 confirmed the medium breakpoint already renders correctly, so this release deliberately leaves 768-1179px untouched and corrects only the 2 affected ranges.

At 1180px and above, the 44px fields were being centred inside grid tracks that had absorbed surplus vertical space, producing large blank areas above and below the first row. The Sabaq Dhor grid now takes its block height from its own content, sizes implicit rows to `max-content`, packs them at the start, and uses the same 4px vertical outer padding as its 4px row gap. This keeps the outer border while collapsing the 3 rows to their intended compact group.

Below 768px, the field column was losing width to an inactive roll-up wrapper and its flex gap, a 44px checkbox track, two 8px grid gaps, and 8px horizontal outer padding. `updateRollupStepperVisibility()` now marks the stepper `.rollup-inactive` when both directions are unavailable; mobile CSS removes only that inactive gutter. The mobile checkbox track becomes 32px wide while remaining 44px high, and the horizontal grid gaps and outer padding become 4px. Together those changes return enough width to the first field to avoid the reported wrap without moving its checkbox inside the field border or changing the medium layout. When a roll-up control is genuinely available, its wrapper remains present and functional.

All CSS/JS references and the inert `js/sw.js` asset list are synchronized at V3.45.13.

---

## V3.45.12 — Sabaq Dhor bordered rows and compact alignment (2026-08-10)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The single outer border introduced in V3.45.11 stays exactly where it is, continuing to group the complete "Confirm Sabaq Dhor" section. Inside that group, the 2 generated quarter fields and the manual surah:ayah picker each regain their own border. Their associated checkboxes remain outside those individual field borders, but inside the outer group border, in the existing fixed 44px checkbox column.

The alignment problem came from the 2 quarter fields being `<label>` elements: they inherited `.detail-page label`'s 16px top margin and 4px bottom margin, while the manual picker is a `<div>` and inherited neither. A scoped `#sabaqDhor_sections > .sabaq-dhor-row-text` rule now resets those margins to zero. All 3 grid rows therefore use only the shared 4px `row-gap`, while their fields and checkbox containers share the same 44px minimum height. The existing shared 3-column grid remains intact, so each checkbox continues moving with its associated field and all checkboxes stay on one vertical line. No JavaScript, save behaviour, or data handling changed.

The release references in `index.html` and the inert `js/sw.js` asset list are now synchronized at `3.45.12`. The uploaded source had `index.html` still at `3.45.10` while `js/sw.js` had already reached `3.45.11`; this release gives every CSS/JS URL one fresh version as required by the project's cache-busting convention.

---

## V3.45.11 — Sabaq Dhor's 3 rows consolidated into one visual group (2026-08-10)

**Files touched:** `css/detail-pages.css`, `js/sabaqDhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

V3.45.10 gave "Quarter 2," "Quarter 1," and "Set Sabaq Dhor" a genuinely shared grid, which fixed their width and left-alignment — but each row still drew its own separate border, and "Set Sabaq Dhor" still carried its own heading above it, both leftovers from when these were 2 separate layout contexts. This version finishes the consolidation: one border wraps all 3 rows as a single group instead of 3 separate boxes, and the second heading comes out entirely, since a single shared border already makes clear on its own that all 3 rows belong to "Confirm Sabaq Dhor."

The spacing fix worth calling out specifically, because it wasn't chased as its own separate change: the previously inconsistent gap before "Set Sabaq Dhor" turned out to be that heading's own inherited top margin, sitting on top of the grid's own row spacing. Once the heading itself was gone, every row transition was left with nothing but that same shared spacing value between it — which the user had already pointed to directly as the amount that looks right. The fix followed from removing the heading; it didn't need its own line of CSS.

One thing worth being precise about: the border removal on the manual field's own picker is scoped specifically to its position inside this grid (`#sabaqDhor_sections > .verse-ref-field`), not a change to `.verse-ref-field` itself, which Sabaq's own From/To fields also use and were never part of this — those keep their own individual border exactly as before.

---

## V3.45.10 — Sabaq Dhor's manual field becomes a genuine part of the shared grid (2026-08-10)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/sabaqDhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

V3.45.9 tried to make "Set Sabaq Dhor" match "Quarter 2"/"Quarter 1" in height and width by matching values across what were still 2 separate layout contexts — and the height fix didn't actually hold up once live. This version takes the architectural fix instead, extending the same principle already proven for the 2 section rows in V3.21.2 (one shared grid, so every column genuinely lines up rather than approximately matching): "Set Sabaq Dhor" is now a genuine 4th part of that same `#sabaqDhor_sections` grid, not a separate row sitting below it.

The real complexity here wasn't the CSS — it was making sure this didn't quietly break something that already worked. That grid's entire content gets rebuilt from scratch 4 separate times during ordinary use (screen load, Move to Dhor, and both rollup-merge/split toggle taps), and moving the manual field inside it meant every one of those triggers would now also wipe out whatever a student had already typed there. The fix: read the manual field's live values immediately before the rebuild, then write them straight back onto the freshly-created elements right after — the exact same rebuild-then-rewire approach this function was already using successfully for the Move-to-Dhor buttons, just extended to one more element instead of invented from scratch. Verified directly against the real function body before shipping, not a reimplementation: 4 scenarios covering a first render, a value surviving one rebuild, a value surviving with its checkbox deliberately left unticked, and a value surviving 2 rebuilds in a row, plus 6 checks on the actual generated markup and operation ordering.

One thing worth being honest about going in: putting all 3 rows in one grid guarantees they share identical column widths, which is what actually fixes the left-alignment and width problems by construction. It does not automatically fix row heights — CSS grid rows still size independently of each other unless something explicitly ties them together, which is exactly why the previous `min-height: 44px` attempt didn't visibly resolve things. That same rule is kept here, now scoped to the field's new position inside the grid, with the underlying reasoning written out in the delivery notes — flagged for a live look given it's already fallen short once.

---

## V3.45.9 — Checkbox boxes hidden, timer icon repositioned, Sabaq Dhor boxes matched (2026-08-10)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

3 refinements to what V3.45.6–V3.45.8 already shipped. The border and background around every checkbox come off entirely — confirmed 3 times over, with the clearest version distinguishing the checkbox's own native border (left completely alone) from the container wrapping it (`.checkbox-box`, the actual target). Its sizing and alignment role — the part that genuinely fixed the earlier cross-browser checkbox-sizing problem — is untouched; only the visible border and background go, and the background was already invisible either way since it matched the surrounding card's own color exactly.

The timer icon on Sabaq/Sabaq Dhor/Dhor's own header rows used to sit in a separate, fixed-width grid column — meaning it always started at roughly the same horizontal position regardless of how short the actual heading text was, creating a visible gap that made it look disconnected rather than reading as one phrase. A new `.card-header-title-group` groups the heading and the timer button into one flex unit instead, so the button's position now genuinely follows wherever the text ends.

Sabaq Dhor's 3 long boxes — the 2 "Confirm Sabaq Dhor" rows and the "Set Sabaq Dhor" picker — now match in both height and width. Height needed an explicit `min-height: 44px` on both (not a hard `height`, since the section rows' own text can wrap to 2 lines on narrower screens and a fixed height would have clipped it). Width needed something more deliberate: an invisible spacer added to the manual row, sharing `.move-to-dhor-btn`'s exact class and text rather than a guessed pixel value, so its width is guaranteed to match the other rows' own 2nd grid column — which, being one shared grid track across both "Confirm Sabaq Dhor" rows, takes up real space even on rows where it's empty.

---

## V3.45.8 — V3.45.7 follow-up: rail-grid fix, Stopwatch cleanup, timer labels, maximized sizing (2026-08-10)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/dhorPage.js`, `js/logDetailScreen.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A live screenshot of V3.45.7's actual result surfaced a real bug alongside 3 refinements. `.log-detail-rail`'s wide-screen grid rule had been left at `repeat(4, 1fr)` — a straightforward miss, not caught when Timer came out of the rail in the previous version. 3 real cards were being squeezed into quarter-width columns each, with the leftover 4th column explaining the large empty gap the screenshot showed. Now `repeat(3, 1fr)`, matching what's actually there.

Dhor's own pre-existing Stopwatch button — which predates V3.45.7's header-icon system entirely — comes out completely: the button, its column, its CSS, and every JS reference across 3 files. It had become straightforwardly redundant with the new header icon. One detail worth being precise about: the old button's target-minutes-per-juz' setup logic didn't just get deleted along with it — it moved into Dhor's own new header-icon handler, since Dhor remains the one card with a genuine target concept of its own that needs setting correctly before the timer opens. Duration itself stays exactly as it was, deliberately not expanded to fill the space — an earlier proposal to do that was explicitly withdrawn.

Every timer icon gets a "Timer" text label now, matching the same icon-on-top, uppercase-label convention the Save button already established — nothing invented, just extended to a new spot. And the maximized timer, which previously just filled the entire viewport unconditionally in both modes, gets a real size and position of its own: 60% of viewport height, centered both horizontally and vertically, width capped at the app's own standard 50%/30% breakpoints. This should also incidentally resolve an earlier report that the timer's own close icon wasn't responding while maximized — it was sitting right at the very top edge, overlapping the device's own status bar, a classic dead-zone scenario. Worth confirming live rather than assuming fixed, but the mechanism that caused it (full-viewport positioning with nothing to keep controls clear of screen edges) is gone either way.

---

## V3.45.7 — Timer relocated to a true, app-wide floating overlay (2026-08-10)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/dhorPage.js`, `js/logDetailScreen.js`, `js/auth.js`, `js/home.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The Dhor timer was, since V3.34, a permanent 4th card in the Sabaq/Sabaq Dhor/Dhor swipe rail — always present, but only reachable by first navigating to that one screen and swiping to it. This version moves it out of the rail and out of the screen it lived inside entirely, to a true sibling of the app's own top-level shell, so it can be opened from anywhere and — the real point of the request — stay visible while running no matter where the student navigates to next.

That last part turned out to already be broken in a subtle way worth being upfront about: the timer's "mini" floating mode already had real `position: fixed` styling, and an existing comment claimed it "floats free... independent of which card is in view." Checked directly before touching anything, and that was only ever true within the log-detail screen itself — a `position: fixed` element is still fully removed from rendering the moment any ancestor gets `display: none`, which is exactly what happens to the entire screen the instant the student navigates anywhere else. The fix isn't a CSS tweak; it's relocating the element itself, which is what most of this delivery is.

`openFloatingTimer()`/`closeFloatingTimer()` (`js/dhorPage.js`) replace the old rail-scrolling logic entirely — every entry point now just un-hides the relocated element directly and sets it to minimized, matching the confirmed default (maximizing stays the student's own deliberate action from there, unchanged). Three new entry points exist now: a timer icon on Sabaq's, Sabaq Dhor's, and Dhor's own header rows specifically (not Tadabbur), plus a dropdown entry and a Home tile, both added the same hardcoded way "Home" itself was — `NAV_ITEMS` is built around navigating to full screens, which this isn't.

One thing that fell out for free rather than needing its own logic: "never hidden while running." Once the timer is outside `showScreen()`'s reach entirely, the only way it's ever hidden again is the explicit Close action — which already resets the session first, every time, so it's never actually possible to end up with a hidden-but-still-running timer in the first place. No event-listening machinery needed for that part at all, just the relocation itself.

---

## V3.45.6 — Checkbox sizing resolved for real (2026-08-10)

**Files touched:** `css/detail-pages.css`, `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

V3.45.5's checkbox sizing fix — explicit `width`/`height` on the native checkboxes themselves — didn't hold up in practice, confirmed via a live screenshot showing the section checkboxes still rendering tiny while a checkbox targeted by the exact same rule right below them rendered correctly. The likely reason: native checkboxes don't always respect explicit dimensions consistently across browsers the way other elements do — a real, known limitation, not something specific to how that one rule was written.

This version sidesteps the problem entirely rather than fighting it further. A new shared `.checkbox-box` class wraps each checkbox in a plain, bordered container — same visual style `.verse-ref-field` already established — sized explicitly at 44×44px. A container element reliably respects CSS sizing regardless of browser; the checkbox inside it stays completely unstyled. The section-row text labels get the same bordered-box treatment for visual consistency, matching an annotated screenshot that specified this precisely.

Alignment needed its own small fix: the section list's checkbox column moves from `auto` to a fixed `44px`, matching `.checkbox-box`'s own width exactly, so it lines up with the manual-selection row's own checkbox-box even though the two sit in genuinely different layout contexts (one inside a CSS grid, one in a plain flex row). The manual field itself gets restructured along the way — the checkbox, which used to live inside the "Set Sabaq Dhor" label itself, moves out into its own boxed container next to the picker, exactly where the screenshot showed it should sit.

---

## V3.45.5 — Sabaq Dhor manual field: rebuilt to match what it actually is (2026-08-10)

**Files touched:** `js/position.js`, `js/sabaqDhorPage.js`, `index.html`, `css/detail-pages.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

V3.45.4 shipped Sabaq Dhor's manual-select field as a persistent override on stored position — set it once, and it would take precedence over the computed frontier until a new Sabaq entry cleared it automatically. Further conversation revealed that was the wrong shape entirely. The field turned out to be something much simpler: a third way to contribute to the exact same composited from/to range Sabaq Dhor's own section checkboxes already build for whichever single entry is about to be saved — nothing about it needs to persist beyond that one save, and it has no bearing whatsoever on Sabaq Dhor's own future "current" position, which continues unconditionally being built from the most recent Sabaq entry regardless of anything ever entered here.

`sabaqDhorManualOverride` comes back out entirely — `js/position.js` no longer stores or clears it, since it no longer exists at all. `compositeCheckedSabaqDhorRows` gets extended instead: when the new checkbox is checked, its surah:ayah point competes in the same earliest-start/latest-end comparison the section checkboxes' own rows already go through, not a separate calculation running alongside it. Verified directly with 5 Node scenarios before delivery, including the specific edge case of the manual value correctly extending an existing section-based range further, and a manual-checked-but-empty case falling back gracefully with no crash.

The checkbox itself is now genuinely passive — the old `#sabaqDhorManualSaveBtn` click handler is gone completely, since there's no longer a separate "save" action for it to trigger. It behaves exactly like the 2 existing "Confirm Sabaq Dhor" checkboxes: no listener of its own, read once, at the moment the card's own Save button is tapped.

Three more confirmed changes land in the same delivery: the manual section now sits below the auto (section-based) one rather than above it; "Set current position manually" becomes "Set Sabaq Dhor," now labeling the checkbox directly rather than sitting above the picker as its own separate label; and "Mark sections revised" becomes "Confirm Sabaq Dhor." A checkbox sizing bug also gets fixed — both `.sabaqDhor-row-cb` and the new checkbox get explicit `20px × 20px` sizing from the app's own `768px` breakpoint up, since neither had any CSS at all before this and was rendering at each browser's own small native default on desktop/tablet. Deliberately scoped by class/id rather than touching `.cb-private-row` globally, since Sabaq's own "Confirm selection" checkbox uses that same class and was already confirmed rendering correctly — changing it globally would have resized something nobody reported as a problem.

---

## V3.45.4 — Sabaq/Sabaq Dhor position rebuilt around real history (2026-08-10)

**Files touched:** `js/position.js`, `js/sabaqPage.js`, `js/sabaqDhorPage.js`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The prepopulation bug from earlier — Sabaq showing 3:160 instead of the expected 3:166, Sabaq Dhor's "current" quarter stuck a full entry behind — got the architectural fix it needed rather than a patch on top of the mechanism that broke. `position.sabaqTo` and `position.activeJuz` are no longer stored anywhere at all. `computeActualSabaqFrontier` (new, `js/position.js`) computes the frontier fresh every time, directly from actual Sabaq history, so there's nothing left to silently desync from what genuinely happened — which is exactly what broke originally, a `savePosition()` call failing silently with zero trace while the Sabaq entry itself saved correctly.

The algorithm went through a real correction mid-design. The first draft tried to determine which juz' was "further along" across a student's whole history, using the same `SABAQ_STUDY_ORDER`-based comparison `advancePositionAfterSabaq` already trusted elsewhere. The user caught a genuine flaw in that: study order is only actually fixed through juz' 30 then 29 — after that, students genuinely diverge, with no single system to code against. The final design sidesteps this entirely rather than trying to solve it: the default frontier is simply whichever Sabaq entry is most recently dated, full stop, no cross-juz' comparison anywhere.

Sabaq Dhor gains a capability it never had before: a manual override, confirmed to visually and structurally match Sabaq's own picker fields exactly, though implemented as its own dedicated set of functions rather than generalizing Sabaq's tightly-coupled existing ones — deliberately, to avoid any risk of regressing Sabaq's own already-working picker in the process. No separate "reset" action exists anywhere for this override — logging a new Sabaq entry clears it automatically, confirmed directly as the intended mechanism.

A real bug in this delivery's own first draft got caught and fixed before it shipped: with `sabaqTo`/`activeJuz` now living only in memory (for the existing row-computation functions, entirely unchanged, to keep reading), naively passing that same in-memory object to `savePosition` at any of several call sites would have accidentally persisted them right back into storage — quietly recreating the exact class of bug this version exists to eliminate. Fixed centrally instead: `savePosition` itself now strips both fields before every write, regardless of what it's handed, so no individual call site needs to remember to do this correctly on its own.

Every row-computation function downstream — `computeLingeringRows`, `computeSabaqDhorRows`, `computeCurrentJuzRows`, `computeSabaqDhorSections`, `computeSabaqDhorSectionsMaqra`, `maybeAutoMoveToDhor` — is completely unchanged. All of it verified directly against the real production code before writing any of this delivery: the actual `shared/data.js` and `js/position.js` loaded into Node, run through the exact originally-reported scenario end-to-end (both Sabaq's prepopulation and Sabaq Dhor's own display independently landing on the correct 3:166/3:165), plus 6 further frontier scenarios and the `savePosition` stripping fix itself.

---

## V3.45.3 — Native confirm() + Settings link to the Juz Tracker (2026-08-09)

**Files touched:** `index.html`, `css/settings.css`, `js/juzTrackerScreen.js`, `js/settingsScreen.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The Juz Tracker's confirmation dialog moves from the custom modal built in V3.45 to a native `confirm()` — a richer, 2-part message that shows both what's about to change and, separately, the complete resulting list of every juz that will be marked complete once saved, grouped 3 per line for readability. `formatJuzListThreePerLine` and `buildJuzConfirmMessage` (`js/juzTrackerScreen.js`) do this work, and both are shared with the Settings "Mark completed Juz" grid, which previously had no confirmation of any kind when closed — now it gets the exact same message, computed the same way. Verified the message-building logic directly against 4 scenarios (marking, un-marking, both together, and the edge case where the resulting list becomes empty) before delivery.

The Settings link to the Juz Tracker — deferred back when the tracker itself was first planned — is in now. The label above the button changes from "Mark completed sections," a leftover from when Surah-based history still existed, to "Mark completed Juz," matching what the button itself already said. A new switch lets the student pick between the visual tracker (the default) and the existing list-style grid, reusing the app's own established switch component rather than building something new — the tracker option is represented by its own icon rather than text, which needed its own explicit sizing since the generic icon-button class it's built from had never carried any sizing rules of its own before this. The existing button's own click handler now checks the switch's current selection and opens whichever method is chosen.

---

## V3.45.2 — Tadabbur card sizing fix (2026-08-09)

**Files touched:** `css/detail-pages.css`, `index.html`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The card-not-filling-available-space issue from V3.45.1 traced back to a genuinely subtle root cause, found by the user rather than guessed at: the flex relationship was broken two levels above `#tadabburCard`, not at the card's own level. `#appContent` never established `display: flex` for its own children, so `#screen-reflections` — and `#tadabburCard` inside it — was never actually forced to fill the space its own `min-height` set aside. Each level's `min-height` happened to be independently viewport-relative, which is exactly why reading any single rule in isolation never revealed a conflict.

Two ways to fix this were on the table. Extending the flex chain properly up through `#appContent` and `.screen` would have worked, but those are shared rules every screen in the app depends on — fixing one card by restructuring what all of them sit on was too much risk for this. The chosen fix stays entirely inside Tadabbur's own card: `#tadabburCard`'s `min-height` becomes `height`, same formula, same values. `#tadabburCard`'s own `display: flex; flex-direction: column` and `#tadabbur_text`'s own `flex: 1; min-height: 0` were correct all along — what was missing was the card having a definite size, not just a minimum, for that already-correct internal relationship to actually distribute space within. `height` alone still lets genuinely long content push the card taller, since nothing here constrains overflow.

---

## V3.45.1 — Tadabbur regression fixes + History (2026-08-09)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/reflectionCard.js`, `js/dhorPage.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Two real regressions from V3.44.1, found via a live screenshot, plus a feature that was missed in that same round.

The date field's invisible-text problem traced back to a genuine gap: `#tadabbur_date` was a plain, unwrapped input, while every other date input in the app (`.card-date-row`, used by Sabaq/Sabaq Dhor/Dhor) gives its input an explicit, fixed height before `wireCustomDateDisplay` wraps it — that wrapping mechanism's own `height: 100%` styling depends entirely on that fixed-height parent existing. Tadabbur's field now sits inside the same `.card-date-row` wrapper as everywhere else, which needed `--dhor-row2-h` (normally supplied by the `.detail-page` class, which this card doesn't carry) defined directly on `#tadabburCard` instead — pulling in the whole `.detail-page` class for one variable would have brought its unrelated label/input/textarea styling along with it, so this was the more surgical fix.

The close button moves out of the header row's own layout entirely and gets pinned to the card's top-right corner with `position: absolute`, the same technique `.modal-card .close-btn` already uses for corner × buttons elsewhere in the app — `#tadabburCard` picked up `position: relative` as the anchor point this needed.

Tadabbur now has a History button, reusing `js/dhorPage.js`'s `renderRecentEntries` — the same function already powering Sabaq, Sabaq Dhor, and Dhor's own history. It gained one new capability for this: an opt-in `onRowClick` parameter, purely additive so the 3 existing callers are entirely unaffected by not passing it. Tapping a history entry's edit-pencil icon loads it into the form for editing, exactly like the other 3 types already work. Tapping the entry's own content instead opens a plain read-only view of the full date and reflection text — new UI that didn't exist anywhere in the app before this, since none of the other 3 types have a row-level tap interaction, only their edit icon. Each row in the list shows the entry's first line, truncated at 60 characters — verified against several edge cases (multi-line text, a very long single line, empty and whitespace-only reflections) before delivery.

One thing intentionally left alone: the reflection textarea still isn't flexing to fill its card the way it's meant to, and this version doesn't claim to have fixed it. The CSS reads correctly and nothing found during this pass explains the mismatch with the live screenshot — rather than guess at a change with no confirmed reason behind it, this stays flagged in `TODO.md` for a closer look, worth rechecking after this delivery in case the surrounding restructuring changed anything incidentally.

---

## V3.45 — Juz Tracker connected to the Dhor pool (2026-08-09)

**Files touched:** `index.html`, `css/juzTracker.css`, `js/juzTrackerScreen.js`, `js/kaabaTracker.js`, `js/app.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The Juz Tracker was, until this version, a self-contained puzzle with no connection to a student's actual memorization data — a full session-only "free play" mode. This connects it to the same Dhor pool (`students.baseline_selection`) the existing Settings picker already reads from and writes to.

**Loading**: `renderJuzTrackerScreen` now runs every time the screen is entered (replacing what used to be a one-time setup function that only ran once at page load), fetching the student's profile and coloring a tile for any juz with all 4 of its quarter-units already present in the pool — the same "complete" rule the existing picker uses, via the same `quarterUnitsForJuz` helper.

**Saving** is a genuinely careful piece, given the real risk of silently corrupting actual memorization progress if this went wrong. Tapping the new Save icon diffs the tracker's current state against what was loaded at entry, and if anything changed, shows a confirmation modal listing exactly what's about to happen — which juz are newly marked complete, which are newly un-marked, both if the same session did both — with OK to proceed or Cancel to go back and adjust. On OK, only the specific juz actually touched get written: their 4 quarter-units added or removed from a freshly re-fetched copy of the pool, leaving every other juz completely untouched. This was a deliberate choice over rebuilding the whole pool from the tracker's current tile state, the way the existing Settings picker does — a full rebuild would have carried the exact same edge-case risk already found in that picker's own code (documented separately, not fixed as part of this): if the tracker's own load ever missed detecting an already-complete juz, saving would silently drop it. The targeted approach sidesteps that entirely rather than reproducing it on a new screen. Verified directly with 4 Node-run scenarios before delivery, including the specific case this whole design exists to protect — a partial juz already in the pool (simulating Sabaq Dhor's own leftover progress, which only ever moves whole juz, never partial ones) stays completely untouched by an unrelated save elsewhere on the tracker.

The header is restructured to match what was asked for specifically on this screen, different from the pattern used everywhere else: a white background instead of the screen's own `--surface-track`, Save sitting immediately next to the "Juz Tracker" heading rather than grouped with Close, and Close pushed separately to the far right.

The sizing problem — the cube running past the bottom of the visible viewport on a wide desktop window, confirmed via 2 screenshots — turned out to require touching `js/kaabaTracker.js` directly rather than the screen's own CSS: the component renders inside a shadow DOM, and its `.kt-svg` styling lives entirely inside that boundary, unreachable from ordinary external stylesheets. A `max-height: 70vh` there now keeps the whole cube visible without scrolling, on any screen size.

No backend changes were needed anywhere in this — `POST /profile` already fully supported writing `baseline_selection`, confirmed by reading the handler directly rather than assuming.

---

## V3.44.1 — Tadabbur redesign (2026-08-09)

**Files touched:** `index.html`, `css/detail-pages.css`, `js/customDate.js`, `js/reflectionCard.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A full redesign of the Tadabbur screen, scoped deliberately to frontend-only work — "no new backend for now" — after the fuller version of this request (an ayah chooser, real hashtag search) turned out to need a new migration and got pushed to a later round.

The header row — icon, "Tadabbur" title, Save, and the close button — moves inside the white card as its first child now, the same structural pattern Sabaq's own `.log-detail-card` already uses, rather than sitting outside the card on the screen's own background. A date field is new (`#tadabbur_date`) — `reflections.date` already existed in the schema, it just wasn't exposed anywhere in the UI before this, so no migration was needed. It's wired the same way Sabaq's date field already works: not a dynamic reload when changed, just "which date this entry is for," read once at save time — which means backdating a reflection now works the same way backdating a Sabaq log already did. The private checkbox moves above the reflection textarea instead of below it, and that textarea now flexes to fill the card (`flex: 1`, bigger 18px text) instead of sitting at a fixed `rows="8"`, which needed the card itself to become a flex column with a real height to grow into.

The card also gets its own width exception — 50%, deliberately not the standard 30/50 rule, staying at 50% even past the `1180px` breakpoint where the shared `.screen-content` class would otherwise narrow it to 30% — more room for long reflection text was the explicit reason. A third named exception now, alongside Journal's 70% and Juz Tracker's full width, each for its own stated reason rather than an arbitrary one.

Caught and fixed during this build: an early edit accidentally deleted `.log-detail-rail`'s own CSS properties while adding a section comment above it. Found and corrected immediately via direct inspection, before anything was delivered.

**Follow-up, same version**: the flagged backend limitation is now resolved too — `worker/src/reflections.js`'s update path can write `date`. This wasn't the simple one-line whitelist edit it first looked like, though: `FIELDS` is shared with the create path, and `insertLog` zips that array with its own `values` array by *position* to build the INSERT statement. Adding `date` there would have left `FIELDS` at 3 items against `values`' still-2, silently misaligning every column after it — caught via direct verification before delivery, not left to be discovered later. Fixed instead with a separate `UPDATE_FIELDS` whitelist used only by the update path, which matches fields by name rather than position, so it doesn't share that risk. Verified directly with a Node simulation of both paths before shipping: the create path is unaffected, and the update path now correctly picks up a `date` key when present.

---

## V3.44 — Core color inversion, content wrappers, breakpoint corrections (2026-08-09)

**Files touched:** `index.html`, `css/tokens.css`, `css/base.css`, `css/settings.css`, `css/admin.css`, `css/haidh.css`, `css/journal-table.css`, `js/auth.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

The full build of the redesign thread that followed V3.43 — a genuine reversal of that release's color assignment, prompted by realizing `.journal-wrap` and each `.settings-section` already occupied the same hierarchical role (a white card of actual content, directly inside its screen), which made it clear the pattern belonged everywhere, not just on Settings.

**The core inversion**: `#appContent` is now `--color-page-bg` (was `--surface-track`); every individual screen is now `--surface-track` (was white). Screens picked up real padding (10px on every side), rounded corners, and their own min-height formula — mirroring `#appContent`'s own, additionally subtracting `#appContent`'s padding via the existing `--appcontent-vpad` token, the same technique already used for Log Detail's cards and the Timer.

A new shared class, `.screen-content` (`css/base.css`), is where the standard "white, 30/50-capped" treatment now lives — white background, the cap, its own padding and radius. Tadabbur, Haidh, and Admin all get a new body-content wrapper using it; Settings' 4 sections switch to it too, replacing the width-cap rule they used to duplicate individually.

**Settings** loses its `--surface-app` special case entirely — it's just another `--surface-track` screen now, no longer different from anything else. `--surface-app` is retired from active use (the token stays defined, nothing references it).

**Journal**'s old negative-margin technique — built to bleed the table to the screen's raw edges — is removed, since it's fundamentally incompatible with the new confirmed exception: `.journal-header-row` and `.journal-wrap` together get a fixed 70% width and center themselves, the same shape as Juz Tracker's existing full-width exemption, rather than following the standard cap a 4-column table doesn't have room for.

**Haidh and Admin** both had the identical, previously-undiscovered gap: their body content sat directly in the screen with no wrapper of its own, relying entirely on a screen-level cap for width control. Haidh's was also where a confirmed rendering bug lived — the calendar spanning the full browser width with no restriction at all on a wide desktop window. Both screens' old screen-level caps are removed, and their content now lives inside its own `.screen-content` wrapper instead, with an explicit width control point that doesn't depend on whatever was going wrong before.

**Three breakpoint corrections**, all converging on the same number: `--appcontent-vpad` and `#appContent`'s own padding both move from 720px to 768px; `#appContent`'s `max-width` (which stays Hifzhelper's own 1400px, not stdstyles' 1280px) moves from 1200px to 1180px. All three now match the `--width-tablet`/`--width-desktop` breakpoints already used everywhere else in the app, rather than three separate systems disagreeing across small windows of viewport width.

**The dropdown menu** gets a "Home" entry, added the same way Refresh and Log Out already were — hardcoded directly rather than added to `NAV_ITEMS`, so it doesn't also duplicate into Home's own tile grid.

One thing deliberately left alone: `#screen-home` still carries its own separate screen-level width cap, the same pattern just removed from Settings, Admin, and Haidh. It was never part of the explicitly-named list this round, so it's untouched rather than assumed — worth a decision on consistency, flagged in `TODO.md`.

---

## V3.43 — `#appContent`/screen architecture, rebased on real V3.41.2 (2026-08-09)

**Files touched:** `index.html`, `css/tokens.css`, `css/base.css`, `css/nav.css`, `css/settings.css`, `css/detail-pages.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Built directly from the real, currently-live V3.41.2 — the user confirmed an earlier V3.42/V3.42.1 pass (from a previous chat session's sandbox) was never actually implemented, and uploaded the genuine current repo to build from instead. Final agreed terminology, after a few rounds of correcting the mapping: `#appContent` (the one persistent wrapper, never swapped) is the user's "screen"; each individual `#screen-home`/`#screen-journal`/`#screen-haidhDetail`/etc. is the user's "container."

**New tokens** (`css/tokens.css`) — `--surface-app: #EBE5D9`, `--surface-track: #A2ABA1`, `--surface-banner: #4A5D4E` (this value was corrected mid-conversation from an earlier `#758976`), `--surface-contrast: #9E83B8`. Plus a new `--appcontent-vpad` helper — mobile `--space-md`, `--space-lg` from 720px, matching `#appContent`'s own existing padding breakpoint exactly — reused below rather than duplicating that condition in multiple places.

**`#appContent`** gets `background: var(--surface-track)` and an explicit `min-height` (`100vh`/`100dvh` minus the auth band). This is mostly making explicit what its existing `flex:1` inside `#appShell`'s flex column already provided implicitly — kept as `min-height`, not a fixed `height`, specifically so genuinely long content can still grow past it and the page scrolls normally, rather than ever clipping.

**Every individual screen is white by default now** (a new `.screen` rule in `css/base.css`, targeting the `class="screen"` already present on every screen section) — including Home, whose olive-specific `#screen-home` background from V3.41.1 is removed entirely, no longer a special case.

**Settings is the one deliberate exception**, confirmed explicitly and then reconfirmed: `#screen-settings` keeps its own distinct `--surface-app` backdrop instead of the universal white, with its 4 sections (Profile, Hifz Setup, Dhor Schedule, Haidh) staying white inside it — a second, nested instance of the same "colored backdrop, white cards" pattern the rest of the app now has one layer up, specific to this one screen. The sections' own background changed from `--palette-sky` to white to match. Settings' existing 30/50 width cap needed no changes at all — it already matched what "containers get the 30/50 rule" was asking for.

**Home's header text is deleted entirely** — just the lavender `home` icon remains in the header row, no `<h2>Home</h2>` at all. The white-heading-text fix from V3.41.1 (needed for contrast against the old olive background) is removed as dead code along with it.

**Log Detail and the Timer both get a height recalibration.** `.log-detail-card` (both its normal and `.editing-active` states) and `#dhorTimerHost` (both its normal and `>=1180px` desktop states) all now also subtract `#appContent`'s own vertical padding from their `height` formulas, via the new `--appcontent-vpad` token. These formulas predate `#appContent` having any explicit sizing of its own, so none of them ever accounted for that padding eating into the available space — without this fix they'd each run past the visible viewport by exactly that amount, which is exactly the class of bug this round was raised to prevent.

---

## V3.41.2 — Home tile, fixed sizing, 30/50 cap, darker border (2026-08-08)

**Files touched:** `js/home.js`, `css/nav.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Four refinements to V3.41.1's Home screen, confirmed against a reference image showing the exact intended look.

**A real "Home" tile**, prepended as the first item inside `#homeGrid` itself — distinct from V3.41.1's header icon, which stays. Deliberately not added to `NAV_ITEMS`, since that would also put it in the dropdown on every other screen, redundant with the X-to-Home buttons already there — hardcoded directly in `renderHomeScreen()` instead, Home-page-only. It's always shown active: a lavender-filled box with a visibly darker lavender-toned border (derived from `--palette-lavender` itself via `color-mix()`, not a new hardcoded color), while the icon and label stay dark ink rather than turning lavender the way the generic cross-screen highlight does elsewhere — a distinct, more specific treatment scoped so it only affects this one tile. No `data-nav` attribute and no click handler, since there's nothing meaningful for a tap to do when you're already on Home, and `showScreen`'s active-highlight loop only ever touches `[data-nav]` elements, so this tile's permanent active state can't be toggled off by it.

**Fixed tile sizing** — `#homeGrid` moves from a stretching CSS grid (`1fr` columns, tiles grew or shrank with the viewport) to `flex-wrap`, with each tile now a constant 76px wide and its icon box a constant 64px square — tiles simply wrap onto a new row if there isn't room, rather than stretching to fill whatever space is available.

**30/50 width cap** — `#screen-home` gets the same tablet/desktop width cap every other capped screen already has; it had simply never been given one.

**Darker tile border** — was `--color-table-border` (which resolves to `--palette-lavender`, `#E3DADE`), barely visible against a white tile. Now `--color-ink-faint` (`#9A9A90`), matching the clearly visible medium-gray outline in the reference image.

---

## V3.41.1 — Home screen redesign: olive/white/lavender, landing page, Progress removed (2026-08-08)

**Files touched:** `index.html`, `js/auth.js`, `js/app.js`, `js/icons.js`, `css/nav.css`, `css/base.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

A full Home screen restructure plus two smaller navigation corrections, confirmed in chat right after V3.41 shipped the first pass at the tile restyle.

**Home's new look** — the screen background is now olive, reusing `--palette-sage` (the exact color the top auth band already uses — no new color introduced). Home gets a real header (a `card-header-row` with a `home` icon, colored lavender) where it previously had only a bare `<h2>`; the heading text itself is now white for contrast against the olive, a necessary follow-on rather than something separately requested. `#homeGrid` becomes its own white container sitting on top of that olive background, with the tiles arranged inside it.

**Tile structure, corrected** — V3.41's restyle put the background/border/shadow chip around the whole tile (icon + label sharing one box). This was structural, not cosmetic, per this round: `js/auth.js`'s `renderNavItemsInto` now wraps each icon in its own `.nav-icon-item-icon` span, separate from the label, and only Home's CSS boxes that icon span specifically — square, white background, thin border, rounded corners, shadow — with the label sitting below it, outside the box, matching a standard phone-home-screen icon convention. The dropdown menu picks up the same new markup but stays visually identical, since the wrapper is neutral by default and only `#homeGrid`'s own rules add the chip look; the Refresh/Log out items (hardcoded outside the shared render function) were updated to the same structure too, for consistency, even though they only ever appear in the dropdown.

**Two corrections to what V3.41 shipped**: the active-screen nav highlight is now lavender instead of evergreen — flagging one thing for a look once live: lavender is a pale color and the dropdown's own background is white, so the contrast there will read soft/subtle rather than bold. Built exactly as specified since it was stated clearly and repeated, but worth confirming it reads the way it's meant to.

**Navigation changes** — Home now replaces Journal as the screen a returning user lands on after login (`bootApp()`, `js/app.js`); a new user with setup still incomplete is unaffected, and Journal remains fully reachable as its own nav item either way. "Progress" (the coming-soon placeholder for the not-yet-built gamified dhor-rings map) is deleted from `NAV_ITEMS` entirely, and its now-orphaned icon definition removed from `js/icons.js` too — confirmed via search to have no other callers anywhere.

---

## V3.41 — X-to-Home everywhere, Home tile restyle, active-nav highlight (2026-08-08)

**Files touched:** `index.html`, `js/app.js`, `js/logDetailScreen.js`, `css/detail-pages.css`, `css/nav.css`, `css/base.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Three related, app-wide navigation additions, confirmed in chat after noticing the app had no dedicated way to leave a screen anywhere — every screen relied on the top dropdown menu alone.

**X-to-Home** — every screen except Home itself (Journal, Log Detail, Admin, Settings, Tadabbur, Haidh, Juz Tracker) now has a close button that always returns to Home, reusing the existing `close` icon throughout rather than introducing a new one. `screen-logDetail` already had a close button (`logDetailClose`) — it went to Journal specifically, by deliberate earlier design (there's no navigation history stack anywhere in the app, so a fixed target was the only option, and Journal was that screen's own "reached-from" page). Confirmed in chat to repoint that one to Home too, for full consistency. Every other close button is wired centrally in `js/app.js`'s own `init()` — they're all identical (same icon, same `showScreen('home')` action), so one loop covers all six rather than repeating the same two lines across six separate files.

Placement varied a lot by screen, since header structure isn't uniform across the app: the three screens with an existing `card-header-row` (Tadabbur, Haidh, Juz Tracker) get the button in that row's right-hand column — Tadabbur already had save controls living there, so a small new `.card-header-right` wrapper holds both side by side rather than the two fighting for the same grid slot. Admin had no header row at all before this (just a bare `<h2>`), so it gets a real one now, reusing the existing `admin` icon. Settings (four independent sections, no single screen-level header) and Journal (its own data-table header, not a card header) both get a small dedicated row at the very top of the screen instead.

**Home tile restyle** — `#homeGrid`'s tiles now read as distinct app icons: a background chip, rounded corners, and a subtle shadow, considerably more visual weight than the plain icon+label style. Scoped specifically to `#homeGrid .nav-icon-item` so the dropdown menu's own tiles — same underlying class — are completely unaffected. CSS only; same tiles, same destinations, same `renderNavItemsInto` markup underneath.

**Active-screen highlight** — whichever screen is currently open gets its own nav icon shown in accent color, in both the dropdown and the Home grid at once, reusing the exact visual language `.log-detail-dots .dot.active` already established rather than inventing a new one (`currentColor` on the icon means a single `color` rule recolors both the icon and its label together). `showScreen` (`js/app.js`) updates this on every navigation call — placed deliberately *after* any screen-specific render, since `renderHomeScreen` rebuilds `#homeGrid`'s entire markup from scratch every time it runs, which would silently wipe an earlier-set highlight.

---

## V3.40.5 — Haidh calendar: width cap, confirm-bar icons, cross-month ranges (2026-08-08)

**Files touched:** `index.html`, `js/haidhDetailScreen.js`, `css/haidh.css`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Three small, independent items, one of them requiring no code change at all.

**Width cap** — `#screen-haidhDetail` gets the app's standard 30%/50% width cap on tablet/desktop (`--width-tablet`/`--width-desktop`, `tokens.css`), the same pattern already used by `#screen-settings`/`#screen-admin`/`.login-card`. It had simply never been given the cap before — unrelated to Juz Tracker's own deliberate full-width exemption, which was a specific opt-out for a different screen.

**Confirm-bar icons** — the confirm/predict button and Cancel both now carry an icon alongside their text. The confirm button reuses the `save` icon (same one Settings' own Haidh section save button already uses, for visual consistency across the feature), added via `innerHTML` alongside its existing dynamic "Confirm as haidh"/"Predict as haidh" text. Cancel reuses `close` (the same icon the Dhor timer already uses for its own discard/cancel action), set once at module load since its label never changes.

**Cross-month range selection** — turned out to already work, verified by tracing every place `haidhRangeStart`/`haidhRangeEnd` are read: none of them, nor `haidhPendingRangeBounds`, `onHaidhCalDayTap`, `renderHaidhRangeBar`, or `onHaidhRangeConfirm`, ever reference which month is currently displayed (`haidhCalViewYear`/`haidhCalViewMonth`) — the pending range is plain date strings throughout. Tapping a day, navigating to a different month via prev/next, and tapping a day there already produces a valid range. No behavior changed; added a comment documenting this as a real requirement so a future edit doesn't accidentally scope range state to the current view.

---

## V3.40.4 — Haidh calendar: confirm/predict as one decision per range (2026-08-08)

**Files touched:** `index.html`, `js/haidhDetailScreen.js`, `shared/haidhRules.js`, `worker/src/attendance.js`, `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Simplifies the marking model, confirmed in chat right after V3.40.3's fixes made the calendar visible again. Previously, a new range's status was decided per date automatically (past/today → `haidh`, future → `predicted-haidh`), so a period starting today and running a few days ahead would end up "today confirmed, the rest predicted" — which doesn't reflect reality once a period has actually started. Now the whole range gets one uniform status, decided once: "confirmed" if it touches today or the past — including transitively, through an adjacent existing mark — and "predicted" only if it's entirely future with no such connection. `evaluateHaidhRange` (`shared/haidhRules.js`) already computed the extended run's start for validation purposes; this reuses that same `runStart` rather than adding parallel logic. `handleMarkHaidhRange` (`worker/src/attendance.js`) now assigns one status to every date in the batch instead of branching per date.

The confirm bar's button reflects this before the student commits — "Confirm as haidh" or "Predict as haidh" instead of a generic "Mark as haidh" — via a new client-side `haidhRangeTouchesPastOrToday()` that mirrors the server's own extension logic using the already-loaded `haidhCalAttendance`. Tapping an already-marked day to clear it needed no changes — that already was, and still is, the correct 2-state toggle for a single day.

Rejection messages (duration cap and gap rule, in both `handleMarkHaidhRange` and `handleSetAttendance` for consistency) now end with "Please revise your history." rather than only stating which rule failed.

The new status-decision logic was verified directly against 5 concrete scenarios before delivery — including the one that matters most: a future range that connects to an existing run touching today correctly becomes confirmed, while a future range merely adjacent to another future-only run correctly stays predicted rather than being wrongly upgraded.

---

## V3.40.3 — Haidh calendar: 3 real bugs, all fixed and verified (2026-08-08)

**Files touched:** `index.html`, `js/haidhDetailScreen.js`, `shared/haidhRules.js`, `worker/src/attendance.js`, `js/sw.js`, `js/juzTrackerScreen.js` (re-included, was missing from the live deploy), `TODO.md`, `CHANGELOG.md`.

Three separate, independently-diagnosed bugs, found over an extended live debugging session (Network tab, DOM inspector, and direct console evaluation on the actual production site) rather than from code review alone — each verified against the real, edited files before this delivery, not just reasoned through.

**The actual reason nothing showed on the calendar:** `loadHaidhCalAttendance` did `const { data } = await apiGetAttendance();` — but `apiGetAttendance()` already resolves directly to the array, since `worker/src/index.js`'s `respond()` always unwraps handler results to `result.data` before sending the HTTP response. There's no extra `.data` wrapper on the client side to destructure. `data` was therefore always `undefined`, and `haidhCalAttendance` was *always* an empty object, regardless of any date computation — confirmed live: `apiGetAttendance()` called directly in the browser console returned the real 17-row array with no wrapper, while `loadHaidhCalAttendance()` called the exact same way still left the object empty. Fixed with a one-line change; grepped the whole frontend for the same destructuring mistake and it's the only occurrence anywhere.

**A second, separate, genuinely real bug this one had been masking:** `renderHaidhCalGrid`'s 3 cell-building loops computed each square's date via `new Date(year, month, day).toISOString().slice(0,10)`. `new Date(y,m,d)` constructs *local* midnight, but `.toISOString()` always converts to UTC — so for any timezone ahead of UTC (the device here is set to South African Standard Time, UTC+2), the computed date silently shifts backward by a day, even though the number printed on the square looks unaffected. Verified directly: `new Date(2026,7,8)` in `Africa/Johannesburg` becomes `"2026-08-07"` after `.toISOString()`, not `"2026-08-08"`. A new `haidhLocalISO()` helper reads the constructed date's own local year/month/day back out directly instead, avoiding the UTC round-trip entirely — correct for any timezone or offset direction. `haidhTodayISO()` (built from `new Date()`, the actual current instant, not a locally-constructed date) and `shared/haidhRules.js`'s `haidhAddDaysISO` (uses `Date.UTC()` explicitly) were never affected by this — it was isolated to this one screen's grid rendering.

**Third, unrelated bug from the "15 days have not passed" report:** `evaluateHaidhRange` validated a proposed range by simulating each date in chronological order, checking the gap rule against only what had been added to a working set so far — so a range directly adjacent to (or overlapping) an already-marked block got wrongly rejected, since the first date checked hadn't "seen" the rest of its own range yet. Rewritten to evaluate the whole proposed range as one unit instead: extend the run outward from the range's own edges using only the true external existing dates, and only gap-check if neither edge touches an existing day. Re-verified against the original 9 scenarios plus 3 covering this exact bug, 12/12 correct, run again directly against the final edited files before delivery. This also resolves the earlier "marking should override predicted" note on its own — the write side (`ON CONFLICT ... DO UPDATE`) already did the right thing; the validation bug was the only thing blocking it. `handleMarkHaidhRange` updated for the function's new single-verdict return shape; `evaluateHaidhMark`/`handleSetAttendance`'s single-day path is untouched and unaffected.

`js/juzTrackerScreen.js` (found missing from the live deploy in the previous session, unrelated to any of the above) is included again here so one upload covers everything currently outstanding.

---

## V3.40.2 — Haidh calendar range-select (2026-08-08)

**Files touched:** `index.html`, `css/haidh.css`, `js/haidhDetailScreen.js`, `js/api.js`, `shared/haidhRules.js`, `worker/src/attendance.js`, `worker/src/index.js`, `TODO.md`, `CHANGELOG.md`.

(User asked for this as "3.40.1" — bumped to 3.40.2 instead since 3.40.1's own files already shipped with different content, and every changed file needs a fresh version string regardless of what the round gets called, per this project's own versioning convention.)

Making a NEW haidh mark is now tap-first/tap-last range-select, replacing the old immediate single-tap-toggle — confirmed in chat, no separate "range select mode" button needed. Tap day 1 sets a pending start (new `.haidh-cal-day-selecting` highlight — a 3rd color, distinct from the existing confirmed/planned shading, so a still-editable selection never looks already-saved). Tap day 2 (same day again = a 1-day range) sets the end and highlights the whole span. Nothing is written until the new confirm bar's "Mark N days as haidh" is pressed — "Cancel" clears the pending selection instead. No minimum range length is enforced (corrected mid-spec by the user — realistic duration is a user-managed judgment call, not something the app validates a floor on; only the existing maximum-duration and gap caps still apply). Tapping an already-confirmed/planned day *outside* of an active selection still clears just that one day directly, unchanged from before — continuity with the original "tap a marked day to clear it," which only ever applied to removing.

**New `POST /attendance/mark-range`** (`worker/src/attendance.js`) is a genuinely atomic batch operation, not N sequential single-day calls — confirmed in chat: an invalid range must reject the whole batch, marking nothing. It fetches the student's existing haidh/predicted-haidh dates *outside* the proposed range, then validates every date *inside* the range in chronological order via a new `evaluateHaidhRange` (`shared/haidhRules.js`), which reuses `evaluateHaidhMark`'s exact existing per-date run-length/gap math by simulating adding each date to a growing working set — no duplicated validation logic, same single source of truth the rest of the Haidh caps already use. The very first date that would exceed the ruling's duration cap or violate the 15-day gap rule fails the whole request before anything is written; a fully valid range is then written in one `env.DB.batch()` call for genuine atomicity. Verified directly against 9 scenarios before considering this done: plain short ranges, exactly-at-cap and over-cap, a range that only becomes invalid once merged with an adjacent *existing* run (not just the new dates alone), both a gap violation and a gap-OK case, and both rulings.

**`apiSetAttendance`** (`js/api.js`) removed — its only caller was the old single-tap immediate-mark path this replaces. Backend `handleSetAttendance` and its route are deliberately untouched: that's the separately PARKED "attendance" decision in `TODO.md` (present/absent marking for a future teacher view), not something this change resolves.

---

## V3.40.1 — Juz Tracker button removal + Settings Haidh redesign + a real calendar bug fix (2026-08-08)

**Files touched:** `index.html`, `css/juzTracker.css`, `css/settings.css`, `js/settingsScreen.js`, `js/haidhDetailScreen.js`, `js/juzTrackerScreen.js` (new), `js/sw.js`, `TODO.md`, `CHANGELOG.md`.

Three independent pieces of a "Haidh mods" + "Juz Tracker deletions" ask, all previously spec'd and documented in `TODO.md` before any code was touched, per the standing process rule. A 4th piece from the same ask — the Haidh calendar's tap-first/tap-last range-select and its highlight state — is deliberately NOT in this release; it was already flagged as "not yet designed in detail," and guessing at the interaction model felt wrong for something that writes real haidh data. Left open in `TODO.md` with the specific questions that need answering first.

**Juz Tracker** (`index.html`, `css/juzTracker.css`, `js/juzTrackerScreen.js` new) — both "Download SVG" and "Mark next juz" removed; marking a juz now only happens by tapping the tiles themselves, which was always wired independently of the control bar anyway. `js/kaabaTracker.js`'s `controls` attribute turned out to be all-or-nothing (`"full"` or `"none"`), so keeping the progress bar and Reset meant giving up the component's own built-in bar entirely and hand-building those two pieces instead — a small new file wires `juz-change` to a plain count/fill-bar readout and `el.reset()` to the Reset button, styled with the app's own tokens rather than the component's baked-in palette (which lives in its own Shadow DOM regardless).

**Settings Haidh section** (`index.html`, `css/settings.css`, `js/settingsScreen.js`) — heading text becomes "Haaidha", with the existing `#haaidha_checkbox` moved inline into the heading row itself (wrapped together in one `<label>`, so tapping the heading text also toggles it) — same element id throughout, so its save-on-change listener in `js/settingsScreen.js` needed no changes. The Ruling switch (Hanafi/Shafi'i) moves out of the label+input `.settings-row` pattern into its own centered row at 75% width — this incidentally fixes a real, visible bug: it was previously squeezed into `.switch-track-small`, a fixed-72px class built for the 2-letter M/F gender switch elsewhere, which is why "Shafi'i" was rendering as "Sha". `#haidhRulingHint` ("Hanafi: haidh cannot exceed 10 days.") is removed entirely — the element, and both places `js/settingsScreen.js` populated it via the now-also-removed `HAIDH_RULING_HINTS` lookup — this is UI copy only; the actual 10/15-day caps remain enforced server-side in `worker/src/profile.js`, untouched. The "Plans will be adjusted..." description paragraph moves from the top of the section to right after the Ruling row. The 3 numeric/date input rows get a shared `min-height` (`#section-haidh .settings-row`) so they're no longer uneven — 2 of the 3 labels wrap to 2 lines on mobile widths and 1 doesn't.

**Haidh calendar, real bug found and fixed** (`js/haidhDetailScreen.js`) — the prev/next month buttons were already correctly wired to `shiftHaidhCalMonth(-1/1)`, and `css/haidh.css` already had rotation rules ready for an icon (`.haidh-cal-prev svg`/`.haidh-cal-next svg`), but nothing anywhere had ever actually injected one — the buttons were fully functional but completely invisible, not just unstyled. Fixed with `iconHtml('chevronDown')` on both, matching the rotation the CSS was always built for.

---

## V3.40 — Juz Tracker, Phase 1 (free play) (2026-08-08)

**Files touched:** `index.html`, `js/icons.js`, `js/auth.js`, `js/app.js`, `js/kaabaTracker.js` (new), `css/juzTracker.css` (new), `js/sw.js`, `CHANGELOG.md`.

Full spec gathered over several rounds in chat before any code was touched, per the standing process rule. A new nav item + screen embeds the user-supplied `<kaaba-juz-tracker>` custom element (an isometric Kaaba cube, 30 clickable tiles mapped 1:1 to juz 1–30) exactly as uploaded, dropped in verbatim as `js/kaabaTracker.js`.

**Nav placement** — `NAV_ITEMS` (`js/auth.js`) already drives both the dropdown menu and the Home grid from one array (`renderNavItemsInto`), so one entry gives both surfaces automatically, same as every other item — placed between Progress and Settings. No student/teacher gating: confirmed in chat that the whole app is personal-to-user today and the Maktab/teacher phase hasn't started, so there's nothing to condition on yet.

**Icon** (`js/icons.js`) — no user-supplied SVG this round (the uploaded component's own art is full puzzle artwork, not nav-icon-sized), so this is Lucide's standard "box" icon adapted to a simple line cube, plus one short accent line for the kiswah band, matching the file's existing viewBox-only/stroke-only format.

**Free play behavior, confirmed in chat:** no `persist` attribute on the element, so nothing is ever written to localStorage or the backend — Phase 1 is a fully standalone toy. Progress resets whenever the app itself reloads, but stays put if you navigate to another screen and back within the same session (matches the component's own natural in-memory state — no extra reset logic needed). Amiri, which the component auto-loads from Google Fonts, was kept at its default.

**Sizing, added to scope mid-build:** the screen deliberately opts OUT of the app-wide 30%/50% max-width cap (`--width-tablet`/`--width-desktop`, tokens.css) that `#screen-admin`/`#screen-settings`/`.log-detail-card` use — the puzzle takes the full screen width at every breakpoint instead, bounded only by `#appContent`'s own existing padding and its 1400px cap at ≥1200px. `css/juzTracker.css` (new) adds top/left/right padding around the puzzle only, no bottom — best reading of how the request was phrased; flag if that's wrong. The component's own SVG already scales to 100% of its container width with `height:auto`, so no extra responsive CSS was needed for that part.

**`js/sw.js`, found while touching it for this release's own version bump:** its `ASSETS` list had fallen behind `index.html` — still missing `css/haidh.css`, `shared/haidhRules.js`, and `js/haidhDetailScreen.js` from V3.39. Brought back in sync and bumped to v3.40 along with this release's own new files. This service worker is still not registered anywhere (confirmed inert, same as before), so this was a no-behavior-change consistency fix, not a live bug fix.

---

## V3.39 — Haidh tracking (2026-08-07)

**Files touched:** `index.html`, `css/tokens.css`, `css/journal-table.css`, `css/haidh.css` (new), `js/icons.js`, `js/auth.js`, `js/app.js`, `js/settingsScreen.js`, `js/journal.js`, `js/haidhDetailScreen.js` (new), `shared/haidhRules.js` (new), `worker/src/attendance.js`, `worker/src/profile.js`, `worker/migrations/0018_haidh_ruling.sql` (new), `SCHEMA.md`.

Full spec worked out over several rounds in chat before any code was touched (per the standing "gather the full spec, wait for the explicit build phrase" process rule) — most of the backend groundwork turned out to already exist (the `attendance` table's `haidh`/`predicted-haidh` statuses, `handleGetAttendance`/`handleSetAttendance`/`handleDeleteAttendance`/`handlePredictHaidh`, `track_haidh`, `haidh_cycle_length`/`haidh_period_length`/`haidh_next_expected`), just never wired to any UI. This delivery is mostly wiring that up, plus two genuinely new pieces (the ruling selector, the two validation caps).

**Purpose, confirmed in chat after an initial wrong path (deleting logs on haidh days) was caught and corrected:** haidh tracking exists to account for days with no logs — in a Maktab/attendance context a haidh tag means the student isn't counted absent; in the personal diary, when measuring compliance against a logging plan, haidh days count as compliant even with nothing logged. **No log is ever deleted, and nothing on the Sabaq/Sabaq Dhor/Dhor detail cards changes** — haidh marking only ever touches the `attendance` table.

**Setup's Haidh section** (`index.html`, `js/settingsScreen.js`) gets three additions: a "Haaidha" checkbox (plain checkbox, `.cb-private-row` — same convention as the existing Confirm-selection/Private checkboxes elsewhere), writing straight to `track_haidh` via its own `apiSaveProfile` call the instant it's toggled — deliberately outside the section's own Save button (confirmed in chat: "will not require a separate save"), then immediately refreshing both nav surfaces (home grid + dropdown) so the new "Haidh" nav item appears without a reload. A Hanafi/Shafi'i ruling switch (same `switch-track`/`wireSwitch` component gender's switch already uses), defaulting to Hanafi when unset rather than blocking. And the two existing prediction fields relabeled for clarity — "Cycle length" → "Haidh cycle frequency", "Duration" → "How many haidh days per cycle".

**Two caps, both confirmed in chat over several rounds of sense-checking the actual numbers:** a continuous haidh run can't exceed the student's ruling (10 days Hanafi / 15 Shafi'i), and a new run can't start until 15 days have passed since the last one. Two subtleties that took real back-and-forth to pin down, both live in `shared/haidhRules.js` (loaded as a plain script for the frontend and a CommonJS module for the Worker, same dual-loading pattern `shared/data.js` already established, per CONVENTIONS.md's single-source-of-truth principle — Setup's client-side pre-check and the backend's real check use the exact same numbers, never two copies):
- The numbers actually enforced in code are offset by one calendar day from what's shown to the student (11/16 continuous days, 14-day gap instead of 15) — a clinically-N-day haidh can legitimately touch N+1 calendar dates when it starts or ends mid-day, so the code's boundary is deliberately one day looser than the spoken rule. The wording shown to the student never changes.
- "Haidh cycle frequency"'s real minimum isn't a flat 15 — cycle length stays the clinically-standard start-to-start definition, so the actual floor is `duration + 15`, computed per student (`haidhMinCycleFrequency`). Both the standalone range check AND this cross-field combination are validated at Setup-save time (`worker/src/profile.js`) — a 10-day duration with a 23-day frequency fails even though 10 and 23 each pass their own individual check, since the resulting gap (13 days) is short of 15.

**The Haidh calendar** (`js/haidhDetailScreen.js`, new screen `screen-haidhDetail`) — month-by-month paging rather than free scroll. Tapping an unmarked day marks it (a future date as `predicted-haidh`, today-or-past directly as `haidh`); tapping a marked day clears it. Predicted days render in a lighter shade (`--color-haidh-soft`) than confirmed ones, EXCEPT a predicted day that's already in the past renders full-shade — the auto-confirm rule ("not confirmed + no log = confirmed") is evaluated lazily/on the fly here, not via any stored state change or background job. The two caps are enforced server-side only; this screen just surfaces whatever error string comes back rather than duplicating the run/gap-scanning logic in two places. Reachable from the new "Haidh" nav item (shown only once `track_haidh` is true — no separate gender check needed, since a male student's `track_haidh` can never become true through the normal Setup UI) or from the journal (below).

**Journal integration** (`js/journal.js`) — a date with a haidh mark and nothing logged shows static text, "Haidh - log sabaq/dhor to cancel", in that row's Sabaq column only — no checkbox, no confirm/clear gesture (an earlier design with a tap-to-confirm/two-taps-to-clear checkbox was replaced with this simpler static version, confirmed in chat). Identical wording whether the day is still upcoming or already resolved — logging any entry, even backfilled after the date has passed, still cancels haidh for that day; there's no locked-in/final state. If ANY of the three log types exist for that date, haidh is cancelled outright and the row renders completely normally, no haidh mention anywhere. Attendance is fetched once per journal load, only for students with `track_haidh` set (skips a pointless call for everyone else).

**Icon** — the user-supplied Lucide `badge-alert` SVG, added to `js/icons.js` in this codebase's existing viewBox-only format (no baked-in width/height). Reused as-is at the two sizes already governed by existing CSS (`#homeGrid .nav-icon-item svg` at 36px for the nav tile, `.card-header-icon svg` at 22px for the calendar screen's own header) — no second icon file, no new sizing CSS needed.

**Color** — `--color-haidh`/`--color-haidh-soft` added to `css/tokens.css`, reusing the existing Mauve palette color rather than introducing a new raw hex (this file's own "every color is a variable" rule).

**Migration 0018** adds `haidh_ruling` (`hanafi`/`shafii`, `NOT NULL DEFAULT 'hanafi'`) — safe as a same-transaction default backfill, no separate data migration needed.

---

## V3.38 — IndoPak terminology picker and Surah baseline mode removed (2026-08-07)

**Files touched:** `index.html`, `css/settings.css`, `js/dhorPage.js`, `js/sabaqDhorPage.js`, `js/sabaqPage.js`, `js/settingsScreen.js`, `worker/src/profile.js`, `worker/src/dhorSchedule.js`, `worker/migrations/0017_drop_indopak_terminology_and_baseline_mode.sql` (new), `SCHEMA.md`.

Two features removed entirely, on hold, per the standing process rule (delete unused code promptly rather than leave it parked — no dependent users yet, so no back-compat risk):

**IndoPak's Maqra/Rub'/Hizb terminology picker** (confirmed in chat: "putting the hybrid build on hold"). Removed from the UI (`indopakTerminologyRow`, `index.html`), and from all 4 copies of `refForMushaf`/`refForMushafSabaqDhor`/`refForMushafSabaq` (`js/dhorPage.js`, `js/sabaqDhorPage.js`, `js/sabaqPage.js`, `js/settingsScreen.js`) — each drops its now-unused `indopakTerminology` parameter and the `mushaf==='15line_indopak' && indopakTerminology==='maqra_rub_hizb'` branch, back to the simple `mushaf==='15line_madani' ? 'uthmani' : 'waterval'`. IndoPak is Quarter/Half only now, same as 13-line, natively (unaffected by this: Madani's own Ru'b/Hizb terminology from V3.37, which never depended on this picker).

**Surah-based Hifz Setup history** (confirmed in chat: "History will only be collected as juz"). The Juz'/Surah switch (`section_grid_switch`) collapses to a single "Mark completed Juz" button (`css/settings.css`'s new `.settings-action-btn`, since `.switch-option` assumes a `.switch-track` parent and sliding thumb that no longer exist here) — `openSectionGridModal` drops its `mode` parameter entirely, `renderBaselineSummary` drops the Surah branch, `baselineMode` is gone as a concept. `worker/src/dhorSchedule.js`'s two `baseline_mode !== 'juz'` guards are removed as redundant — the `pool.length === 0` check right after each already covers "nothing set up," and Surah mode was never actually wired into Dhor Schedule generation to begin with (it always returned "no pool").

**Both DB columns dropped**, not just left unused (confirmed in chat: "let's do it properly and remove the columns") — `indopak_terminology` and `baseline_mode`, migration 0017. Both are safe to drop directly under SQLite 3.35.0+ (no table-rebuild needed): `indopak_terminology` has no constraint at all, and `baseline_mode`'s CHECK is inline/column-own, which SQLite drops along with the column. No real users yet, so this is a mechanical change, not a data migration — but deploy order still matters, since deploys here aren't atomic: **the code in this delivery must go live before migration 0017 runs**, not after, or the still-live old code will start erroring on every profile read/save the moment the columns are gone.

**Found and fixed while sweeping for dangling references** (not spotted until grepping the whole repo, not just the touched files): 3 call sites (`js/sabaqDhorPage.js`'s `moveRowToDhor`, `js/dhorPage.js`'s Dhor-save pool update, `js/sabaqPage.js`'s auto-move-to-Dhor) were still sending `baseline_mode: 'juz'` in their `apiSaveProfile` payloads — harmless once the backend stopped reading that field, but genuinely dead code, cleaned up. Also a dangling `#section_grid_switch` CSS selector (updated to `#openJuzGridBtn`) and the now-dead `.grid-surah` CSS rule (removed).

`SCHEMA.md` updated to match — both column rows removed/updated.

---

**Files touched:** `shared/data.js`, `js/position.js`, `js/dhorPage.js`, `js/sabaqDhorPage.js`, `js/sabaqPage.js`, `js/settingsScreen.js`, `js/journal.js`, `index.html`, `sw.js`.

**Sabaq Dhor row ordering** ("4321 for all", confirmed in chat): completed rows now read most-recent-first everywhere they appear -- the base Quarter/Rub' sort in `computeCurrentJuzRows`, the Maqra branch, the Half/Full merge (Second Half now processed before First Half), `computeLingeringRows`, and the leftover-unmerged-quarters fallback. Root mechanism: `computeSabaqDhorSections` already returns completed sections in descending order; the code was explicitly re-sorting them ascending before display -- that explicit re-sort (and its 3 counterparts) is what flipped. Caught and fixed a real bug while testing this directly: a standalone completed quarter next to a merged half (e.g. Q1+Q2 merged, Q3 standalone) was landing after the merge regardless of actual recency, since the original 2-pass shape ("process pairs, then push leftover singles") always pushed leftovers last. Rewritten as a single descending walk (4→1) that consumes both members of a pair together when it merges -- verified correct for every mix of merged/standalone quarters via direct testing, not just the common cases.

**Sabaq Dhor's Maqra/Rub' behavior** (confirmed in chat, from screenshots): Maqra only ever describes the ONE Rub' currently in progress -- it has no bearing on Dhor at all, and isn't a new merge concept. The moment that Rub' completes (both its Maqras done), it renders through the exact same, unchanged Quarter/Rub-level row logic every completed Quarter always used (same chevron rollup, same `canMoveToDhor` rule) -- not a parallel implementation. Concretely: `computeCurrentJuzRows`'s `'maqras'` branch now gets the normal Quarter/Rub-level sections first, renders every already-complete Rub' through a new shared `buildIndividualCompletedRows` helper (also used by the plain `'quarters'` branch -- one implementation, not two), and only breaks the CURRENT Rub' into its Maqra sub-rows. Verified end to end against both of the user's own worked examples (`Maqra 4, Maqra 3, Ru'b 1` and `Maqra 5, Rub 2, Rub 1`) via direct testing, exact match both times.

**Ru'b/Hizb terminology** (V3.37's original spec, TODO.md): Madani's Dhor switch, Sabaq Dhor's row labels, `describeDhorSegment`, `quarterUnitLabel`, and Plan Dhor's per-Juz' rows all now say "Ru'b"/"Hizb" instead of "Quarter"/"Half" whenever `ref==='uthmani'` -- confirmed spelling "Ru'b" (apostrophe after the U), not "Rub'". Hizb specifically drops the "Juz X" prefix entirely and uses a new standalone global 1-60 number (`shared/data.js`'s `globalHizbNumber`, `(juz-1)*2+halfIndex`) -- a real structural difference from Half's per-Juz' display, not a word-swap, confirmed in chat. Rub' stays per-Juz' like Quarter always was. New shared helpers `quarterUnitWord(ref)`/`globalHizbNumber(juz, halfIndex)` in `shared/data.js`, used by both `js/position.js` and `js/dhorPage.js` rather than each maintaining its own copy. **Flagged, not separately confirmed in chat:** the single-letter abbreviation used in condensed labels (`describeDhorSegment`/`quarterUnitLabel`) is "R" for Rub' (e.g. "Juz 4 R2"), matching the existing "Q"/"H" style -- easy one-line change if a different letter is wanted. This also finishes IndoPak's own Maqra/Rub'/Hizb picker option (V3.36) actually working as intended, since it shares the exact same `ref==='uthmani'` code paths Madani uses.

**Journal `isLatest` fix** (flagged since V3.36.1, confirmed separate from that bug): `journal.js`'s edit popup never determined whether an entry was the current frontier before opening it for editing, unlike the card's own History (which correctly passes `row === rows[0]`) -- `sabaqEditingIsFrontier` was always false for anything edited through Journal, so editing the actual most-recent Sabaq entry through Journal skipped the position-advance it should get. Fixed with a new `isLatestEntry(type, date, index)` helper -- checks the entry's date against the true most recent date (across all of `journalData`, not just within one day) that has any entry of that type, wired into both of Journal's edit entry points (the entries popup and the direct cell click).

**Documentation** (confirmed in chat -- "clearly not obvious"): expanded the `RUB_BOUNDARIES` comment in `shared/data.js` and all 4 `refForMushaf` copies to state explicitly that 15-line IndoPak genuinely shares Waterval's quarter/half/juz' data natively (ayah-position landmarks, not tied to page layout) -- not IndoPak defaulting/falling through to 13-line's data for lack of its own.

**File header versioning** (new standing convention, confirmed in chat): every file this delivery touches now carries a `Current as of V3.37` line in its header comment, alongside the existing historical prose (kept as-is, still useful design history) -- not yet applied retroactively to untouched files.

**Not addressed this delivery, deliberately:** the Dhor eligibility pool's ref-agnostic behavior on a mushaf switch -- resolved as a non-issue once traced (Dhor/the pool never resolve to actual ayahs at all, only abstract positions -- see TODO.md history).

---

Confirmed across several rounds of design discussion before any of this was built. Maqra becomes a new, finer level in Sabaq Dhor's "mark sections revised" rollup chain — but only when the Rub'/Hizb model is active (`ref='uthmani'`); the 13-line/IndoPak Quarter/Half/Full chain is completely untouched, still exactly the 3 levels it always was.

**Architecture**: Maqra isn't one more merge level layered on top of the existing quarter data — it's genuinely finer than the app's existing 4-per-Juz' quarter base unit (8 per Juz'), so it needed its own structural layer underneath, not a modification of the existing one. 3 new functions in `shared/data.js` (`studyMaqraIndex`, `structuralMaqraOf`, `structuralMaqraBounds`) mirror the existing quarter equivalents exactly, built on `RUB_BOUNDARIES.uthmani` (the 240-entry dataset, confirmed in V3.36.0 to actually be Maqra data) instead of the 4-per-Juz' quarter data. A new `computeSabaqDhorSectionsMaqra` in `js/position.js` mirrors `computeSabaqDhorSections` the same way. Sabaq Dhor's existing Quarter/Half/Full merge logic needed zero changes — it was already correctly built on true Rub' data (confirmed in the terminology-sourcing work), so Maqra simply became a new, separate finest level sitting underneath it, not something the existing chain needed to be rebuilt around.

**Behavior**: Maqra becomes the new default/base level whenever the Rub'/Hizb model is active — all 8 of the current Juz's Maqras shown (completed + current), the same pattern the existing quarter level already uses. The rollup stepper (chevron) now navigates a 4-level chain for Madani (Maqra → Quarter → Half → Full) instead of 3, generalized to step through the level list by index rather than hardcoded specific transitions, since the list's own length now genuinely differs by model. A stored rollup preference from a previous Rub'/Hizb session is validated against the current model before being trusted, rather than assumed still valid — Maqra has no Waterval equivalent, so a stale "Maqra" preference read while on 13-line would otherwise call Maqra-only functions for the wrong model entirely.

**Labels**: still "Maqra 1", "Maqra 2 (current)", etc. — plain English, not yet "Ru'b"/"Hizb" terminology. That relabeling is explicitly V3.37's own, separate work.

**Verified before considering this done**: Maqra 1+2 combined confirmed to exactly match Quarter 1's own span (both structurally and through the full row-computation pipeline, not just the isolated helper functions), Juz' 30's reverse study order confirmed correct for Maqra the same way it already was for Quarter, and Waterval's existing behavior re-confirmed completely unaffected by any of this.

**Files changed:**
```
index.html
sw.js
shared/data.js
js/position.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.36.2 — 13-line/IndoPak Juz' boundaries corrected, genuinely derived from the same source as the quarters (2026-08-06)

Confirmed by the user before this went anywhere near live code — `JUZ_BOUNDARIES` (the 13-line/IndoPak print's own Juz' start points) was previously a separately-sourced file, agreeing with the Waterval quarter data at 25 of 30 points, differing by a few ayahs each at Juz' 7, 14, 20, 21, 23. Worth being precise about the framing here, since it matters: this isn't fixing an error. Juz' divisions are a human convenience layered onto the Quran's own revealed surah/ayah boundaries, not something with one universally correct answer the way the text itself is — two independently-sourced files were never guaranteed to agree everywhere, and neither reading was "wrong."

What changed: `JUZ_BOUNDARIES` is now genuinely derived directly from `RUB_BOUNDARIES.waterval` itself — each Juz's own last quarter marker, one ayah past it — rather than a separate file that only happened to mostly agree with it. This keeps the 13-line/IndoPak model internally consistent with its own quarter data, the same way `QUARTER_BOUNDARIES_UTHMANI` was already correctly derived from the Uthmani Rub' data for Madani.

**Scope, traced before building**: `JUZ_BOUNDARIES` feeds 4 functions in `shared/data.js` — `getJuzForPosition`, `juzStartSurah`, `getJuzSurahSpan`, and `structuralQuarterBounds` (which in turn drives Sabaq Dhor's entire section/row computation). All 4 inherit the correction automatically through the same constant; no other code needed to change. Verified directly, not just assumed: `getJuzForPosition` and `structuralQuarterBounds` both confirmed to reflect the new boundary correctly at Juz' 7 specifically, before considering this done.

**Files changed:**
```
index.html
sw.js
shared/data.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.36.1 — Fixed: editing/splitting an older Sabaq entry could rewind real progress (2026-08-06)

A real, confirmed bug — not related to V3.36.0's own changes. Traced
through 2 rounds: an initial hypothesis (Journal's edit popup not
correctly determining whether an entry is the current frontier) turned
out to be a real, separate inconsistency worth fixing on its own, but
not the actual cause here — the user confirmed editing happened
through the card's own History, which already handles that correctly.
The real root cause was 3 layers down, in `advancePositionAfterSabaq`
itself (`js/position.js`).

**Root cause**: that function computes where the "frontier" (the
furthest point actually reached) now sits from a saved entry's own
From/To, then overwrote the stored position with it unconditionally —
correct for the normal case, where each new entry naturally continues
from the last, but wrong for a genuinely new entry covering an
already-passed range. Splitting a previously-logged range into 2
separate entries produces exactly that: at least one new entry for an
older piece of it. That entry's own save still goes through the same
unconditional path (it IS a new entry, not an edit to an existing
one), silently dragging the real frontier backward to match it even
though nothing about genuine progress moved.

**Fixed** by comparing the newly-computed frontier against the
position already stored before overwriting it — using the study
order (Juz' 30 first, backwards, then 29, then 1-28 ascending) for a
genuinely different Juz', and the same study-direction-aware
comparison already used elsewhere in this function for the same Juz'.
Only updates when the new frontier is genuinely further along than
what was already there; a backfill/split entry for an already-passed
range now correctly leaves the real frontier alone.

Verified directly against 6 scenarios before considering this done:
normal sequential progress still advances correctly, the exact bug
scenario (a backfill entry for an older range) no longer rewinds
anything, a genuine cross-Juz' advance still works, a student with no
prior position at all still gets their first entry accepted, and both
directions of Juz' 30's own reverse study order (a genuine advance,
and a backfill that shouldn't rewind) both resolve correctly.

**Files changed:**
```
index.html
sw.js
js/position.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.36.0 — Hybrid removed, 15-line IndoPak mushaf built (2026-08-06)

Confirmed across many rounds of chat, alongside a full data-integrity
review of the user-supplied IndoPak page/line dataset before any of
this was built.

**Hybrid removed entirely.** Traced its actual behaviour rather than
trusting its UI label — its `ref` logic (`mushaf === '15line_madani'
? 'uthmani' : 'waterval'`) only ever recognized one specific value as
"use 15-line data"; Hybrid fell through to the same `waterval` branch
13-line uses. It never behaved differently from plain 13-line for
anything `ref` drove — same Juz' boundaries, same Lines/Pages numbers
— despite its own Settings description ("15 line pages with 13 line
quarter markings") describing a distinction that was never actually
wired in. Nothing real was lost removing it.

**New 15-line IndoPak mushaf**, replacing it as the third option.
Uses its own verified page/line dataset (`AYAH_LINE_INDOPAK`,
`shared/data.js`) for Sabaq's Lines/Pages — not Madina's, always,
regardless of any other choice made for this mushaf. The dataset
itself was independently verified before building anything on top of
it: exactly 6,236 rows (the Quran's real ayah count), zero duplicates,
every surah's ayah sequence contiguous and matching known counts, all
604 pages present with no gaps, and — the real test, given the two
15-line prints share page boundaries but differ in how ayahs
distribute across a page's lines — all 604 page boundaries cross-
checked against the already-verified Madina data and found to match
exactly.

**New picker, shown only when IndoPak is selected**: Quarter/Half (the
13-line convention) or Maqra/Rub'/Hizb (the Madani convention),
defaulting to Quarter/Half. Confirmed selectable now, even though the
real Maqra/Rub'/Hizb *display* system (relabeled terminology, derived
boundaries, Hizb's own global numbering) is V3.37's work — this
picker's second option borrows Madani's own existing Uthmani boundary
data in the meantime, so it's functionally real (correct underlying
Juz' boundaries) even though its labels stay in the older Quarter/Half
form until V3.37 lands.

**Architecture**: two genuinely separate concerns, kept deliberately
distinct rather than collapsed into one. Sabaq's Lines/Pages routing
(`pageRefForMushaf`) is a direct, unconditional mushaf → dataset
mapping — IndoPak always reads its own data here, full stop. Dhor/
Sabaq Dhor's own terminology routing (`refForMushaf` and its 3
duplicated copies, extended with a second parameter) is separate,
respecting the picker's choice — verified end to end that the two
resolve independently for every mushaf/terminology combination.

**Database**: new `indopak_terminology` column (migration 0016,
`quarter_half` / `maqra_rub_hizb` / NULL, only meaningful when mushaf
is IndoPak). No stored student currently has `mushaf = 'hybrid'`
(confirmed inactive beforehand), but the migration defensively
reassigns any that exist to `13line` rather than leaving a newly-
invalid value in place.

**Files changed:**
```
index.html
sw.js
shared/data.js
worker/src/profile.js
worker/migrations/0016_indopak_terminology.sql
js/sabaqPage.js
js/dhorPage.js
js/sabaqDhorPage.js
js/settingsScreen.js
SCHEMA.md
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.35.2 — Fixed: editing landed on the Timer instead of the card being edited (2026-08-05)

A real, long-standing bug, not related to V3.35.1's own changes — the
user had first noticed it during the Journal hold-to-edit work and
reasonably attributed it to that at the time, but it turned out to
predate it and sit underneath every edit path equally, regardless of
how editing was actually triggered.

**Root cause**: the CSS rule meant to hide every card except the one
being edited (`.log-detail-card:not(.editing-active) { display: none;
}`) only ever matched `.log-detail-card` — and `#dhorTimerHost` was
never a `.log-detail-card` at all. It's a separate custom element,
targeted everywhere else in this file by its own id, not that class —
so the rule genuinely could never reach it. That meant the Timer
stayed fully visible throughout editing on every one of the other 3
cards, still holding its own spot in the rail's layout, while the
actual intent had always been "every other card hides." With 2
elements visible instead of the intended 1 (the card being edited,
plus the still-present Timer), the rail could land on the wrong one —
matching exactly "click edit, land on the Timer, swipe back to reach
the actual edit."

**Fixed** by extending that same rule to also cover `#dhorTimerHost`
explicitly, so it's now genuinely hidden during editing the same way
the other 2 non-edited cards already were — nothing left visible in
the rail except the card actually being edited, regardless of which
of the 3 cards that is or which path opened editing.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.35.1 — Sabaq Lines/Pages recompute-on-confirm, Journal popup + plain click, card height genuinely fills the screen (2026-08-05)

**Sabaq's Lines/Pages now recalculate when "Confirm selection" is
checked.** The existing auto-calculation only ever fired from one
narrow trigger — the "To" ayah field's own change event — silently
missing the stepper buttons, the surah picker, and the "From" field
entirely. Checking Confirm selection is the one moment guaranteed to
happen right before every save, so it's now the reliable point Lines/
Pages is recalculated from, regardless of which of those actually
built the range.

**Journal's "+N" badge is now a popup, not a dead end.** It's a real
button now, opening a small list of every entry for that date/type —
each individually tappable into its own edit, using the same
`.modal-overlay`/`.modal-card` pattern already used elsewhere (Plan
Dhor, History) rather than a new modal mechanism. Previously only the
most recent entry in a column was ever reachable; a day with 3 Sabaq
Dhor entries now makes all 3 reachable, not just 1.

**Journal's hold-to-edit is gone, replaced with a plain click** — both
touch and mouse, cells and the date cell alike. The `(hover: hover)
and (pointer: fine)` distinction is gone too, since there's nothing
left for touch and mouse to disagree on. Root cause this fixes:
`touch-action: none` (needed so a hold wasn't fought by the browser's
own scroll gesture) also blocked the browser's own ability to tell a
still-scrolling finger apart from a genuine tap — so an ordinary slow
scroll through the table could cross the hold's timing threshold and
trigger an unwanted navigation. A click has no timing window for a
scroll to fall into, so this is gone at the mechanism level, not
tuned around.

**`.log-detail-card` and `#dhorTimerHost` genuinely fill the screen**,
replacing a flat, hardcoded `70vh`/`75vh` that left real, substantial
empty space below every card and stranded edit-mode's own bottom
controls partway down the screen. Two calculated standards, confirmed
in chat as a pattern to reuse for anything built going forward:
- **Normal** (dots row visible): `100vh` minus the auth band minus the
  dots row (~36px, worked out directly from the `.dot` button's own
  padding/font/border plus its row's margin).
- **No dots row present** (`.editing-active`, and desktop's grid layout
  at 1180px+, where the dots row is hidden entirely either way — all 4
  cards already visible, nothing to indicate a position within):
  `100vh` minus just the auth band.

`#dhorTimerHost` needed its own matching rule, not something the
`.log-detail-card` fix reached automatically — it's a separate custom
element with its own previously-duplicated `70vh`/`75vh` values, not
something that shares the class at all.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
css/journal-table.css
js/journal.js
js/sabaqPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.35.0 — Journal landing page: complete rebuild (2026-08-05)

Confirmed across many rounds of chat. The largest single change to
this screen since it was first built — genuinely a rebuild, not a
revision, once it became clear `js/journal.js` hadn't been touched
since its very first version and was reading fields (`e.surah`,
`e.ayah_from`, `e.ayah_to`) that haven't existed since the verse-ref
rework — silently showing "—" for every real Sabaq entry the whole
time this went unnoticed.

**Table:**
- Feedback column removed.
- Shorthand per type, reusing the exact same data History's own
  `describeEntryForRail` already reads, trimmed down: Sabaq (range
  only, no lines/pages), Sabaq Dhor (range only, no mistakes), Dhor
  (segment only, no mistakes/time).
- Latest date at the top.
- Most recent 10 days shown individually; older data rolled into
  weekly (rolling 7-day, not calendar-week) rows showing just the date
  range — deliberately no attempt to summarize several different
  entries across several days in one line, confirmed as either too
  crowded or too vague to be worth reading. ~3 months loads by
  default; a "Load more" row extends the rollup range further back in
  28-day increments.
- The old "quick add" modal is gone entirely — it was a separate,
  much simpler form that didn't match any card's real current fields
  (no tajweed, no Notes, no Juz'/Amount picker). Editing now opens the
  real card directly via the exact same `EDIT_HANDLERS` entry point
  History's own edit button already uses — one edit mechanism, not two.

**Interaction:**
- Mouse/trackpad (`(hover: hover) and (pointer: fine)`, not inferred
  from screen width, since a touchscreen laptop at desktop width is
  still touch): a plain click opens an entry for editing.
- Touch: press-and-hold (450ms, 8px cancel-on-movement), same target —
  cells are plain text now, not selectable/editable directly
  (`touch-action`/`user-select: none`), so there's no native
  edit-field UI to compete with the way the timer pill's drag once did.
- Date cell: same interaction, sets every card's own date field to the
  tapped date and opens the detail screen — so a new entry logged from
  there is dated correctly, not date-filtered browsing (History's own
  rail already covers that).

**Fixed a real bug found while diagnosing "every column goes to the
Sabaq card"**: `exitEditScreenMode` was unconditionally restoring the
rail's scroll position every time it ran — including the 3 non-edit
"fresh open" calls each card's own render function makes on every
single detail-screen open, whether or not anything was actually being
edited. All 3 running back to back meant whichever finished last
always won, silently overriding wherever a column-header tap (or any
other entry point) was actually trying to scroll to. Now only restores
scroll position when the screen was genuinely in edit mode — a normal
fresh open never had a corrupted position to begin with, so it's left
alone, and the intended destination actually sticks now. Confirmed:
desktop's static grid needs no equivalent fix (nothing to scroll to
begin with); mobile and tablet share the same rail mechanism, so one
fix covers both.

**Nav:** the 3 placeholder items (Sabaq/Sabaq Dhor/Dhor — all 3 already
lived together on the detail screen, redundant as separate entries)
removed. One new entry added for the detail screen itself, using the
user-supplied icon.

**Layout:** header no longer rides along via `position: sticky` as the
whole page scrolls — sits fixed above a bounded, independently-
scrolling rows region instead, closer to a spreadsheet's frozen header
than a sticky one. Header made a precise 20% taller (36px vs. the
previous 30px, not an eyeballed guess).

**Verified, not just read over**: ran the actual weekly-rollup
bucketing algorithm directly against a realistic set of scattered
dates with gaps, confirming rolling 7-day windows group and split
correctly. Swept the whole codebase for dangling references to the
removed quick-add mechanism and confirmed every global the new code
relies on (`EDIT_HANDLERS`, `describeDhorSegment`, `dhorCurrentRef`)
genuinely exists and is accessible.

**Files changed:**
```
index.html
sw.js
css/journal-table.css
js/journal.js
js/icons.js
js/auth.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.13 — Confirmation checkboxes repositioned higher on both cards (2026-08-05)

Confirmed in chat: both "Confirm selection" checkboxes (V3.34.12) moved
from the bottom of their cards (next to the error div they trigger) to
higher up, left-aligned with the rest of each card's own content, no
new indentation or centering. Sabaq's now sits directly under Sabaq
History, right before the "Sabaq from" label. Dhor's now sits directly
under the Quarter/Half/Full portion selector, right before the Juz row.
Pure markup relocation — same element ids, same `js/sabaqPage.js`/
`js/dhorPage.js` logic, same `.cb-private-row` styling (already
left-aligned by default) — nothing else about how either checkbox
behaves changed.

**Files changed:**
```
index.html
sw.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.12 — Pill-width drag fix, and a new confirmation checkbox on Sabaq/Dhor (2026-08-05)

Three pieces, confirmed together in chat as one bundled delivery.

**Fixed: the mini pill stretched into a full-width band once dragged**,
reported specifically on mobile. Root cause: `.mini`'s own `width: 100%`
means "100% of the space the flexbox gives it" while it's a normal flex
child — correct, and capped sensibly by its `max-width: 420px`. The
instant a drag switches it to `position: fixed`, `100%` means something
different: 100% of the actual viewport, since a fixed element measures
against that instead. On a phone narrower than 420px, the screen is
already smaller than that cap, so the cap never gets a chance to catch
it — exactly why this only showed up as a band on mobile specifically.
Fixed by capturing and locking in the pill's own already-correct width
the moment before switching it to `position: fixed`, so it carries its
real shape into the drag instead of recalculating against the wrong
reference.

**New confirmation checkbox on both Sabaq and Dhor** — "Confirm
selection," hard-blocking Save exactly the way Sabaq Dhor's own "mark
sections revised" checkboxes already do (an error message, no save
going through, until checked), rather than the softer yes/no prompt
the earlier "nothing entered" check used. Confirmed in chat: replaces
that "nothing entered" `confirm()` on both cards entirely, not layered
alongside it — and applies to every save, new entries and edits alike
(the earlier check on Dhor specifically only applied to new entries;
this one is a genuine, deliberate confirmation of whatever the current
selection is, which matters just as much when editing). Clears itself
immediately after every successful save on both cards, matching Sabaq
Dhor's own already-fixed behavior (V3.34.3) — a fresh confirmation is
required each time, not one that lingers checked from a previous save.

**Files changed:**
```
index.html
sw.js
js/session-timer.js
js/sabaqPage.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.11 — Drag now starts from a dedicated handle, not press-and-hold (2026-08-05)

Confirmed in chat: V3.34.10's press-and-hold-anywhere approach leaked
its gesture through to whatever was visually underneath the pill — the
device's own native long-press (text selection, a context menu) had
enough of a window during the 450ms hold to fire alongside the custom
timer, and reach through to the screen behind it. `pointer-events` on
the pill doesn't block a lower-level, OS-adjacent gesture like that.

**Replaced entirely with a dedicated drag handle** — a small move icon,
leftmost in the pill's top row (Close/Reset/Note Time/Maximise keep
their existing order after it). Touching down on just that one small
area starts the drag immediately, with no hold duration at all — there
was never a native-gesture window for the timer to compete with in the
first place, since the interaction is resolved the instant it begins
rather than after a delay. Everywhere else on the pill goes back to
plain, ordinary tap behavior.

All the hold-timing and movement-cancel-threshold logic from V3.34.10
is gone — there's no longer any ambiguity between "this is a tap" and
"this is a drag" to resolve, so nothing needs to wait and watch for it.
`touch-action: none` moved from the whole pill down to just the handle
itself, since the rest of the pill no longer needs it. The actual drag
mechanics underneath (live tracking, on-screen clamping, session-only
memory of where it was left) are unchanged from V3.34.10 — only how the
drag is triggered changed.

**Files changed:**
```
index.html
sw.js
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.10 — Mini pill is now genuinely draggable (2026-08-05)

Scope changed in chat: from "fix the pill's fixed position" to "the
pill moves wherever you put it." Confirmed 3 specific decisions before
building, since each one changes how the interaction actually works:

**Press-and-hold anywhere on the pill starts a drag** — not a
dedicated handle. A plain tap still reaches the buttons underneath
normally; only a genuine hold (450ms, cancelled if the pointer moves
more than 8px before that elapses, so an accidental brush or scroll
attempt doesn't accidentally start dragging) engages it. A drag that
just ended suppresses its own trailing click, so releasing a hold never
also fires whatever button happened to be under the pointer.

**Default starting position moved to the top of the screen** (was the
bottom, from the earlier fixed-position work) — the CSS host wrapper's
`align-items` flipped from `flex-end` to `flex-start`, safe-area
padding flipped to the top edge accordingly.

**Position is remembered for the current session only** — a plain
instance field on the component (`this._dragLeft`/`_dragTop`), not
written anywhere persistent, so it resets to the default top-center
spot on a fresh page load but correctly returns to wherever it was
dragged to on every re-minimise within the same session (maximise,
navigate elsewhere, come back — the dragged position holds).

**Constrained to stay fully on-screen**, continuously during the drag
itself and also re-clamped on window resize/rotation afterward — a
drag that ended near an edge shouldn't be able to end up partially
off-screen just because the viewport later changes shape.

**Verified, not just read over**: ran the exact clamping formula used
by both the live drag and the resize handler against normal,
past-edge, negative, and viewport-shrink cases directly.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.9 — Mini pill's positioning bug actually fixed at its root, not worked around (2026-08-05)

Prompted by a genuinely good question in chat: why did History/Plan
Dhor's own bottom-anchored sheets never hit this bug at all?

**Answer, and it changed the fix entirely**: `.modal-overlay`
(`css/components.css`) has never anchored via `bottom:` at all. It's
`position: fixed; inset: 0` (all 4 edges simultaneously) with
`align-items: flex-end` pushing its sheet to the bottom via flexbox —
letting the browser's own layout engine determine where "the bottom"
actually is, rather than calculating that one edge independently. iOS
Safari's toolbar bug specifically affects single-edge `bottom:`
calculations; a fully-`inset: 0` container was never touching that
code path in the first place.

V3.34.8's `bottom: 20px` anchoring on the pill directly was exactly the
pattern the bug affects, and the `window.visualViewport` fix built on
top of it was a workaround for that mechanism, not a fix of it — and it
applied unconditionally, including on desktop where the bug doesn't
exist, which is why the previous position regressed there.

**This version applies the same `inset: 0` + flexbox technique the
modals already use successfully**, instead: the timer host becomes a
full-viewport, invisible (`:host([mode="mini"])` was already
`background: transparent`) positioning wrapper when minimised — the
same shape `.modal-overlay` already is — with `pointer-events: none` so
it doesn't intercept taps anywhere except where the pill itself
actually sits (re-enabled via `pointer-events: auto` on the pill's own
`.mini` div). No JavaScript, no `visualViewport`, no `MutationObserver`
— all removed entirely, not adjusted.

**Confirmed in chat**: when History or Plan Dhor opens while the timer
is minimised, both are now the same underlying shape (`inset: 0` +
flexbox), so `.modal-overlay`'s existing `z-index: 300` against the
pill's `250` means the modal's sheet covers the pill for as long as
it's open — the timer keeps running underneath, completely unaffected,
and the pill reappears exactly where it was once the modal closes.
Confirmed as the wanted behavior over giving the pill priority instead.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.8 — Full view resized for mobile, mini pill repositioned around a genuine iOS Safari bug (2026-08-04)

Confirmed in chat, sized specifically against a 390×844 (6.1") viewport.

**Full view resized to actually fit its allotted space.** The ring was
a fixed 300px regardless of available height — the real cause of the
clipping reported, not a padding problem padding alone could have
closed. Worked the numbers out directly: 70vh of an 844px screen leaves
~591px for the whole card, minus the view's own padding leaves ~543px
of real content space. Ring now `min(210px, 25vh)` (was a flat 300px —
scales down further on anything shorter than the 6.1" target rather
than staying fixed), the round Start/Stop controls 72px (was 96px), and
padding trimmed throughout — lands at roughly 453px total, leaving
~90px of genuine margin rather than a bare fit.

**Mini pill repositioned around a real, currently-open Apple bug, not
just a CSS tweak.** Researched this rather than assuming a quick CSS
fix would hold: iOS Safari's own developer forums document `position:
fixed` content getting clipped near the bottom edge (not just hidden
behind the toolbar) as of iOS 26 specifically, when the toolbar is
showing. No CSS-only approach reliably solves this across iOS versions.
The actual fix uses `window.visualViewport` to read the real,
currently-visible area directly and position the pill against that —
covers the devices actually affected; `detail-pages.css`'s existing
bottom-anchoring rule remains the fallback for anything without
`visualViewport` support. Watched via a `MutationObserver` on the
timer's own `mode` attribute rather than needing a matching call at
every place `mode` might change to `'mini'` — catches the component's
own internal Minimise action the same as anything triggered from here.

**Floating means fixed-position overlay, not draggable** — confirmed
directly with the user last round; no change needed, since that's
already what's built.

**Verified, not just read over**: ran the actual repositioning function
against a shrunk visible-viewport height (simulating the toolbar being
visible), a scrolled offset, and confirmed it correctly clears its own
inline styles rather than leaving them behind when the timer isn't
minimised or `visualViewport` isn't available.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.7 — Fixed: Timer card was invisible on every screen load (2026-08-04)

Root cause of the "Timer card missing" issue reported across several
rounds — confirmed via a live DOM inspection, since the static HTML and
every deployed file checked out clean the whole time.

**`renderDhorScreen` still contained `if(timerHost.elapsed === 0)
timerHost.classList.add('hidden');`** — logic that made sense before
V3.34.5, when the timer needed to hide itself by default on a fresh
screen-open. Once the timer became a permanent rail card, this line
became actively wrong: `renderDhorScreen` runs every single time the
day-log screen opens, and a fresh timer's elapsed time is always 0 — so
it was re-hiding the timer immediately on every load, regardless of what
the deployed HTML or scripts actually said. This is why checking the
GitHub source, the deployed script versions, and the zip all came back
clean: none of them were wrong. The bug was runtime behavior inside a
function that ran after every page load, invisible to anything that
only inspects source or file versions — only a live DOM inspection
during the session actually caught it.

Removed the line entirely and swept the rest of the codebase for
anything similar targeting the timer — confirmed nothing else does.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.6 — Rail scroll position fixed after editing; Duration split into 2 numeric fields (2026-08-04)

**Fixed: editing a Sabaq Dhor or Dhor entry from History returned to the
Sabaq card afterward, not the card actually being edited.** Root cause:
during editing, every card except the one being edited is `display:
none`'d (an existing rule), which collapses the rail's scrollable width
down to just that single card — so its scroll position is effectively 0
throughout. Once editing finishes and the other cards reappear, that
stale 0 now points at Sabaq (the first card), regardless of which card
was actually being edited — invisible when editing from Sabaq itself,
since 0 already happens to be correct there, which is exactly why this
only showed up on the other two. `exitEditScreenMode` now explicitly
restores the rail's scroll position to the edited card before handing
control back.

**Duration split into 2 plain number fields (Minutes/Seconds) instead
of 1 text field holding "mm:ss".** Confirmed in chat after a real
back-and-forth on the actual mechanism: a colon in the middle of a
single field doesn't suit the native numeric keypad, which expects
plain digits — so each field being purely numeric lets the keypad work
exactly as designed for both. Typing a 2nd digit into Minutes (capped
at 2, so max 99) auto-advances straight into Seconds; leaving Minutes
with just 1 digit when focus moves away — by any means: iOS's
checkmark, Android's Next, tapping Seconds directly, or tapping away
entirely — defaults Seconds to 00, so a single-digit minute value never
needs its own explicit "00" typed out. `parseDhorDuration` is retired
entirely (its one and only caller was the field this replaces); Duration
now flows through 2 new helpers, `getDhorDurationSeconds`/
`setDhorDurationFields`, threaded through all 9 places the old single
field was read or written — the timer's own auto-fill, the raw-range
disable/enable toggle, edit-load, the "nothing entered" check, and the
form resets.

**Verified, not just read over**: ran the actual helpers against a real
split-and-reassemble round trip, the both-empty case, and the exact
typing sequences described in chat — 1 digit not auto-advancing, 2
digits advancing, and the blur-default filling Seconds with "00" only
when it's still genuinely empty.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.5 — Rail restructured: Timer is now a permanent card, Tadabbur has its own screen (2026-08-04)

The largest single restructuring of this screen since the original
unified day-log view (V3.6.1) — confirmed in chat.

**Tadabbur moved out of the rail entirely, into its own standalone
nav destination.** Reused the existing `'reflections'` nav item rather
than adding a duplicate — it turned out to already be defined (`js/
auth.js`'s `NAV_ITEMS`), just never built out, sitting behind the
generic "coming soon" placeholder the whole time. Renamed its label
from "Reflections" to "Tadabbur" to match the app's own consistent
terminology everywhere else. `js/reflectionCard.js`'s own read/save
logic needed no changes at all — it only ever operated on element ids,
never anything about the rail itself.

**The Timer takes Tadabbur's old slot as the rail's permanent 4th
card.** No longer an on-demand overlay toggled by a hidden/visible
class — it's simply always there, like Sabaq/Sabaq Dhor/Dhor,
positioned via the same swipe/scroll-snap mechanism and sharing its
own dot indicator (relabeled from "Tadabbur" to "Timer"). The Dhor
card's Stopwatch button and the pill's Maximise action now scroll the
rail to it (the same `scrollTo`/`offsetLeft` mechanism the dot
indicators already used) instead of un-hiding an overlay. Built this
to navigate to the logDetail screen first only when not already there
— calling its full render unconditionally on every Maximise tap would
have discarded any unsaved, in-progress work on Sabaq/Sabaq Dhor/Dhor
just from opening the timer elsewhere in the app.

**Close no longer hides anything** — confirmed, since there's nothing
left to hide now that the timer is a permanent card; it simply resets
and sits there, the same as any other card would after a save.

**Minimise/Maximise are unchanged in spirit, confirmed explicitly**:
the mini pill is still a genuine `position: fixed` floating element,
independent of the rail entirely, so a running session still stays
visible over whatever screen is showing — this was never actually
tied to the overlay model that just got removed.

**A real sizing risk found and fixed along the way**: the component's
own `min-height: 640px` could have forced the card taller than its
newly-allotted 70–75vh rail space on a shorter screen. Removed it,
added `overflow: auto` as a safety net.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/app.js
js/auth.js
js/logDetailScreen.js
js/dhorPage.js
js/session-timer.js
js/reflectionCard.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.4 — Timer pill layout finalised: Maximise repositioned, row order fixed, lap dots, mobile safe-area (2026-08-04)

Confirmed in chat — the last of the pill's own layout details.

**Maximise moved into the top row**, rightmost of the 4 icons (Close,
Reset, Note Time, Maximise) — was in the second row before.

**Second row reordered**: Pause/Restart toggle on the left, elapsed time
centered in the middle, Lap on the right — was time-left/lap-middle/
toggle-right/maximise-far-right before.

**A small white dot now appears under Lap for every lap actually
recorded** — 3 laps means 3 dots, not just one indicator meaning "at
least one." Tested the exact rendering logic directly: 0 laps produces
no dots, 3 laps produces exactly 3.

**Full-screen mode now respects the device's own safe-area insets**
(status bar, home indicator) instead of claiming the literal 100% of
the viewport — this is what was actually causing controls to overlap
mobile indicators; the earlier tablet/desktop width cap (V3.34.2) was a
separate, different gap on larger screens and didn't touch this.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.3 — Auto-repopulate after Dhor save, "nothing entered" confirmation, Sabaq same-ayah prepopulation, Sabaq Dhor duplicate-save fix (2026-08-04)

**Sabaq Dhor's checkboxes never cleared after a save** — found by the
user before this delivery went out, holding it back rather than
uploading a version with a live duplicate-save risk in it. The exact
same "mark sections revised" boxes stayed checked after saving, so
tapping Save a second time (an accidental double-tap, or simply not
noticing the first one had gone through) would recompute the identical
range and log a genuine duplicate. Fixed by reusing
`renderSabaqDhorScreen`'s own existing fresh-open logic — it already
rebuilds every row from scratch on each real open
(`rebuildRowsFromPosition`, reflecting the student's current position/
pool, which may well have just changed if this very save triggered a
Dhor-transition), so the checkboxes come back genuinely unchecked as a
natural side effect of that rebuild, not a second, separately-maintained
reset that could drift out of sync with what a real fresh open does —
same underlying pattern as this version's own Dhor auto-repopulate fix.

**After every Dhor save, the card clears and immediately repopulates
with the next queue item** — reuses `renderDhorScreen`'s own existing
fresh-open logic directly rather than a second, partial version of the
same reset, so the student can keep logging consecutive sessions without
navigating away and back each time.

**"Nothing entered" confirmation, Dhor and Sabaq.** Confirmed in chat
after discussing (and correctly ruling out) comparing against the last
saved entry — that approach wouldn't actually have caught an accidental
blank save, since Dhor's segment always legitimately differs from the
last entry as the queue advances, so "same as last time" is never true
even for a normal working save. What actually distinguishes an
accidentally-saved default form from a real session: Duration/Lines-
Pages, Mistakes, tajweed tags, and Notes are all still sitting at their
just-populated defaults. When every one of those is still empty/zero at
Save time, a confirmation now appears before proceeding — for new
entries only; editing an existing entry is always modifying real,
already-logged data, not risking this scenario. Sabaq Dhor doesn't get
this check: it already hard-blocks saving with nothing checked ("please
check at least one section"), a stronger existing protection for the
same underlying concern, not something to duplicate.

**Sabaq's From and To now prepopulate with the same starting ayah**,
instead of one field prepopulating and the other staying blank/dashed
(which field used to depend on juz' 30's backwards study direction vs.
every other juz' ascending) — `nextSabaqDefaults` (js/position.js)
simplified accordingly, one fewer branch than before.

**Verified, not just read over**: ran the actual nothing-entered check
against a genuinely blank form and against each field individually
being the only one filled in, confirming each real entry correctly
prevents the confirmation from firing.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/position.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.2 — Timer icon semantics redefined, card-level lap rollup, responsive width cap (2026-08-04)

Confirmed in chat across several rounds — the largest single change to
the timer since it was first integrated.

**Close and Reset now do genuinely different things than they did
before.** Close used to minimise; now it stops the clock and discards
the session entirely (no save, nothing kept) — minimising is now its
own dedicated icon, since the pill's body is no longer one big "tap
anywhere to expand" surface (it holds its own controls now, see below),
so a single explicit tap target for going small was needed either way.
Reset used to zero the count while leaving a running timer still
ticking from 0 — confirmed this should stop it too, waiting for a
deliberate Start; the supplied component's own `reset()` left
`_running` untouched, so this required a real (small) change to its
internals, not just relabeling a button.

**"Save" is now "Note Time"**, re-iconed with the user-supplied
clipboard-clock SVG — same underlying action and same `timer-save`
event name the host app listens for, just a different face on it,
reflecting that this records a duration rather than saving a document.
Tapping it now asks for confirmation every time, full view or pill —
Cancel leaves everything exactly as it was; OK transfers elapsed/laps
into the card the same way it always has.

**Mini pill rebuilt entirely**, no longer a single button: a row of 3
small icons (Close/Reset/Note Time) above a second row (elapsed time,
Lap, Pause/Restart toggle, Maximise). Both the full view's big round
toggle and the pill's own small one share `data-act="toggle"` now, so
`_paint()` updates both together rather than just the first match a
plain `querySelector` would have found.

**New lap-times rollup on the Dhor card itself**, next to the Timer
button — shows what Note Time captured, collapsible, staying visible
until the Dhor entry is actually saved (at which point History becomes
the record of it instead, and the rollup clears). Wired into every
existing place `dhorLapTimes` already got reset, plus the actual save
success path, which didn't clear it before.

**Full-screen mode capped to the same width every other single-screen
element in the app already respects** — `--width-tablet`/`--width-
desktop`, same breakpoints, not new values invented for the timer.
This was the real gap behind an earlier full-screen complaint: the
immediate symptom that prompted it turned out to be a missing deployed
file (a blank overlay with nothing rendered, not a design choice), but
the underlying width issue was real and independent of that, and is
fixed here.

**Verified, not just read over**: confirmed `reset()`'s new
`_running = false` is actually present in the rewritten source, and ran
the new rollup function against both the empty and populated cases,
confirming visibility toggling and exact formatted lap lines.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/session-timer.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.1 — Timer's target linked to the real Setup value (2026-08-04)

Confirmed in chat: V3.34.0 briefly hardcoded the timer's per-session
target at 40 minutes, flagged at the time as an unconfirmed guess. There
was a real, live Setup field this should have read from instead —
"Minutes / juz'" (`target_minutes_per_juz`, defaulting to 40 there too,
which is why nothing visibly changes for a student who's never touched
it). The Stopwatch button's click handler now fetches the profile and
reads that value before opening the timer, scaling it by the card's
current Amount/Unit selection the same way as before — a student who's
set their own target to, say, 60 minutes/juz' now actually sees 30 for
a half, not a fixed 20.

Also confirmed in chat: the floating mini pill persisting across every
screen (not just while the Dhor card is showing) is the intended
behavior, not something to narrow — "if it's running it should be
visible everywhere." No code change needed for that; it already worked
this way as a side effect of the pill living outside the screen-toggling
mechanism entirely, confirmed by tracing `showScreen` directly.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.34.0 — Dhor's timer replaced with the supplied session-timer component (items 1-4 of 5; item 5, mini-pill lap/stop controls, deferred to a later round) (2026-08-04)

**Old `js/timer.js` (Start/Lap/Stop, inline panel) removed entirely**,
replaced with the user-supplied `js/session-timer.js` — a self-contained
custom element (`<session-timer>`), adapted with "Start Dhor"/"Stop Dhor"
text labels added beneath its two round control buttons (everything
else in the supplied file is untouched).

**Structural change, not just a swap**: the old timer was an inline panel
inside the card, toggled open/closed, re-created every time the Dhor
screen opened. The new one is a single persistent element living outside
any one card — full-screen when active (matching the app's existing
modal z-index), repositioned to a bottom-floating pill via CSS when its
own "mini" mode is active. Its "Close" action minimises to that pill
rather than dismissing outright, since the point of the mini pill is a
running session that survives navigation rather than one that gets
thrown away — confirmed this is what "minimise... rather than blocking
the rest of the form" (specified for this feature well before this
component existed) actually meant. Re-opening the Dhor screen no longer
resets an in-progress session either: it only ensures the timer is
hidden if nothing's actually running, so switching tabs and coming back
doesn't lose a session someone's mid-way through — deferring item 5 to a
later round doesn't mean an active timer is fragile in the meantime.

**Save wired into the existing fields, not a new pipeline**: `dhor_log`
already had `duration_seconds`/`lap_times` fully wired end to end
(save, edit, validation) — the only new work was on `timer-save`,
converting the component's elapsed/laps (milliseconds) into the same
`dhor_duration_minutes` field and `dhorLapTimes` variable the save
payload already reads from.

**Laps now display in History** — confirmed this didn't exist anywhere
before (lap_times was saved but never shown): each Dhor history row
with recorded laps now lists them beneath its existing summary line.

**Target for the ring** (Claude's own choice this round, flagged since
it wasn't specified): reuses the existing "40 min per juz'" default from
the not-yet-built Dhor rings spec, scaled by the card's current
Half/Quarter/Full selection — the only established "how long should
this take" concept anywhere in the app, so it seemed the more grounded
choice than inventing a new number. Worth confirming.

**Verified, not just read over**: ran the actual target-minutes mapping
and the save handler's exact data-conversion logic (milliseconds to
whole seconds, for both the total and each individual lap) — confirmed
correct rounding and confirmed every lap value produced would pass the
backend's own existing validation (non-negative integers).

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/session-timer.js (new)
js/timer.js (deleted)
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.33.0 — Plan Dhor's vertical compression fixed at its actual root: a flex-shrink gotcha (2026-08-04)

Found via the user's own DevTools experiment, isolating viewport height
as the real variable rather than which tab was selected — a genuinely
useful diagnostic that led straight to the actual mechanism, after two
earlier rounds patched the wrong layer (text centering, then a long
label) without touching the real cause underneath.

**The modal is a vertical flex column (title row, switch, content list)
capped at 85% of the viewport's height.** `.plan-dhor-content` already
had `flex:1; overflow-y:auto` — the clear original intent was for the
list to be the one part that scrolls internally once content exceeds
that cap. But without `flex-shrink:0` on its siblings, every flex child
shrinks by default to help make room when things don't fit — so the
title row, the switch, and the Select All button were all shrinking too,
proportional to how much the list overflowed. "View All" (30 rows)
squeezed things far more than "Dhor Plan" (a handful of rows) because
there was more overflow to make room for, not because of anything about
which tab was active per se. A shorter browser viewport made it worse
for the same reason: 85% of a smaller number is a smaller number.

Fixed by giving the title row, the switch, and Select All `flex-shrink:
0` — only the content list absorbs overflow now, by scrolling
internally the way it always could, while everything above it holds its
real size regardless of how long the list underneath it gets.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.32.0 — Plan Dhor: granularity-aware rollup labels, pill-tracking bug fixed, View All Completed removed, switch centering fixed (2026-08-04)

**Rollup labels now match the actual granularity a batch is built from,
not always quarter language.** `planDhorDaySummaryLabel` used to describe
every rollup row's first-to-last span in quarter terms ("Q1"/"Q4")
regardless of what granularity the batch actually was — so a half-juz'
batch (what most Setup configurations, halves not quarters, actually
produce) was being described with quarter positions that were never
really there. Now reuses `describeDhorSegment` (the same "Juz 2 H1" style
already used everywhere else on the card) for each boundary, matching
whatever granularity that specific batch is. Still collapses to the
plain "Juz 29 to Juz 30" form, but only when a batch genuinely runs from
the very start to the very end of those juz' — checked by quarter-unit
position, independent of the granularity in between. Verified directly:
a whole-juz' span still simplifies correctly, a half-juz' batch that
doesn't end on a juz' boundary now shows "Juz 2 H1 to Juz 3 H1" instead
of quarter language, and a single full juz' shows just "Juz 2."

**The tab switch's pill genuinely wasn't tracking selection — confirmed
and fixed.** Tapping a tab updated `planDhorTab` and redrew the content
below it, but the switch's own visual state (pill position, which option
is marked active) was only ever computed once, at modal-open time — the
tab-change handler never re-ran it. Now it does.

**"View All Completed" removed entirely** — confirmed redundant: "View
All" already showed everything it did, just with incomplete portions
greyed out rather than hidden. Frontend down to 2 tabs; the two
now-single-branch ternaries in `renderPlanDhorTabContent`/
`planDhorSelectAll` simplified to their one remaining case, and a
resulting unreachable "nothing marked complete" check removed.

**Vertical compression — fixed at the actual cause, not just by removing
the crowded label.** `.switch-option` (used by every switch in the app,
not just this one) had no vertical centering of its own; text sat on
whatever baseline a bare button defaults to inside a fixed-height,
overflow-hidden track. Added explicit `display:flex; align-items:center;
justify-content:center` so this can't happen again on any switch, on any
future long label, not just resolved incidentally by having fewer tabs.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.31.0 — Unified spacing/sizing system across all 3 detail cards; date-display bug fixed at its root (2026-08-04)

Confirmed in chat: rather than patching one row at a time again, this
consolidates every card's spacing and sizing onto one shared system, plus
fixes the date display bug this round's screenshot caught.

**The date display bug — root cause was a fundamental DOM behavior, not
a logic error.** Every page sets its date field with a plain
`input.value = todayISO()` assignment (or `entry.date`, when loading an
entry for edit) — a plain assignment never fires a `change` event, full
stop, regardless of what code does the assigning. V3.30.0's display only
re-rendered on wiring (when the field was still empty) and on `change`,
so it never saw any of these later assignments and stayed stuck on
"Select date." Fixed by overriding the input's own `value` property
(`Object.defineProperty` against the real `HTMLInputElement.prototype`
descriptor) so *any* assignment — from the native picker or from any
page's own render code, present or future — re-renders the display
automatically, rather than requiring every call site to be found and
updated individually.

**One shared row-height variable for every card, not several separate
values that happened to coincide.** `--dhor-row2-h` used to be scoped to
`#card-dhor` alone (40px), while Juz/Position and Duration/Timer each had
their own separately-hardcoded 44px, and Sabaq/Sabaq Dhor's date+history
row had no explicit height at all. All of it now reads from one variable
defined on `.detail-page` (shared by all 4 cards), set once to 44px —
Row 2, Juz, Position, Duration, the Timer button, and Sabaq/Sabaq Dhor's
date row all reference the exact same value now.

**The date field sizes to its own content everywhere, matching Sabaq/
Sabaq Dhor exactly, resolving last round's width question.** Dhor's
Row 2 grid changes from a fixed `40% 30% 30%` to `auto 1fr 1fr` — the
date column now sizes to its own short text (identical to how Sabaq/
Sabaq Dhor's date field has always worked), and Plan/History split
whatever space is left evenly between them, staying comfortably large to
tap rather than being squeezed by a wide date field. This is a system-
level rule now (a content-sized date column), not a one-off percentage
tuned to look right by coincidence.

**Amount switch row given breathing room** — `#dhorAmountRow` gets
`margin-top`, matching the spacing every other row in the card already
has, so it stops crowding Row 2 directly above it.

**Verified, not just read over**: rebuilt the fake-DOM test with a real
`HTMLInputElement`-like prototype (the earlier version's plain object
wasn't a faithful enough stand-in to actually exercise a property-
descriptor override) and confirmed a plain `.value` assignment — the
exact pattern every page uses — now updates the display correctly, while
reading `.value` back still works normally.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/customDate.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.30.0 — Dhor card UI: real root causes fixed, custom date display, rollup default flipped (2026-08-03)

Everything from the last two rounds of UI feedback, including two root
causes found this round that explain why earlier fixes hadn't fully
taken effect.

**Row 3 (Amount switch) — the actual bug, not a re-guess at the width.**
`#dhorAmountRow` had `class="card-date-row"` on it by mistake — that
class belongs to Sabaq/Sabaq Dhor's own 2-column date:history layout
(`grid-template-columns: auto 1fr`), completely unrelated to this
single-switch row. It was forcing the switch into an auto-sized grid
column, so the `width: 78%` fix from last round never had a chance to
apply. The stray class is removed; the switch's own width rule now
actually takes effect.

**Row 2 (History button touching the edge)** — grid items default to
`min-width: auto`, which refuses to shrink a child below its own
content's natural size even when its column is narrower; on a wide card
this goes unnoticed, on a narrow mobile width it can push a button past
its assigned column. `min-width: 0` added to all 3 of Row 2's columns.

**Juz/Position height mismatch** — the Position switch has always had an
explicit `height: 42px`; the Juz `<select>` had none at all, relying on
padding + line-height, which commonly doesn't land on the same computed
height and varies by platform. Both now share one explicit height (44px)
instead of one side guessing at the other.

**Timer/Duration alignment** — centering the whole Timer column isn't
the same as lining up with the Duration *input* specifically, since
Duration has its own label pushing the input down and the Timer column
didn't. An invisible label spacer now sits above the Timer button,
mirroring Duration's real label, and both the input and button share an
explicit height — their bottom edges line up exactly now rather than
approximately. The icon is also bigger (22px → 28px). Found and fixed a
duplicate `#dhorStopwatchToggle` CSS rule along the way — two separate
rules for the same selector had accumulated across earlier rounds; they're
consolidated into one now.

**Custom date display, all 3 date fields (Sabaq/Sabaq Dhor/Dhor)** — a
native `<input type="date">`'s displayed text is entirely browser/OS-
controlled; no CSS can reformat it, which is exactly why two different
screenshots this round showed two different formats for the identical
date. New `js/customDate.js`: wraps each date input (still fully
functional underneath, same id/`.value`/change event, so every existing
read against it is untouched) with a visible button showing a consistent
"DDD dd-MMM" format everywhere; clicking it calls the input's own
`.showPicker()` to open the same native picker as before, with a
focus+click fallback for browsers without that method yet. Padding and
font-size on the visible display are reduced too, per an earlier separate
request folded in here.

**Plan Dhor's "View All Completed"/"View All" now default to rolled-up
Juz** instead of the most granular (quarters) view — all 4 places that
read this default changed.

**Verified, not just read over**: ran the real, extracted
`wireCustomDateDisplay`/`formatCustomDate` code against a fake DOM —
confirmed the wrap/hide/display sequence, the exact formatted output for
2 different dates, live re-rendering on a simulated native picker change,
and that calling it twice never double-wraps.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/customDate.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.29.0 — Pool updates moved to the Dhor card's actual Save; Dhor Plan's range-select fixed for queue wraparound (2026-08-03)

Two related fixes, both confirmed in chat, both about when/how
`baseline_selection` (the Dhor pool) is allowed to change.

**"Execution of the plan happens on the card, not in the plan."** Plan
Dhor's own Save used to merge any newly-selected units into the pool
immediately — before the student had touched the Dhor card at all. If
they then closed the card without logging anything, the pool had already
grown permanently even though nothing was recited and nothing exists in
`dhor_log`. That merge is removed from `savePlanDhorSelection` entirely —
selecting in Plan Dhor now only ever populates the card, same as before,
but touches nothing else.

The merge moves to the Dhor card's own Save handler instead, covering
both the clean-segment path and the raw-range path (both already compute
a real `segment_from`/`segment_to` before this point) — and running
regardless of whether the entry came from a Plan Dhor selection or was
entered fully manually. Fetches the profile fresh rather than trusting
`planDhorPool`, since that's only populated once Plan Dhor's modal has
actually been opened this session — a fully manual entry might never
touch it. Net effect: the pool now only ever grows at the exact moment
something is genuinely logged, from either path, so "in the pool" and
"in Dhor History" can no longer drift apart the way they could before.

**Dhor Plan's tap-first/tap-last range-select is rebuilt to range by
position in the rendered queue, not by quarter-unit value.** The
previous fix (V3.28.0) reused "View All Completed"/"View All"'s existing
range logic as-is, which works by taking the numeric min/max of the two
tapped rows' quarter-units. That's correct for those two tabs' plain
ascending Juz' grid, but Dhor Plan's own rows follow queue order, which
wraps around near the end of the pool — two rows that are genuinely
adjacent in the queue can have numerically distant unit values, and a
value-based range would sweep in anything numerically in between,
whether or not it was ever actually shown between the two tapped rows.

The fix: `renderPlanDhorTabContent`/`renderPlanDhorQueueDayRow` now build
`planDhorQueueRowUnits`, a flat, render-order list of each visible row's
own units, fresh every render; each row carries `data-row-index` instead
of relying on its raw unit values for ranging. A new
`planDhorHandleQueueRowTap(rowIndex)` ranges by index into that list —
tapping two rows selects the union of every row's units strictly between
them, never anything else. As a direct consequence, this also resolves
the earlier "exclude non-pool units" ask as a side effect, with no
separate filtering logic needed: nothing rendered in this tab can hold a
unit outside the pool in the first place, since every row comes from
`computeUpcomingDhorQueue`, itself built entirely from the pool. "View
All Completed"/"View All" are untouched — their rows never wrap, so the
original value-based `planDhorHandleRowTap` still applies there.

**Verified, not just read over**: ran the actual `planDhorHandleQueueRowTap`
against a simulated wrapped queue (today's row far along the pool
numerically, later rows wrapping back near the start) — confirmed that
tapping two rows adjacent in the queue but numerically distant selects
exactly their two rows' units, not anything sitting numerically between
them that was never actually tapped.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.28.0 — Urgent TODO list cleared: 3 real bugs, dead plan-CRUD removed; Dhor card UI polish + Plan Dhor behavior fixes (2026-08-03)

Everything from TODO.md's "Urgent" section, then the previously-deferred
Dhor card/Plan Dhor items in the same delivery.

**Three real bugs, all the same root cause, all fixed.** `isCleanSingleUnit`
and the raw-range Save handler (`js/dhorPage.js`) both destructured
`.quarter` from `quarterUnitToJuzQuarter`'s result — a property that was
never actually there (it returns `.quarterIndex`). `isCleanSingleUnit`'s
version corrupted the Dhor card's Juz/Position fields after a clean
selection from Plan Dhor (`NaN` matching no `<option>`, leaving Juz blank).
The raw-range version is more serious: it's in the actual Save path, so
any raw-range Dhor entry logged before this fix has `NaN` written into
`dhor_log`'s `segment_from`/`segment_to` — flagged on TODO.md as a
decision still needed (repair existing rows, or leave as-is). Both fixed
and verified directly: a half-juz, a full juz, and a single-quarter
selection all now resolve to correct, non-`NaN` values.

**`quarterUnitToJuzQuarter` (`shared/data.js`) is hardened so this exact
mistake can't ship silently a 5th time.** This was the 4th real occurrence
of the same `.quarter`/`.quarterIndex` confusion in this codebase. Its
return value is now wrapped in a `Proxy` — any access to a property other
than `juz`/`quarterIndex` throws immediately, turning a future typo into
a loud, instant error at the exact wrong line instead of a silent `NaN`
surfacing as a confusing symptom several steps downstream. Verified: it
throws on `.quarter`, and works normally for the real properties.

**`apiPlans.create`/`.update`/`.remove` removed entirely** (`js/api.js`,
`handleCreatePlan`/`handleUpdatePlan`/`handleDeletePlan` in
`worker/src/plans.js`, and their 3 routes in `worker/src/index.js`) —
confirmed zero callers anywhere in the app: Dhor's own plan features go
through the queue model instead, and Sabaq/Sabaq Dhor have no planning UI
at all. `GET /plans` (the one real caller, `journal.js`) and its handler
are untouched. `validateBody`/its `isValidDate`/`isInRange` imports are
removed from `plans.js` too — nothing else in that file used them.

**Dhor card UI fixes, originally raised and then dropped from the thread**:
"Plan Dhor"/"Dhor History" shortened to "Plan"/"History" (the likely fix
for the reported button overlap too — the real cause was long text
wrapping inside a fixed-height button, not a missing grid). The Amount
switch is now a percentage width (78%) instead of a fixed 320px cap, so
"Half" no longer clips on wider cards. The "Pre-filled from today's
plan…"/"No plan set up yet…" banner is deleted entirely, along with its
now-empty container div and the `renderDhorPlanBanner` function itself.
"Starting at"'s label text is removed (an invisible spacer keeps Position
vertically aligned with Juz's own label above it). The Timer/stopwatch
column is now vertically centered against Duration beside it.

**Plan Dhor behavior fixes**: rows across all 3 tabs — including Dhor
Plan, which previously used independent checkboxes — now share the same
tap-first/tap-last range-select `.plan-dhor-tap-row` mechanism, so a
selection can't end up non-contiguous. One limitation flagged on
TODO.md, not solved this round: the range is computed by quarter-unit
*number*, correct for the other 2 tabs' plain ascending Juz' grid, but
Dhor Plan's rows follow queue order, which wraps around near the end of
the pool — tapping across a wrap point could select more than intended.
Separately, the "rest of week" rows' expand/collapse is fixed: the day
index was stored as a number when rendered but read back as a string on
tap, so the `Set` lookup could never match and no row would ever expand.

**Verified, not just read over, throughout**: real extracted-code tests
for the Proxy hardening, `isCleanSingleUnit`'s 3 clean-selection shapes,
the new tap-row markup, and the reused range-select logic across 2 taps.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/api.js
js/dhorPage.js
shared/data.js
worker/src/plans.js
worker/src/index.js
TODO.md
CHANGELOG.md
TESTING.md
```

---

## V3.27.0 — Tomorrow's Portion removed; Pure queue model, Phase C: Plan Dhor's queue view (2026-08-03)

Two pieces of work, done together: closing out the last loose end from
Phase A/D, and the 4-phase rebuild's final planned phase.

**Tomorrow's Portion removed entirely.** Confirmed in chat: it served no
purpose once a student could already redirect the queue by simply saving
a different portion via Plan Dhor. Removed from Setup (`index.html`'s
dropdown/label/hint; `js/settingsScreen.js`'s `renderTomorrowPortionOptions`/
`segmentLabel`/`buildSegmentOptions`, all 4 places that called the render
function, and the save handler's `startSegment` construction). This was
also the last remaining caller of `ensureDhorSchedule`/
`handleEnsureDhorSchedule` anywhere in the app (Phase B had already
removed the only other one, dhorPage.js's open-time top-up) — so that
whole mechanism is now gone too: the function, its route
(`/dhor-schedule/ensure`), and the frontend wrapper
(`js/api.js`'s `apiEnsureDhorSchedule`). Per the standing instruction
confirmed this session — delete superseded code promptly rather than
keeping it for a possible future tie-in, since there are no dependent
users yet to break — nothing here was left as a stub.

**The Dhor card's default Amount/Unit changed from Quarter to Half**,
confirmed in chat. This isn't purely cosmetic any more either: it's now
also the source Plan Dhor's "no Setup configured yet" fallback (below)
reads its granularity from.

**Phase C: Plan Dhor's "Dhor Plan" tab.** Replaces V3.24.1's whole
yesterday/today/next-5-days date-grouped view — dead since Phase A
stopped generating dated rows and Phase D purged what existed — with a
new backend computation, `computeUpcomingDhorQueue`
(`worker/src/dhorSchedule.js`, exposed at `GET /dhor-schedule/upcoming`):
several days' worth of upcoming QUEUE batches, no dates involved
anywhere, reusing `buildChunks`/`findChunkIndexForSegment` rather than
re-deriving the chunking logic a second time. Batch size and granularity
come from `dhor_granularity`/`dhor_quantity`/`dhor_frequency` when Setup's
been configured (e.g. 2 halves twice a day = 4 items/day, the exact
example confirmed in chat); otherwise from the Dhor card's own live
Amount/Unit switch, 1 item/day. Number of day-groups returned is
`dhor_days_of_week`'s own length when set (its cardinality, not specific
weekdays — no calendar involved), else 7. **Flagging rather than
silently assuming**: extending the "has Setup, no history yet" case to
also start from the pool's beginning was Claude's own generalisation of
what was confirmed for the "no Setup, no history" case specifically —
chat didn't address that exact combination, and this was the least-bad
reading available; worth double-checking it matches intent.

On the frontend (`js/dhorPage.js`): `openPlanDhorModal` now calls the new
endpoint instead of three date-keyed `apiPlans.get()` calls, and
pre-selects the first item of today's batch so the tab and the card
visually agree. Today's batch always renders individually, no dates, no
completion status (there's nothing here that can be "done" yet — these
are computed queue positions, not real rows). The rest of the week rolls
up one row per batch (`renderPlanDhorQueueDayRow`, replacing the old
`renderPlanDhorDayGroupRow`) — confirmed as the one deliberate exception
to "no rollup," since a future batch can never have the mixed-completion
ambiguity the old date-grouped rollup had to represent; expand/collapse
here is purely a "see more" affordance, always collapsed again the next
time the modal opens.

**A real bug found and fixed along the way, not something new**:
`quarterUnitLabel` destructured `{ juz, quarter }` from
`quarterUnitToJuzQuarter`, which actually returns `{ juz, quarterIndex }`
— producing "Qundefined" every time. This was already visible in the old
V3.24.1 tab (confirmed from an earlier screenshot showing exactly that
artifact); caught this round via testing while rebuilding the code that
calls it, not newly introduced by this rebuild.

**Verified, not just read over**: ran `computeUpcomingDhorQueue` for real
against 4 scenarios (no pool; no-Setup-no-history with a fallback unit;
continuing correctly after a logged entry; Setup configured with a
3-day-of-week schedule) — confirmed correct wraparound both within a
day's batch and across day boundaries when the pool is smaller than what
a batch needs. Separately ran the actual `renderPlanDhorQueueDayRow`
against collapsed, expanded, and single-item cases, confirming the
`quarterUnitLabel` fix and that a single-item day never renders an
expand control.

**Files changed:**
```
index.html
sw.js
js/settingsScreen.js
js/api.js
js/dhorPage.js
worker/src/dhorSchedule.js
worker/src/index.js
SCHEMA.md
CHANGELOG.md
TESTING.md
```

---

## V3.26.2 — Nav dropdown menu fixed to the viewport (2026-08-03)

Standalone fix, unrelated to the Dhor queue rebuild — reported after scrolling
down any page and finding the menu button appeared unresponsive.

**Root cause**: `#authBand` (the top bar) is `position: sticky`, so it
correctly stays pinned to the top as the page scrolls — that part was
never broken, which is why the toggle button itself always felt
reachable. `#authDropdown` (the menu panel it opens) had no positioning
of its own, though, so it sat in normal document flow at its original
spot near the top of the page. Tapping the toggle after scrolling down
genuinely opened it (`max-height` really did expand) — just off-screen,
above the current scroll position, making it look like the tap did
nothing.

**Fix**: `#authDropdown` is now `position: fixed`, anchored directly
under the band regardless of scroll position. The band's actual height
isn't a fixed number (it grows for a device's notch via
`env(safe-area-inset-top)`), so rather than hardcoding an estimate,
`toggleAuthDropdown` (`js/auth.js`) measures the band's real rendered
height and sets it as a CSS variable (`--auth-band-height`) fresh every
time the menu opens.

**Verified, not just read over**: extracted the actual `toggleAuthDropdown`
code and ran it against a fake DOM across open → close → reopen, including
reopening with a deliberately different band height (simulating e.g. a
device rotation between opens) — confirmed it re-measures fresh each open
rather than caching a stale value, and that closing never touches the
height variable.

**Files changed:**
```
index.html
sw.js
css/nav.css
js/auth.js
CHANGELOG.md
TESTING.md
```

---

## V3.26.1 — Dhor card position-selector redesign + a real latent bug fix (2026-08-02)

Follow-up patch within the Phase B round, confirmed in chat after reviewing
a live screenshot: the "Starting at" field always read "Quarter N" even
when Half or Full was the selected unit, which looked contradictory
("Half" next to "Quarter 1") even though the two fields were internally
consistent.

**The dropdown is now a switch, tied to the Amount/Unit value.** Quarter
shows a 4-way switch labeled 1/2/3/4; Half shows a 2-way switch labeled
1/2; Full (Juz) hides the position field entirely — a whole juz' has
exactly one valid starting point, so there's nothing to choose. The Juz/
position row collapses to one column when Full is selected, so Juz's own
field expands to fill the space rather than leaving an empty gap.

**A real bug, not just a labeling one**: switching the Amount switch
never reset Position. Pick Quarter 3, then flip to Full without touching
Position again, and the app would silently compute a segment running
into part of the *next* juz' — not the whole current one — since nothing
ever forced Position back to a value that made sense for the new unit.
Hiding the field for Full (and forcing it to the one valid value) closes
that off structurally, not just visually.

**Works identically for 15-line accounts**, which store raw positions
differently under the hood (15-line has 8 raw markers/juz', not 4) —
Quarter and Half always resolve to exactly 4 and 2 valid slots regardless
of which print is active; only which underlying raw value each slot maps
to differs by ref. Confirmed directly: extracted the real
`renderDhorPositionOptions` code and ran it against both reference
systems, checking the exact raw values each slot produces, not just the
labels.

**Reused, not rebuilt**: the shared switch component (`js/uiSwitch.js`)
already computes option width as a percentage of however many slots
exist — no changes needed there to go from 3-way to 2-way/4-way. A 2-way
variant already existed elsewhere (gender), so this wasn't new ground for
that component, just a new caller of it.

**One behavior worth knowing**: switching Quarter↔Half manually resets
Position to the first slot rather than trying to carry over an
equivalent position — confirmed as the simpler, more predictable choice.
Prepopulation (today's plan, continuing from history, or a Plan Dhor
selection) is unaffected by this reset — those paths set Position to the
actual planned value before the unit switch runs, and that value is
deliberately left alone.

**`renderDhorPicker`** (the old function that unconditionally rebuilt the
position dropdown's options, regardless of unit) is removed — fully
superseded by `renderDhorPositionOptions`, which `setDhorUnit` now calls
directly.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.26.0 — Pure queue model, Phase B: Dhor card prepopulation rewire (2026-08-02)

Second of the 4-phase rebuild. Rewires `js/dhorPage.js` to actually match
the engine V3.25.0 shipped, rather than still branching on sources that
engine can no longer produce.

**The open-time top-up call is gone.** `renderDhorScreen` used to call
`apiEnsureDhorSchedule()` before asking for today's default entry, on the
theory that this would generate a fresh row if one was missing. Since
V3.25.0 made that function an unconditional no-op, the call never changed
what the next fetch would return — removed entirely rather than left as
a pointless round-trip.

**Result-handling collapses to the 3 sources that can actually occur**:
`today_plan`, `continue_last`, or nothing. The `missed_plan`/`future_plan`
branches (impossible since V3.25.0) and the `first_segment` reference
(already impossible since V3.24.0, just never cleaned up) are removed
from both the result-handling `if`/`else` chain and `renderDhorPlanBanner`'s
text map.

**The inline "which one do you mean" picker is gone.** A same-day batch
of more than one `plans` row used to force the student to pick one before
anything pre-filled (the "never auto-selected" rule from V3.9.0) — this
is the one deliberate behavior reversal in the whole 4-phase rebuild,
confirmed in chat. Now the FIRST item in the batch is always pre-filled
directly, fully editable same as any other default; the banner names the
count ("Pre-filled from today's plan (1 of 4 — see Plan Dhor for the
rest)") rather than offering an inline chooser. The rest of the batch
stays visible and selectable through Plan Dhor, which is untouched by
this phase and still shows every row.

**Versioning**: bumped every `?v=` reference in `index.html` and `sw.js`'s
`ASSETS`/`CACHE_NAME` from 3.24.1 to 3.26.0, across all files, not just
`dhorPage.js` — per `CONVENTIONS.md` principle 10, even though only one
JS file's content actually changed.

**Verified, not just read over**: extracted the actual (post-edit)
`renderDhorPlanBanner` function from the delivered file and ran it
against a minimal fake DOM for a single plan, a batch of 4, `continue_last`,
a null source, and a now-dead source (`missed_plan`) — confirmed each
produces the right text, and specifically confirmed the old inline-picker
markup (`data-plan-id`, `#dhorPlanChoices`) is genuinely never generated
any more, not merely hidden.

**Not touched in this delivery, by design**: Plan Dhor's own "Dhor Plan"
tab content (still the yesterday/today/next-5-days layout from V3.24.1)
is Phase C. Setup's "Tomorrow's Portion" and the live purge of existing
`plan_type='dhor'` rows are Phase D. The two prepopulation gaps documented
in V3.24.1 (pool-emptiness checked before `dhor_log`; the manual picker's
Save not updating `baseline_selection`) remain parked, unaffected by this
phase.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.25.0 — Pure queue model, Phase A: scheduling engine rewrite (2026-08-02)

First of a 4-phase rebuild (confirmed in chat) correcting the underlying
Dhor scheduling model. The model shipped through V3.24.1 treated `plans`
as a calendar of dated commitments — a rolling window of future rows,
pre-generated ahead of time, with "missed" (backdated catch-up) and
"future" (borrowed early) fallbacks for whenever that window didn't line
up with today. Confirmed wrong: `plans` is a single ordered QUEUE, no
dates baked into any not-yet-done item. "Continue from where it left off"
always means the last thing actually logged in `dhor_log`, with the queue
picking up right after it — nothing else. If a daily quota is 4 halves and
only 2 get done, the other 2 simply stay first in the queue, done
whenever the student next does Dhor; there's no separate "missed" or
"future" concept to reconcile.

**`ensureDhorSchedule` (`worker/src/dhorSchedule.js`)**: the entire
rolling-window generation loop is removed — it used to walk the next 7
active days and INSERT dated `plans` rows ahead of time; now it's a
harmless no-op (`{ generated: 0 }`), unconditionally. Kept rather than
deleted so its two existing callers (dhorPage.js's open-time top-up, and
Setup's save handler, which would otherwise show a false "Couldn't save"
error if this started throwing) don't need to change in this phase. The
now-unused `DAY_ABBR`/`WINDOW_DAYS`/`addDays`/`dateToUTCWeekday` helpers,
which only existed to support that loop, are removed with it.

**`computeDefaultDhorEntry`**: collapses from 5 branches to 1 rule — an
explicit override for today if a `plans` row exists for it (the only way
one currently can, since generation no longer creates any), else ALWAYS
the segment following the last logged entry. The "missed plan" and
"future plan" branches are removed entirely — they only ever existed
because plans used to carry dates. `buildChunks`/`findChunkIndexForSegment`
are unchanged and still do the actual chunking work for the fallback
branch. Verified directly (not just read over): a small standalone
harness mocking `env.DB` confirmed `ensureDhorSchedule` now touches the
database zero times, and confirmed `computeDefaultDhorEntry`'s three
remaining outcomes (today's plan / continue from last / genuinely blank)
each still produce the right shape.

**Not touched in this delivery, by design**: dhorPage.js still has
handling code for the now-impossible `missed_plan`/`future_plan` sources
(dead, not broken — same pattern as `first_segment` becoming dead code in
V3.24.0) — cleaning that up, and wiring the card's own prepopulation to
auto-populate the first item of a multi-item batch, is Phase B. Plan
Dhor's Dhor Plan tab (yesterday/today/next-5-days) is Phase C. Setup's
"Tomorrow's Portion" and the live-DB purge of existing `plan_type='dhor'`
rows are Phase D — confirmed to ship without an intentional pause after
this phase, rather than holding D back as a separately-timed step. Also
carried forward, unaffected by this phase: the two prepopulation gaps
documented in V3.24.1 (pool-emptiness checked before `dhor_log`; the
manual picker's Save not updating `baseline_selection`).

**Files changed:**
```
worker/src/dhorSchedule.js
SCHEMA.md
CHANGELOG.md
TESTING.md
```

---

## V3.24.1 — Dhor Schedule generation fix + Dhor Plan tab redesign (2026-08-02)

Found through live debugging on two real accounts, both traced to
verified root causes rather than assumed — two earlier hypotheses
(an empty `dhor_days_of_week`, a silently-failing generator) were
checked directly against the data and ruled out before the actual
cause was found.

**Real bug in `buildChunks`**: `sessionSize = quartersPerUnit *
quantity` was multiplying quantity INTO each chunk's size, so "Half
granularity, quantity 2" produced one combined full-juz-sized chunk per
session instead of two separate half-sized ones. Confirmed correct
behavior: "Two half juz twice a day should generate four rows every
day" (2 sessions × 2 portions/session = 4 separate half-sized rows).
Fixed: `buildChunks` now always produces chunks at exactly one
granularity-unit each; `quantity` multiplies into rows-per-active-day
in `ensureDhorSchedule`'s generation loop instead. Worth knowing: this
only affects rows generated *after* this fix — a day's row-count is
locked in whenever that day was "tomorrow" in an earlier generation
run, so already-existing plan rows (e.g. from before this update) won't
retroactively split into the corrected shape; only fresh generation for
not-yet-reached days will.

**Dhor Plan tab was missing every row's date** — fixed, now shows
`target_date` on every row.

**The Dhor Plan tab's actual job, reframed and rebuilt**: not just
"today's session," but yesterday (was it covered) / today (confirm
what's expected) / the next 5 days (what's coming) — confirmed as the
minimum useful view. Today shows every row individually. Yesterday and
each of the next 5 days roll up into ONE summary row per day when there
are multiple sessions that day — "[date]: Portion A to Portion B" (the
earliest session's start through the latest session's end). Every row
gets a checkbox; a plan already `status='completed'` shows checked and
disabled rather than a live control. A rolled-up day with genuinely
mixed completion (some sessions logged, some not) is expandable instead
of trying to represent that in one ambiguous checkbox — tapping it
reveals the individual underlying sessions, each with its own normal
state. Confirmed: this tab stays view-only for plans themselves (no
edit/delete facility for a plan's date or portion exists anywhere) —
selecting a portion here loads it into the Dhor card's own form, same
as everywhere else in Plan Dhor; the user still saves from there.

**Not in this delivery, documented but not yet fixed**: two other
prepopulation bugs found during this same debugging session —
`computeDefaultDhorEntry` checks whether the pool is empty before ever
querying `dhor_log`, so a student with an empty Setup pool but real
logged Dhor history never gets branch 4 ("continue from last entry") a
chance to fire; and only Plan Dhor's own save path adds a newly-logged
segment to `baseline_selection` — the regular manual picker's Save does
not, breaking "logging Dhor builds history" for that path specifically.
Both documented for a future round, not folded into this one.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
worker/src/dhorSchedule.js
CHANGELOG.md
TESTING.md
```

---

## V3.24.0 — Plan Dhor (2026-08-02)

The full Plan Dhor rebuild, replacing the read-only "View Plan" popup
entirely, plus the row layout changes and a global spelling sweep that
were queued alongside it.

**Global spelling sweep**: "Juz'" → "Juz" across every piece of
user-facing text in the app (10 fixes across 5 files) — deliberately
scoped to display text only, not internal code comments.

**Dhor card layout**: Row 2 is now Date : Plan Dhor : Dhor History in a
40:30:30 grid with fixed-height, wrapping (not truncating) buttons. Row
3 is Amount as a 3-way switch (Quarter/Half/Full), reusing the app's
existing shared switch component, sized to 75% of Row 2's height via a
CSS custom property rather than a guessed value. Row 6's Duration field
changed from decimal minutes to mm:ss text (placeholder "mm:ss",
colon-less digits read as whole minutes), labeled "TIMER" instead of
"Stopwatch" — and since mm:ss is a lossless round-trip (unlike the old
1-decimal-minute display), the V3.21.1 exact-seconds-bypass mechanism
is gone entirely, a real simplification, not just a rename.

**Plan Dhor**: the "View Plan" button is renamed "Plan Dhor" and opens a
much richer screen — a title/Save/Close row, then a 3-way tab switch
(Dhor Plan / View All Completed / View All). Dhor Plan shows today's
scheduled sessions as simple independent checkboxes (this is also where
the old inline "more than one plan for today" picker moves to and is
removed from the card entirely). The two View tabs show all 30 Juz,
grouped with the same roll-up/down mechanism already proven for Sabaq
Dhor, using **tap-first, tap-last range-select** rather than per-row
checkboxes — tap a start point, tap an end point, everything between is
selected; a third tap starts an entirely new range rather than
extending it, which makes a non-contiguous selection structurally
impossible to create. A Select All action is included. View All greys
out anything not yet marked complete but keeps it selectable — saving
something not yet in the pool adds it to `baseline_selection`.

**Save logic, deliberately simple**: if the selection reduces to one
clean quarter/half/juz, it populates Juz/Position/Amount exactly as the
manual picker already does, and Mistakes/Duration work normally.
Anything else (doesn't reduce to one clean unit, or spans more than one
juz) shows: *"Your times and mistakes will not be recorded for this
selection. Cancel to review, OK to continue."* Continuing switches the
card into a From/To display — Mistakes, Tajweed, and the Timer become
disabled, Notes stays available — and tapping either From or To reopens
Plan Dhor with the current selection already ticked, rather than being
edited inline. The user still has to hit the card's own Save to create
the record; Plan Dhor only ever populates the form. (An earlier,
considerably more complex design — decomposing a selection into
multiple clean groups and proportionally splitting mistakes/duration
across them, with a 5-checkbox cap and a 2-run non-contiguous cap — was
fully worked through in chat and then deliberately scrapped in favor of
this simpler version before any of it was built.)

**Backend correction**: `computeDefaultDhorEntry`'s "no plan, no
history at all" case used to default to the first eligible segment —
changed to genuinely blank, since a brand-new student with nothing in
their pool yet realistically isn't doing Dhor. Once their first entry
is ever saved, the existing "continue from last entry" logic takes over
normally — logging builds history the same way Setup's baseline marking
does.

**Caught before shipping:** two real gaps found while reviewing this
before packaging, not after. (1) No CSS had actually been written for
the entire Plan Dhor modal — it would have rendered completely
unstyled. Added comprehensively, reusing the same shared-grid pattern
already proven for Sabaq Dhor's checkbox list. (2) Editing an existing
Dhor entry while raw-range mode was active would have left Mistakes/
Duration stuck disabled and a stale From/To row visible underneath the
edit screen — `loadDhorEntryForEdit` now exits raw-range mode first.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/journal.js
js/position.js
js/dhorPage.js
js/settingsScreen.js
worker/src/dhorSchedule.js
CHANGELOG.md
TESTING.md
```

---

## V3.23.1 — Dhor layout polish, pre-Phase B (2026-08-01)

Confirmed batch of Dhor-specific UI changes, requested before moving on
to Phase B:

- **Amount + View Plan** now sit in their own row directly below the
  date (reusing the date row's exact grid for visual consistency).
  **View Plan** is new — a popup listing upcoming scheduled Dhor
  sessions (`plan_type='dhor'`, `status='planned'`, `target_date >=`
  today), the mirror image of History's popup but facing forward in
  time instead of back. Reuses the existing `/plans?since=` query,
  no backend changes needed for this one.
- **Mistakes + Tajweed** now share one line, matching the pattern
  already used elsewhere (Sabaq's Lines/Pages, Sabaq Dhor's own
  Mistakes/Tajweed from V3.20.0).
- **Duration + Stopwatch**: Duration's column is now a clean 50% (same
  `.picker-row` grid used everywhere else), with a Stopwatch icon
  button (user's exact `timer.svg`) beside it, centered. The actual
  timer widget (Start/Stop/Lap) is no longer always visible — it's
  hidden by default and toggles open/closed via the Stopwatch button.
- **"Seg X-Y" replaced with "Juz X" / "Juz X H1"-"H2" / "Juz X
  Q1"-"Q4" everywhere it appeared** — the History popup, the
  multi-plan-for-today picker, and the edit-screen's "not editable
  here" text. This was explicitly parked in three earlier rounds
  specifically for "when Dhor's own detail work happens" — this is
  that moment. New `describeDhorSegment` helper reuses the existing
  `segmentRangeToPicker` rather than re-deriving juz'/unit a second way.

**Also fixed while restructuring:** Amount is functionally part of the
same segment-determination system as Juz'/Starting-at (all three
together produce `segment_from`/`segment_to`), so it needed to hide
during edit alongside the segment picker for the same reason those two
already do — moving it into its own row for layout purposes had
initially left it out of that hide/show toggle; caught and fixed before
shipping rather than after.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.23.0 — Dhor detail rebuild, Phase A (2026-08-01)

**Dhor's default entry is no longer just "today's plan or blank."**
Confirmed design: `computeDefaultDhorEntry` (new, `worker/src/dhorSchedule.js`)
now checks, in order: (1) today's plan(s) — unchanged from before; (2) no
entry for today → the most recently MISSED plan, backdated to *that
plan's own date* (a genuine catch-up entry, not logged as today); (3) no
missed entries → the closest upcoming plan, borrowed early under today's
date; (4) no plan at all but real Dhor history exists → the segment that
follows the last logged entry, walking the eligible pool forward at
*that entry's own granularity* — a deliberate choice to match what the
student actually just did, not the account's configured Setup
granularity/quantity (which is what `ensureDhorSchedule`'s own anchor
logic uses for auto-generating future plan rows — a related but
different question); (5) no plan and no history at all → the very first
eligible segment, quarter granularity.

Reuses the existing `buildChunks`/`findChunkIndexForSegment` (this same
file, already proven via `ensureDhorSchedule`) rather than building a
second copy of that gap-aware chunking logic. New endpoint:
`GET /dhor-schedule/default-entry`. The Dhor form now shows a hint
explaining *why* something was pre-filled ("catching up on...",
"continuing from your last session", etc.) instead of populating
silently.

**3 UI fixes, applied across all 3 cards** (shared CSS/HTML, not
Dhor-specific) since they're deferred groundwork for this same rebuild:
- Cancel removed from the edit-screen top bar (redundant with the bottom
  bar's Cancel) — and the now-orphaned JS listeners for those buttons
  were removed too, checked deliberately given how the last critical bug
  happened.
- The date field is no longer a fixed 30% column that could truncate the
  rendered date — now sized to its own natural width.
- History moved into the same row as the date field, right-justified
  with edge padding, height-matched to the date field via the row's own
  `align-items:stretch` rather than a hardcoded pixel value. Width was
  deliberately left unconstrained (sized to its own label) rather than
  forced to match the date field's width too, since "Sabaq Dhor History"
  would otherwise risk wrapping on a narrower screen — flagging this as
  a specific interpretation choice, not an oversight.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/api.js
worker/src/dhorSchedule.js
worker/src/index.js
CHANGELOG.md
TESTING.md
```

---

## V3.22.1 — Edit screen polish + null-entry crash fix (2026-08-01)

Three fixes, all confirmed in chat after V3.22.0 went live:

**Topbar/date order was backwards.** The confirmed layout was "Editing
[Type] from [date]" as Row 1, date field as Row 2 below it — V3.22.0
built it in the opposite order. Fixed by reordering the two elements in
`index.html` for all 3 cards. The edit topbar is hidden in normal view
regardless, so this has no effect outside edit mode.

**Sabaq's Delete button now hides entirely for the frontier entry**,
rather than just being disabled — same restriction as before (deleting
the entry `position.sabaqTo` is currently based on isn't allowed), just
not shown as an option at all instead of shown-but-greyed-out.

**Real crash fixed: entries with a null sabaq_from/sabaq_to (shown as
"null-null" in History) couldn't be opened for editing at all.**
`loadSabaqEntryForEdit` called `.split(':')` directly on
`entry.sabaq_from`/`entry.sabaq_to` — if either is genuinely `null`
rather than a string, that throws immediately, before anything else in
the function runs. Since the History popup had already closed by that
point, the failure was invisible: the screen just silently stayed on
the normal Sabaq view, with no way to reach Delete for that entry at
all. Fixed with a small parsing helper that falls back to the same "—"
placeholder state `renderVerseRefField` already shows for a genuinely
empty field, instead of crashing — the edit screen (and Delete) now
opens correctly for these entries regardless of how malformed their
historical data is.

**Files changed:**
```
index.html
css/detail-pages.css
js/sabaqPage.js
sw.js
CHANGELOG.md
TESTING.md
```

---

## V3.22.0 — Dedicated edit screen + Delete (2026-08-01)

**Edit now opens as a full takeover, not an inline banner.** Confirmed
design: tapping the pencil icon on a History row now hides the tabs/dots
row and every card except the one being edited, and within that card
replaces the normal header (icon/heading/Save) with a grey top bar
reading "Editing [Type] from [date]" + Cancel, and adds a matching grey
bottom bar with three centered buttons: Cancel, Delete (red background),
and Update (styled exactly like the existing Save icon). This isn't a
new entry in the screen router (`js/app.js`) — it's a mode toggle within
the existing log-detail screen, specifically so the already-working
verse-ref grid, tajweed picker, and comment block don't need to be
rebuilt a second time for a separate screen.

**Delete is now wired up**, reusing the DELETE endpoints that already
existed server-side (confirmed in an earlier chat, never previously
attached to any button): `apiSabaq.remove`, `apiSabaqDhor.remove`,
`apiDhor.remove`. Confirmation wording, exact as specified: "Deleting
this entry may create gaps in your history which cannot be recovered.
Are you sure you want to DELETE?"

**Sabaq's Delete button is disabled (not hidden) for the frontier
entry** — the one `position.sabaqTo` is currently based on — since
deleting it would leave position pointing at a row that no longer
exists. Sabaq Dhor and Dhor have no such restriction; neither has a
position concept tied to individual entries.

**Consistency pass while rebuilding this:** Dhor's segment picker
(Juz'/Starting at/Amount/plan banner) now hides during edit, matching
Sabaq Dhor's existing precedent of hiding pickers that reflect today's
live options rather than what was actually chosen on the edited day —
previously it stayed visible but non-functional during edit, which
could read as if changing it did something.

**Caught before shipping, not after this time:** the three `renderX
Screen()` functions that reset stale state on every fresh screen open
still referenced the old banner element IDs removed by this same
change — the identical *shape* of failure as V3.21.2's critical bug
(a missing element reference that would silently break the screen),
just caught this time by deliberately grepping for the old IDs before
calling this done, rather than after a user found it live.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

**Post-delivery correction:** `js/logDetailScreen.js` — which holds
`enterEditScreenMode`/`exitEditScreenMode` themselves, referenced by all
three of the files above — was edited as part of this change but
accidentally left out of the zip that was actually delivered. Confirmed
live: `ReferenceError: Can't find variable: exitEditScreenMode`, and
History disappearing again, for the same underlying reason as V3.21.2
(a function call to something that doesn't exist where it's being
called from) but caused by an incomplete delivery this time, not a code
ordering mistake. Re-delivered as a single-file follow-up; no code
changes, no version bump — `js/logDetailScreen.js` was already tagged
`?v=3.22.0` in `index.html`, it just hadn't actually been uploaded yet.

---

## V3.21.2 — CRITICAL FIX: Save was broken on all 3 cards (2026-08-01)

**Root cause: `EDIT_HANDLERS` was used before it was declared.** V3.21.0
added `js/dhorPage.js:237: EDIT_HANDLERS.dhor = loadDhorEntryForEdit;`,
but the `const EDIT_HANDLERS = {}` declaration itself didn't get added
until line 328 — much further down in the same file. A `const` binding
is unusable from the top of its scope until its own declaration line
actually runs, so line 237 threw
`ReferenceError: Cannot access 'EDIT_HANDLERS' before initialization`
the instant the page loaded, which halted every remaining top-level
statement in that script.

That's a much bigger problem than it sounds, because **Save's click
handler is wired up further down in the same file, after that line** —
so it never got attached. Since the crash meant the `const` itself never
ran, `js/sabaqPage.js` and `js/sabaqDhorPage.js` (which load after
`dhorPage.js` and each do their own `EDIT_HANDLERS.sabaq = ...` /
`EDIT_HANDLERS.sabaqDhor = ...`) hit the identical error, halting their
scripts too — and their Save handlers are wired up right after those
lines as well. **Net effect: Save silently stopped working on Sabaq,
Sabaq Dhor, and Dhor, and History never appeared on any of the 3 cards**
(`renderRecentEntries`, defined further down in the crashed
`dhorPage.js`, was never successfully reachable either). Confirmed live
in the repo the user re-uploaded, not just suspected from re-reading the
code.

**Fix:** `EDIT_HANDLERS` is now declared right at the top of
`js/dhorPage.js`, before anything in any of the three files can
reference it. This is the only change needed — the assignments and
usages elsewhere were already correct, they just needed the declaration
to actually exist first.

**Also, Sabaq Dhor's checkbox alignment — genuinely fixed this time.**
The 80:20-grid-per-row approach from V3.20.0/V3.20.1 was the wrong tool
for cross-row alignment: each row computed its own 80%/20% split against
its own box, so consistency across rows was never actually guaranteed,
just usually close. `#sabaqDhor_sections` is now itself ONE shared CSS
grid (`1fr auto auto`); every row contributes exactly 3 direct grid
children (text, a Move-to-Dhor button or an empty placeholder to keep
column position stable, checkbox) so every checkbox genuinely shares the
same column across every row, the way an HTML table's cells would.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.21.1 — Dhor duration becomes a real input (2026-08-01)

**Note on this delivery: bundled with V3.21.0.** V3.21.0 was never actually
uploaded to production, so this zip contains every file changed by BOTH
V3.21.0 and V3.21.1 together — the live site is still on V3.20.0.

**Duration is now a genuine user input, not something only the timer can
set.** Confirmed in chat: the timer is meant to be an assistive feature
that fills duration in for you and additionally captures lap times (real
richer data a manual entry can't provide) — it was never supposed to be
the *only* way to record a duration. Previously there was no manual
field at all; `js/timer.js` has no `<input>` elements, so
`duration_seconds` could only ever come from actually running the timer.

Added a "Duration (minutes)" field above the timer. The timer auto-fills
it (and separately captures lap times) when used, but it's directly
editable at any time — before, during, or after using the timer.
Stored value is still seconds (unchanged column), entered/displayed in
minutes.

Two precision/consistency details, both confirmed in chat:
- The field displays 1 decimal place, but the timer's real precision
  isn't lost to that rounding — if the field is left exactly as the
  timer set it, saving uses the timer's exact seconds value directly,
  not a re-parse of the rounded "12.6" display text. Detecting "did the
  user actually touch this" relies on a real quirk: setting `.value`
  programmatically doesn't fire an `input` event, only genuine typing
  does — so the auto-fill and the override-detection cleanly never
  collide.
- Manually overriding the duration clears lap times, since laps that no
  longer sum to the new total would be actively misleading rather than
  just unused.

This also meant fixing V3.21.0's Dhor edit flow: duration and lap times
were excluded from editing specifically because no editable field
existed for them yet. That reasoning no longer applies now that one
does, so editing a past Dhor entry includes them like any other field.
Segment (from a picker reflecting today's live options, not what was
actually chosen on the edited day) is still excluded — that part of the
original reasoning still holds.

**Files changed (includes V3.21.0's files, since that hadn't shipped
yet):**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.21.0 — Edit past entries + checkbox alignment fix (2026-08-01)

**Sabaq Dhor checkbox alignment** — the fix identified but held back last
round is now in: `.sabaq-dhor-section-row span` gets `min-width: 0`, so a
longer label like "Quarter 3 (current): 83:1 - 86:2" wraps within its 80%
column instead of overflowing it and dragging that row's checkbox out of
line with shorter rows.

**Editing past entries — confirmed design.** A single edit (pencil) icon
per row in the History popup (Sabaq/Sabaq Dhor/Dhor), loading that entry
into the card's own form rather than a separate edit UI — reuses every
existing field/picker/validation as-is. Saving PATCHes the row.

The important nuance, confirmed in chat: this is NOT "delete and re-save
for every edit." That would be actively risky — recomputing Sabaq's
position from whichever entry happens to be getting a typo fixed today,
even a weeks-old one, would silently drag the student's position
backward. Position is now only ever recomputed when the entry being
edited is confirmed to be the current frontier (the one `position.sabaqTo`
was actually derived from — checked once, when the entry is loaded, by
comparing it against the most recent entry in that student's own history).
Editing any other Sabaq entry saves the content and leaves position alone.

Sabaq Dhor and Dhor have no position side effects to worry about, but
have their own real constraint: their range fields (Sabaq Dhor's
from/to, Dhor's segment_from/to) reflect a picker or checkbox set built
from *today's* live options, not whatever was actually true on the day
being edited — there's no way to correctly reconstruct that UI for a
past entry. So editing those two only ever touches mistakes, tajweed
tags, and notes; the range (and Dhor's timer data, which can't be
redone either) is simply never included in the PATCH and stays exactly
as originally recorded. The banner shown while editing says so
explicitly, and the section checkboxes / rollup stepper are hidden on
Sabaq Dhor while editing since they'd otherwise look actionable but
silently do nothing.

Also fixed while building this: reopening any of the 3 cards now
explicitly resets editing state. Without it, closing the screen mid-edit
(e.g. via xclose) without saving or cancelling would leave the next
save on a fresh visit silently PATCHing the old entry instead of
creating a new one.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.20.0 — Prepopulation frontier fix + UI polish (2026-08-01)

**Sabaq position frontier — two more real bugs found live, after V3.19.0.**

Bug 1: `advancePositionAfterSabaq` still trusted "to" as the frontier
unconditionally. That breaks for a bulk/historical catch-up entry whose
fields were filled in ascending numeric order rather than the juz's
actual study/chronological order — e.g. From=88:1/To=114:6 for a juz' 30
student actually means surahs 89-114 are fully done and only ayah 1 of
88 is, so 88:1 (not 114:6) is the real frontier. Fixed by comparing both
endpoints via `shared/data.js`'s existing `compareVerseKey` against the
juz's real study direction (lower endpoint = frontier for juz' 30,
higher = frontier for every other juz'), instead of assuming either
field always plays a fixed role. This corrects the logic from here
onward; it does NOT retroactively fix already-stored position data for
students already affected by the old logic — that needs a one-time
direct D1 correction, separate from this delivery.

Bug 2: `nextSabaqDefaults` gated on `hasDhor` unconditionally, so a
student with real Sabaq history AND any Dhor history at all got nothing
prepopulated. The no-prepopulate rule was only ever meant for the
no-Sabaq-history case — real Sabaq history should always prepopulate
regardless of Dhor history. This one needed no data correction: the
underlying position record was already correct, only the display logic
was wrong.

**UI polish, all confirmed in chat:**
- Save button (all 4 cards): icon doubled in size, whole icon+label unit
  now centered both ways within its grid cell instead of hugging the
  column's right edge.
- Sabaq Dhor section rows: rebuilt as an explicit 80:20 grid (text :
  checkbox) instead of flex + space-between, so the checkbox sits at a
  consistent position across every row instead of trailing wherever that
  row's text happens to end.
- Sabaq Dhor: Mistakes and Tajweed now share one line, reusing the same
  `.picker-row` 2-column pattern already used for Sabaq's own Lines/Pages
  fields.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/position.js
js/sabaqPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.19.0 — Detail-screen UI round 4 + real prepopulation fix (2026-07-31)

**Sabaq prepopulation — real root cause found, not a rendering issue.**
`shared/data.js` already had a fully-written, exported helper,
`nextSabaqPosition`, specifically for advancing one ayah past a given
position in the correct study direction (backwards for juz' 30, forwards
otherwise) — it just was never actually called anywhere. `nextSabaqDefaults`
(`js/position.js`) was reusing `position.sabaqTo` directly as the new
From/To, which repeats the exact ayah the last entry already ended on
instead of continuing past it. Fixed by wiring `nextSabaqPosition` in;
also added a `juzComplete` check so prepopulation stays silent (rather
than guessing) once advancing would leave the juz' entirely.

**Icon-button convention.** The Save button (all 4 cards) now matches
Hifzhelper's own existing `.nav-icon-item` pattern — icon on top, label
below, no border/background — instead of being a special-cased bordered
button. This is the new default for in-app icon buttons generally, not
just Save. Label stays normal weight; caps come from `text-transform`,
not the underlying string.

**Xclose control.** The log-detail screen (Sabaq/Sabaq Dhor/Dhor/Tadabbur)
now has an exit icon on the right of the swipe-dots row, using the
provided Lucide `square-x` source. Exits to Journal — the app has no
navigation history stack, just direct screen switches, and Journal is the
landing page this screen is always reached from. The dots row is now a
3-column grid (spacer:dots:close) so dots stay centered independently of
the close button; only the dots hide on desktop (≥1180px), the close
button stays visible at every size.

**Sabaq Dhor "Sections to revise" redesign.** Heading text removed
entirely; "Mark sections revised" now labels the checkbox list
specifically. Checkboxes moved to the right side of each row. Default
changed from checked to unchecked — this was a real bug, not styling:
`renderSabaqDhorRows` was hardcoding `checked` on every row, forcing
everything pre-selected instead of letting a student actually mark what
was revised. The existing "please check at least one section" validation
in the save handler already covers the resulting empty-selection case, no
changes needed there.

**Rollup control redesign.** The two rollup buttons are now a compact
2-icon vertical stepper sitting to the left of the section list (was a
full-width row above it), using the provided Lucide
`list-chevrons-down-up`/`list-chevrons-up-down` icons in place of the
plain ▲/▼ glyphs. Each button is now hidden entirely (not just a no-op
tap) whenever its direction wouldn't actually change anything — rather
than hand-duplicating `computeSabaqDhorRows`' own merge conditions
(pairs, full-juz' logic, lingering-juz' rows) to detect eligibility
separately, `updateRollupStepperVisibility` computes the rows one level
up and down and compares row-id sets directly, so eligibility can never
drift out of sync with what the button would actually do.

**Deferred, not in this round:** relabeling the Dhor Plan picker's raw
"Seg 113-116"/"Seg 117-120" buttons (segment_from/segment_to quarter-unit
IDs) into a human-readable form — parked for when Dhor's own detail work
happens.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/position.js
js/sabaqDhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.18.0 — Detail-screen UI round 3 (2026-07-31)

Bismillah. This round's scope was fixing UI items confirmed after V3.17.0
went live — Sabaq Dhor confirmed working, so this leaves the Sabaq
prepopulation bug for a later revision as agreed, and focuses purely on
this round's UI list.

**Header, all 4 cards**: rebuilt as two explicit CSS grids instead of the
old flex row — row 1 is icon:heading:save at 10:70:20, row 2 is
date:blank at 30:70. `save-status` and the Save button are now grouped
into one wrapper so they share column 3 as a single grid item instead of
each auto-placing into its own column.

**Notes/Private**: the Private checkbox + label move up onto the same
row as the "Notes" label itself, replacing the row that used to sit
below the textarea.

**"Recent" → History button only**: the heading text is gone entirely,
and the last-2-entries list under the History button is removed per the
confirmed scope — the button alone (now compact and dark green/Evergreen,
with type-specific text: "Sabaq History", "Sabaq Dhor History", "Dhor
History") is enough for now. It still opens the same full popup (up to
50 entries) as before.

**Verse-ref fields (Sabaq from/to) — real bug found, rebuilt, not
patched**: these were flagged as "erratic"/chevrons "not visible at all."
Root cause: the flex version had no `min-width` guard on the surah
label, so a long name could eat into a sibling's share depending on
exactly how much room flex gave it that render — the same underlying
issue (an unconstrained sibling silently stealing a neighbour's assigned
space) as the V3.14.1 ayah-width bug, just via flex-basis this time
instead of a specificity fight. Rebuilt as an explicit 4-column CSS grid
(chevron:Surah:Ayah:chevron at 10:50:30:10, confirmed in chat) with
`min-width: 0` on every text-bearing cell, so each column keeps its
assigned share regardless of content length. Left chevron is unchanged
(still opens the surah picker). **New**: the right-hand chevron column
is an explicit up/down stepper for the ayah value — added because it
was the *native number input's own spinner* that wasn't rendering, so
this replaces reliance on it entirely rather than trying to make it
visible; dispatches a `change` event so it flows through the exact same
sync/recompute logic as typing a value in directly. Flagging this as an
assumption, not a confirmed spec: the 4th column's exact behaviour
(ayah stepper) wasn't explicitly specified, just its width.

**Swipe dots — real bug found, root cause was outside the file being
debugged**: `updateLogDetailDots` compared `card.offsetLeft` against
`rail.scrollLeft`, which silently broke once `#appContent` gained
`transform: translateZ(0)` (V3.4.3's Safari-paint fix, in `css/base.css`)
— a transformed ancestor becomes the nearest `offsetParent` for elements
inside it in every major browser, so each card's `offsetLeft` was
actually measured from `#appContent`'s edge, several DOM levels above
the rail, not from the rail's own content box. That added a constant
(`#appContent`'s own padding) to every comparison, so a dot only flipped
"active" once you'd scrolled well past where the card had actually
snapped into place — matching the "erratic"/"misaligned" report exactly,
and invisible from reading either file in isolation. Fixed by switching
to `getBoundingClientRect()`, which is always viewport-relative and
can't drift the same way regardless of any ancestor's transform/position
tricks.

**Housekeeping**: the three Recent-rail container divs (`sabaqRecentRail`
etc.) previously carried the pre-V3.14.2 `.swipe-rail` class, left over
from before the History-button redesign and now meaningless (nothing
scrolls horizontally there any more) — given their own plain
`.history-container` class instead while already touching this markup.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/commentPrivacy.js
js/dhorPage.js
js/sabaqPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.17.0 — Phase 2b: the move-to-Dhor transition (2026-07-31)

Bismillah. Completes the Sabaq Dhor rebuild — the last piece confirmed
in chat, and the one most likely to have a subtle bug, given how many
moving parts it touches. Bundled complete, same as before: nothing from
V3.14.0 onward had been uploaded yet.

**Two independent paths to the same outcome**, confirmed in chat —
whichever fires first:
- **Manual**: a "Move to Dhor" button now appears next to any row that's
  eligible (halves and full juz' only, never a lone quarter) — clicking
  it adds that row's quarter-units directly into `baseline_selection`
  (Dhor Schedule's own eligibility pool, from V3.15.0's rework).
- **Automatic**: `js/position.js`'s new `maybeAutoMoveToDhor`, called
  right after every Sabaq save — if a previous juz' is still lingering
  and this save just completed at least one quarter of the *new* juz',
  whatever's left of the old one moves to Dhor on its own.

**Progressive eligibility, exactly as specified**: a lone quarter never
has the Dhor option. A First Half always does, once complete. A Second
Half only gets it once First Half has *actually* moved — checked
directly against `baseline_selection` membership (being in that pool
*is* "already moved"), not a separately-tracked flag. Caught a real bug
here before shipping: my first version only showed Second Half as a row
once First Half had moved, when it should always be visible for
revision — the sequential rule governs the Dhor *option*, not whether
the row shows at all. Fixed and re-verified.

**`previousJuz` tracking**: `advancePositionAfterSabaq` now preserves
every other field on `position` instead of replacing the object outright
— its first version would have silently dropped Phase 2a's rollup
preference on every single save, a bug caught in this round's own
review rather than shipped. It also now records which juz' was just left
behind whenever Sabaq crosses a boundary, which is what both the
lingering rows and the auto-trigger read.

Every scenario tested directly with real numbers before packaging:
juz' 30→29 crossing sets `previousJuz` correctly; the auto-trigger
correctly does *not* fire before a quarter of the new juz' is done, and
correctly *does* fire (with the right quarter-units) once it is; lingering
rows show both halves when neither has moved, only Second Half once
First has, and disappear entirely once both have.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/position.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```



Bismillah. This delivery bundles everything still pending from V3.14.0
onward (none of it had been uploaded yet) plus this round's work, all in
one download as requested — nothing here assumes any earlier zip made
it live.

**UI notes, all 4 detail cards:**
- Header is now 2 rows: row 1 is icon + heading (left) and Save (right,
  icon styled like the nav icons, with actual "Save" text next to it —
  reverses the icon-only version from before); row 2 is just the date,
  at 30% width. Putting date and heading on the same row didn't work in
  practice, per direct feedback on what shipped.
- Privacy reverts from the large Public/Private switch back to a plain
  checkbox next to "Notes" (default unchecked = public) — judged too
  much control for what's a minor, occasional toggle.
- "Recent" becomes a "History" button plus the last 2 entries shown
  stacked directly underneath; tapping History opens the full list (up
  to 50 entries) in a popup. Replaces the swipe rail entirely.

**Sabaq-specific: page count is now a fixed-standard capacity measure**,
not a real-page lookup — always divides by 13 lines/page and rounds
down to the nearest quarter-page (20 lines → 1.538 → 1.5), regardless of
mushaf print or which real pages were actually touched. Confirmed in
chat: this is a volume/capacity measure, not a progress tracker, so it
doesn't need real per-print page data at all — just the line count
(still computed properly per-print) divided by that constant.

**Phase 2a — Sabaq Dhor's rollup mechanism.** New `computeSabaqDhorRows`
(`js/position.js`) builds the actual displayable rows: the current,
still-in-progress quarter is always its own row and never rollable
(confirmed: only already-finished units can merge); completed quarters
can be rolled up via a chevron — 1+2 into "First Half", 3+4 into "Second
Half" (fixed pairing), both halves into "Full Juz'" — and back down
again. The rollup level is persisted per student
(`position.sabaqDhorRollup`) so it sticks across sessions. Tested 3
scenarios before shipping: an unmergeable lone completed quarter (its
partner not done yet), a clean half-merge, and the "nothing complete
yet" case (just the current row, chevron a no-op).

Each row also carries a `canMoveToDhor` flag (true for halves and full
juz', never a lone quarter) — this delivery doesn't act on it. The
actual move-to-Dhor transition (tickbox + auto-trigger) is Phase 2b, a
separate delivery once this mechanism itself is confirmed working.

**Files changed (cumulative — includes everything from V3.14.0 onward,
none previously uploaded):**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/position.js
js/dhorPage.js
js/sabaqDhorPage.js
js/commentPrivacy.js
js/reflectionCard.js
js/logDetailScreen.js
js/settingsScreen.js
worker/src/sabaqLog.js
worker/src/dhorSchedule.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files (cumulative):**
```
worker/migrations/0015_sabaq_from_to.sql
```



Bismillah. Foundational piece both Phase 2b (Sabaq Dhor's move-to-Dhor)
and Phase 3 (Setup's baseline marking) depend on, built first on its own
rather than duplicated inside each.

**`baseline_selection` now stores quarter-unit IDs (1-120), not whole
juz' numbers**, for `baseline_mode='juz'`. A juz' is always exactly 4
quarters, and Dhor's own "Portion per session" setting already only
ever works in quarter/half/full-juz' sizes — so representing the
eligibility pool at quarter granularity (the finest of those) means a
juz' can now be *partially* eligible, e.g. just its first half, which
there was previously no way to represent at all. `shared/data.js` gained
`quarterUnitId`/`quarterUnitToJuzQuarter`/`quarterUnitsForJuz`/
`quarterUnitsForHalf` for converting between a flat unit ID and its
juz'/quarter, print-independent (the logical quarter position is the
same across mushafs; only exact ayah boundaries differ by ref, resolved
separately).

**`dhorSchedule.js`'s chunk-builder reworked** to consume this flat pool
directly — groups *consecutive* quarter-unit IDs into session-sized
chunks (1/2/4 quarter-units per session, matching the granularity
setting), respecting gaps rather than assuming a whole juz' is always
available. Verified with 5 scenarios before shipping, including a pool
with a real gap (a juz' with only its first half eligible, second half
not) — chunking correctly treats that as its own group rather than
bridging into where the missing half would be.

**Setup's Juz' grid** still shows/marks whole juz' (unchanged UI) — it
now expands each marked juz' to its 4 quarter-unit IDs on save, and
shows a juz' as checked on reopen only when all 4 are already present.
Tested the full round-trip (mark → store → reopen → still shows
correctly, including a partially-covered juz' correctly NOT showing as
checked) before finalizing. Surah mode is untouched — still stores surah
numbers directly, and `dhorSchedule.js` already refuses to generate
anything for surah-based baselines, so it can't collide with the new
quarter-unit interpretation.

**Files changed:**
```
shared/data.js
worker/src/dhorSchedule.js
js/settingsScreen.js
SCHEMA.md
CHANGELOG.md
```



Bismillah. Small, contained fix while Phase 2 gets its own proper attention.

Found a real CSS bug from the screenshot: `.detail-page input`'s general `width:100%` rule was beating `.verse-ref-ayah`'s own `width:70px` on specificity (0,1,1 vs 0,1,0), which is exactly why the ayah box was stretching to fill the row instead of staying compact. Fixed by giving it a more specific selector and shrinking it further (46px, enough for 3 digits plus the browser's own spinner), freeing that space back to the surah name. Also removed the header row's ability to wrap — Save was dropping to its own second line on narrow widths because the date field plus everything else didn't quite fit on one row; the date field is now more compact too, so all of icon/title/date/Save fit on the same first row on every card.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
CHANGELOG.md
```



Bismillah. First of a new 4-phase plan replacing V3.12.0/V3.13.0's Sabaq/
Sabaq Dhor design, once it became clear a sabaq entry isn't confined to
one surah or one juz' the way that design assumed.

**`sabaq_from`/`sabaq_to`** (migration 0015) replace `surah`/`ayah_from`/
`ayah_to` entirely — a clean removal (both columns dropped, not left
deprecated-in-place, per explicit request), not just a rename: the old
trio had one surah shared by both ayah numbers, which couldn't represent
an entry spanning two different surahs at all. Each field is now a
`"surah:ayah"` string (e.g. `"114:6"`), and `sabaq_from`/`sabaq_to` can
each name a different surah. Confirmed scope: no limit on how many
surahs an entry spans, capped at crossing at most one juz' boundary
(`shared/data.js`'s new `crossesAtMostOneJuzBoundary`, which checks
adjacency in *study* order — juz' 29→1 counts as one boundary same as
29→30, even though those aren't numerically next to each other).

**UI**: each field is one combined control — a chevron opens the full
surah picker, the ayah itself is a bounded number input (browser stepper
or the numeric keypad), never rolling over into the next surah on its
own (confirmed: only the chevron changes the surah).

**Prepopulation**, replacing the old advance-by-one-ayah logic: any Dhor
history at all → neither field prepopulates; no Sabaq history yet →
114:1/114:6; otherwise the last reached point prefills *To* if currently
in juz' 30 (studied backwards) or *From* otherwise (studied forwards).
Tested directly, not just reasoned through: brand-new student → 114:1/
114:6; after logging into juz' 30's content → next open prefills To with
the frontier; after crossing into juz' 29 → next open prefills From
instead.

**Line/page calc now sums across every surah a span touches** — the
existing `getLines13/15ForAyahRange` functions still only understand one
surah each; new `getLinesForSpan` walks every surah between `sabaq_from`
and `sabaq_to` (handling juz' 30's reversed, high-to-low surah order,
not just ascending) and adds them up. Caught and fixed a real bug here
before shipping: the first version's surah loop assumed `from ≤ to`
numerically, which silently returned zero for any juz'-30-direction
span — re-verified with both directions before finalizing.

**Position tracking simplified**: `position_json` is now just
`{ sabaqTo, activeJuz }` — `sabaqTo` is the single source of truth,
`activeJuz` is derived from it after every save. The V3.12.0 behaviour
of auto-adding a completed juz' to Hifz Setup's `baseline_selection` is
REMOVED — that's superseded, now Setup's own job (a separate, later
phase). Sabaq Dhor's card (`sabaqDhorPage.js`) is untouched in this
delivery and keeps working exactly as before against this same position
shape — its own rebuild (rollable quarter/half/juz' sections) is Phase 2.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/position.js
js/dhorPage.js
worker/src/sabaqLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New file:**
```
worker/migrations/0015_sabaq_from_to.sql
```



Bismillah. Second of the 3-part detail-screen delivery (V3.12.0 was
position tracking + Sabaq; this is Sabaq Dhor, which depends on that
landing first; the Dhor card's planner/timer-popup work is still ahead).

**Sabaq Dhor is now genuinely position-driven.** Confirmed definition:
it's revision of the CURRENT juz' (whichever one Sabaq is presently
learning) from that juz's start up to wherever Sabaq has actually
reached, excluding today's brand-new portion — replacing the earlier
"beginning of Quran / halfway point" rule entirely. Shown as a checklist:
the quarter Sabaq is currently partway through is one section, and each
quarter before it that's already fully covered is its own section too —
at most 3 of those, since a juz' only has 4 quarters and the 4th-
equivalent one is always the one currently in progress. Every section
comes prepopulated checked (these are derived from what's actually been
memorised); the student unchecks anything they didn't actually revise
today. Whichever stay checked get composited into one overall from/to
ayah range at save time.

**The juz' 30 direction problem, solved and tested.** Juz' 30 is studied
backwards (114→78) — its quarters, structurally numbered in the normal
ascending direction, don't line up with the order Sabaq actually walks
through them. New in `shared/data.js`: `studyQuarterIndex()` (its own
inverse — reverses for juz' 30, leaves everything else unchanged),
`structuralQuarterOf()`, and `structuralQuarterBounds()`, all built
specifically to get this right rather than assume every juz' behaves
like the other 29. Verified with real numbers before shipping: a
frontier at 90:5 with `activeJuz: 30` correctly produces a *complete*
section for 98:1-114:6 (study quarter 1) and a *current, partial*
section for 89:1-90:5 (study quarter 2) — matching the actual reversed
study order, not the structural one.

Migration 0014 adds `sabaq_dhor_log.from_surah/from_ayah/to_surah/
to_ayah`; the old free-text `zone` column stays in the table (unused
going forward) rather than being dropped.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqDhorPage.js
js/dhorPage.js
js/position.js
worker/src/sabaqDhorLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New file:**
```
worker/migrations/0014_sabaq_dhor_ayah_range.sql
```



Bismillah. First of a 3-part delivery for the detail-screen redesign
(Sabaq Dhor's checkable-quarters and the Dhor card's planner/timer-popup
work are separate, later deliveries — each depends on this one landing
first).

**Position tracking, wired in for the first time.** The `position` table
and its Worker endpoints already existed (built earlier, never called
from anywhere) — this delivery is what actually uses them. Shape:
`{ activeJuz, sabaqFrontier: {surah, ayah} | null }`. New in
`shared/data.js`: `SABAQ_STUDY_ORDER` (30 first backwards through its
surahs 114→78, then 29 forwards, then 1-28 ascending — the "1 or 28"
branch noted elsewhere picks 1 as the simpler deterministic default,
flagged rather than guessed at silently) and the position-math helpers
built on it. New `js/position.js` orchestrates it client-side, per the
Worker's own "computed client-side" design note.

**Sabaq card**, rebuilt around that position: prepopulates surah/
ayah_from from wherever Sabaq last reached (a brand-new student starts at
114:1); ayah references shown as surah:ayah numerals, never surah names;
`line_count`/`page_count` auto-compute once `ayah_to` is entered
(`getLines13ForAyahRange`/`getLines15ForAyahRange`, built in V3.9.1/
V3.9.4, sitting unused until now) and are shown editable, since the
underlying figures are estimates worth letting a student correct; on
save, position advances, and if that completes the current juz', it's
folded into Hifz Setup's `baseline_selection` automatically — confirmed
in chat, no manual Juz' grid check-off needed. Migration 0013 adds
`line_count`/`page_count` to `sabaq_log` (no inline trailing comments —
the exact bug that broke two earlier migrations).

Every position-math function was tested end to end before this shipped —
new student → 114:1; sabaqing to 114:6 → next default 113:1; finishing
all of juz' 30 → `completedJuz: 30`, next default 67:1 (start of juz' 29)
— not just reasoned through, actually run.

**All 4 detail cards** (Sabaq/Sabaq Dhor/Dhor/Tadabbur):
- Header row now holds an icon (display-only), the title, the date field
  (moved here from its own row), and an icon+label Save button — the old
  bottom-of-card Save button is gone.
- Cards capped at `max-width: 30%` on desktop (design target: a 13"
  monitor as the practical maximum, not an ultra-wide external display);
  with all 4 visible the grid already computes ~25% each on its own.
- Tajweed picker is now a compact trigger button opening a popup with a
  checkbox per tag (was an inline row of toggle buttons) — multi-select
  doesn't fit a scroll-wheel or a plain dropdown.
- The comment block's "Your comment on this session" is now "Notes",
  and its privacy checkbox is now a genuine Private/Public switch
  (default Public) — the "keep hidden from teachers" text is gone.
  Tadabbur's own privacy control gets the same switch treatment.
- Swipe dots now show text labels (Sabaq/SDhor/Dhor/Tadabbur) and sit
  above the rail, not below it as plain circles.

The switch component itself moved out of `settingsScreen.js` into a new
`js/uiSwitch.js` (loads early) so `commentPrivacy.js`/`reflectionCard.js`
could use the same one rather than duplicating it.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/commentPrivacy.js
js/tajweed.js
js/reflectionCard.js
js/logDetailScreen.js
js/dhorPage.js
js/settingsScreen.js
worker/src/sabaqLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files:**
```
js/position.js
js/uiSwitch.js
worker/migrations/0013_sabaq_line_page_count.sql
```



Bismillah. Everything from the last few rounds of feedback on V3.10.0,
plus one new feature (Tomorrow's Portion) that needed real backend work.

**Text and layout:**
- Gender moved onto the Name row itself as a small inline switch (was
  its own full-width row further down the page).
- Mushaf's 13-line and 15-line options now have explanatory hints too
  (Hybrid already had one): "13-line IndoPak/Waterval." and "15 Line
  Uthmani script."
- "Mark completed sections" → "Mark completed sections using".
- "Default targets" → "Target for Dhor", styled as a proper header
  (darker, heavier) rather than a plain field label.
- "Dhor Schedule" → "Dhor Plan", everywhere (heading text; the
  underlying section id/element ids are unchanged, this is a display
  rename only).
- `inputmode="numeric"` added to every numeric field (the 3 Dhor
  targets, portion quantity, haidh cycle length and duration) — a
  plain number pad on mobile instead of the full keyboard.

**Correction:** the Juz'/Surah switch now always springs back to
neutral once its popup closes, regardless of what was picked inside.
V3.10.0 had it slide to reflect `baselineMode` instead and stay there —
that's what's fixed here. Tapping either side still always opens its
grid no matter where the thumb currently sits.

**New: Tomorrow's Portion.** A row added after Days of week — date is
always tomorrow, the portion is the student's own choice from a
dropdown built out of their memorised (baseline) juz', broken into
individual units at whichever granularity is currently selected above
(e.g. quarters: `Q-Juz-1-1` through the last unit of the last memorised
juz'). Picking one and saving passes it straight through to
`dhorSchedule.js`'s generator as an explicit starting point for that one
generation call only — every other call (routine top-ups from the Dhor
log page, or a later Setup save with nothing picked) is untouched and
keeps the existing auto-detect-from-history behaviour, so this can
never silently reset a rotation that's already progressing.

Naming, confirmed and tested against the actual segment math before
shipping:
- 13-line/Hybrid: `Juz-N` whole, `H-Juz-N-1`/`H-Juz-N-2` halves,
  `Q-Juz-N-1`..`Q-Juz-N-4` quarters.
- 15-line: `Juz-N` whole; `Hizb-N` for halves, numbered *globally*
  across the whole Quran (1-60) rather than per-juz' — a global hizb
  number is already unambiguous on its own, unlike a 13-line "half"
  which has no name of its own to fall back on; `Rub-N-P` for quarters,
  per-juz' (this is the print's true quarter-of-a-juz' unit — the
  project's existing `RUB_BOUNDARIES.uthmani` array is actually
  Maqra-level granularity, 8/juz', not Rub'; `QUARTER_BOUNDARIES_UTHMANI`
  from V3.9.1, 4/juz', is the one that's genuinely Rub'-level, and is
  what this actually reads from).

The dropdown's list and the generator's own chunk sequence are built
from the same underlying math (`segmentRangeForUnitIndex` /
`buildChunks`'s single-unit case) so a picked label always corresponds
to exactly what the rotation would produce on its own.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/settingsScreen.js
worker/src/dhorSchedule.js
js/api.js
CHANGELOG.md
TESTING.md
```



Bismillah. Two things in one delivery, confirmed to go together: Hybrid
becomes a real, selectable mushaf option, and every plain either/or
control across Setup and Dhor Schedule becomes a genuine switch instead
of a button pair.

**Hybrid mushaf:** enabled in Setup (was shown-but-disabled since
V3.7.0). One rule, applied everywhere a `ref` gets derived from a
student's mushaf: page/line math always follows 15-line data for a
Hybrid account, quarter/half/juz' math always follows 13-line rules —
same as a plain 13-line account, never the 15-line print's own
rub'/hizb/juz' system. `worker/src/dhorSchedule.js` already fell through
to `waterval` for anything that wasn't `15line_madani`, so Hybrid needed
no new branch there — just enabling the value in `profile.js`'s
validation and the Setup UI.

**Dhor log page's reference dropdown is gone.** It used to be a separate
per-device `localStorage` setting, independent of the student's actual
mushaf choice — that inconsistency is why Hybrid couldn't have worked
cleanly before. Now `ref` is derived from `profile.mushaf` fresh on every
open, the same rule as above, for every student — not just Hybrid ones.

**Switch redesign**, all in Setup + Dhor Schedule:
- Gender, mushaf (3-way, with an explanatory line under it for Hybrid),
  Dhor Schedule's portion-granularity (3-way) and frequency (2-way) are
  now genuine switches — one rounded track, a sliding highlighted thumb
  — replacing the button-pair look those fields used before.
- "Mark completed sections" (Juz'/Surah) is a switch too, but with a
  neutral center: tapping either side always opens its slide-in grid
  regardless of where the thumb currently sits; the thumb only reflects
  which mode is actually set, resting muted in the middle if nothing's
  been marked yet. A plain 2-way switch doesn't fit here, since tapping
  opens a tool rather than flipping a persistent state.
- Default targets and Haidh's 3 fields are now one row each, label on
  the left, input on the right, instead of stacked. "Frequency (days)"
  is renamed "Revision cycle time (days)".
- Dhor Schedule's portion-per-session row now has the quantity number
  first (left), the granularity switch after it (right) — reversed
  from the original order.
- Days-of-week is now forced onto one line at every width (was allowed
  to wrap) — more compact per-button padding, no change to the 7-day
  multi-select behavior itself.
- Surah grid (the slide-in from "Mark completed sections") is now 3
  columns instead of 2, as a trial — easy to revert if it doesn't read
  well in practice.

The generic switch component (`renderSwitch()`/`wireSwitch()` in
`settingsScreen.js`, `.switch-track`/`.switch-option`/`.switch-thumb` in
`settings.css`) handles 2-way, 3-way, and the neutral-center variant with
the same code — none of it needed a special case per switch, just
however many slots a given track has.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/settingsScreen.js
js/dhorPage.js
worker/src/profile.js
worker/src/dhorSchedule.js
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```



Bismillah. Closes the other half of the sabaq line-count gap —
`getLines13ForAyahRange` had no 15-line counterpart until now.

`AYAH_LINE_UTHMANI` in `shared/data.js`: `[surah, ayah, page, startLine,
endLine]` for all 6236 ayahs, sourced from the Quran.com API's own
word-level `line_number` field (via the user's `Generate_Quran_Mapping.py`,
run locally since this sandbox can't reach that host). Verified before
use: page assignment matches `quranmeta.json`'s independently-sourced
page field at all 6236 ayahs — 0 mismatches. Genuinely per-page line
data too, not another disguised running index: line numbers reset per
page and cap at 15 (matching the print's name), and behave the way real
typesetting does — e.g. Al-Fatiha's ayahs 3 and 4 share one line, ayah 7
spans three.

`getLines15ForAyahRange(surah, ayahFrom, ayahTo)` reads this directly —
no word-ID lookup step needed the way the 13-line version requires,
since this data is already at the same per-ayah granularity `sabaq_log`
itself stores (surah/ayah_from/ayah_to). Handles same-page and
multi-page spans, using each page's *actual* line count
(`PAGE_MAX_LINE_UTHMANI`, derived from the data itself — page 1 only
uses 8 of its 15 lines, so a hardcoded 15-per-page assumption would have
been wrong there).

Unlike the 13-line figure, this one isn't flagged as an approximation —
the underlying per-ayah positions are the real thing.

Not done in this delivery, by design: wiring either line-count function
into any UI (sabaq entries don't display one yet — same "built, not yet
wired up" state `getLines13ForAyahRange` has been in all along).

**Files changed:**
```
shared/data.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
```



Bismillah. `PRAGMA table_info(students)` on production showed exactly 4
of migration 0011's 7 new columns present — all 4 from the Dhor Schedule
section (`dhor_granularity`, `dhor_quantity`, `dhor_frequency`,
`dhor_days_of_week`), none from the Haidh section
(`haidh_cycle_length`, `haidh_period_length`, `haidh_next_expected`).

Honest note: this doesn't fully match the "inline trailing comment"
theory from V3.9.2 — two of the four columns that *did* apply
(`dhor_quantity`, `dhor_days_of_week`) had that exact issue too, so
something else caused execution to stop specifically before the Haidh
section, not addressed by that fix alone. Not chasing the exact
mechanism further right now — the priority is getting production
working again.

New migration 0012 adds only the 3 still-missing columns, kept
deliberately bare (no comments, plain ASCII only, nothing beyond the
3 statements) to remove any further risk. Do not re-run 0011 — the
4 columns it already added would now fail as duplicates.

**Files changed:**
```
CHANGELOG.md
```
**New file:**
```
worker/migrations/0012_haidh_settings_retry.sql
```



Bismillah. Migration 0011 had inline trailing comments after a semicolon
on 3 lines (`dhor_quantity`, `dhor_days_of_week`, `haidh_next_expected`) —
the exact pattern that broke migration 0010's runner before (see that
entry). Same mistake, repeated, despite it already being a documented
gotcha — should have caught this before shipping V3.9.1.

If that migration didn't fully apply as a result, `profile.js`'s GET/POST
handlers would be selecting/updating columns that don't exist yet on the
live `students` table, which fails at the database level — a very likely
explanation for a 500 right after login, since `/profile` is the first
thing called post-login to route to Setup or Journal.

Every comment in the migration is now on its own line; none share a line
with a SQL statement. Re-run this corrected file against production D1,
then retest login.

**Files changed:**
```
worker/migrations/0011_dhor_schedule_and_haidh_settings.sql
CHANGELOG.md
```



Bismillah. Closes the surah-baseline gap flagged in V3.9.0, one layer at a
time — this delivery is the verified reference data itself; wiring it into
Dhor Schedule generation (to let a surah-based Hifz Setup baseline drive it,
not just a juz'-based one) is a natural next step, not done here.

**Resolved this session, all in `shared/data.js`:**
- `JUZ_BOUNDARIES` — confirmed to be the 13-line print's own boundaries
  specifically, not a print-independent average as the code previously
  (incorrectly) commented.
- `JUZ_BOUNDARIES_UTHMANI` (new) — the 15-line Madani print's own 30 juz'
  boundaries, derived from `RUB_BOUNDARIES.uthmani`'s every-8th marker.
  Verified against all 30 — differs from the 13-line boundaries at exactly
  one point, juz' 4 (13-line: 3:92, 15-line: 3:93).
- `getJuzForPosition`/`juzStartSurah`/`getJuzSurahSpan` are now ref-aware
  (optional `ref` param, defaulting to 13-line for existing callers).
- `HALF_BOUNDARIES.waterval`/`.uthmani` and `QUARTER_BOUNDARIES_UTHMANI`
  (new) — half- and quarter-juz' boundaries for both prints (13-line
  quarters are `RUB_BOUNDARIES.waterval` itself, already fine-grained
  enough; no separate array needed there). The 15-line print's own eighth-
  of-juz' breakdown is `RUB_BOUNDARIES.uthmani` as-is.
- `SURAH_JUZ_RANGE`/`getSurahJuzRange()` (new) — which juz' each surah
  touches. Verified identical for both prints across all 114 surahs (the
  one ayah-level difference doesn't change which surahs touch which juz'),
  so one shared table covers both.
- Corrected a stale code comment that had claimed `RUB_BOUNDARIES.waterval`
  diverges from `JUZ_BOUNDARIES` at 6 points "due to a real print
  variation" — re-verified properly (the original check didn't handle
  surah rollover) and it's 5 points (juz' 7,14,20,21,23), and since both
  are confirmed 13-line, it looks like residual imprecision in that source
  rather than a genuine print difference. Flagged in the comment, not
  silently corrected — there's no more-authoritative source to fix it
  against.

**Caught in my own review before this shipped**: my first pass at writing
the derived arrays into the file had transcription errors (wrong lengths on
3 of them). Re-derived everything programmatically from the source data and
cross-checked lengths and internal consistency (e.g. every 2nd quarter-
boundary entry must equal the corresponding half-boundary entry) before
finalizing — worth knowing this class of mistake is possible, and worth the
same check on any future hand-edit of these tables.

**Files changed:**
```
shared/data.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
```



Bismillah. The Setup screen is no longer 2 swipeable cards — it's one
continuous page with 4 independently-saved sections: Profile, Hifz Setup
(both carried over, reshaped), and two entirely new ones, Dhor Schedule and
Haidh. Neither gets its own nav item: both live permanently inside Setup,
reachable via "Settings" at any time, not just during onboarding. The old
"Plans" nav placeholder is gone entirely as a result.

**Profile / Hifz Setup, reshaped:**
- Gender is now two exclusive toggle buttons (matching the mushaf/
  granularity pickers' look) instead of a `<select>` — same M/F values
  underneath, no backend change.
- "Mark completed sections" (the old Surahs/Juz' baseline picker) is now
  two buttons — Juz' and Surah — that each open a full slide-in grid
  overlay (30 cells / 114 cells, scrollable) instead of one inline area
  that swapped content on a mode toggle. Still mutually exclusive:
  confirming a selection in one clears the other. The overlay's close icon
  commits the selection into the section's pending state, same as any
  other field here — it does not save to the server by itself; the Hifz
  Setup section's own Save button still does that, so this doesn't behave
  differently from every other field on the page.
- Default targets (mistakes/minutes/frequency per juz') are unchanged.

**Dhor Schedule (new):** a settings form, no visible table — students pick
a portion size (Juz'/Half/Quarter, plus how many per session), a frequency
(Daily/Twice a day), and which days of the week. Saving drives a rolling
7-day plan generated behind the scenes (`worker/src/dhorSchedule.js`,
called on-demand — Setup save, and whenever the Dhor log page opens — never
a background job). Plan rows land in the existing `plans` table
(`plan_type='dhor'`), which already had full CRUD and completion-linking
built (V2/V3 schema) — nothing new needed there.

Generation walks the student's memorised juz' pool (from Hifz Setup's
`baseline_mode`/`baseline_selection`) in plain ascending order, never
letting one session's segment span across a gap between non-adjacent
memorised juz' (the normal early-stage pattern — e.g. juz' 30, 29, 1
memorised but not 2-28 yet). It anchors to whichever is further along in
that sequence — the last actually-logged `dhor_log` entry, or the last
existing plan row — so logged reality overrides a stale unfulfilled plan,
while an already-generated future plan never gets silently reassigned a
different portion on a later call.

Haidh interaction (confirmed in chat): no dhor is generated on a haidh or
predicted-haidh day — that date is skipped and the window extends outward
to make up the session, rather than losing it. Days not in the chosen
weekday set are just normal off days, not made up.

**Scope note, flagged rather than silently approximated**: generation
currently requires `baseline_mode = 'juz'` (a surah-based baseline isn't
mapped to juz' coverage yet — that needs real ayah-boundary math, a
separate piece of work) and uses plain ascending juz' order, not the
branching "30, then 29, then 1-or-28, then the rest" study order noted
elsewhere for initial memorisation — that branching depends on a
per-student choice this project doesn't store anywhere yet. Both cases
return a clear reason rather than generating something wrong.

**Haidh (new):** also a settings form, no visible calendar — cycle length,
duration, and next expected haidh day. Shown only when gender is F, live
off the gender picker (not just on reload). This reuses the existing
`/attendance/predict` endpoint (`worker/src/attendance.js`, unchanged,
live since migration 0001) entirely as-is — the `attendance` table already
has `predicted-haidh` as a status, and predictions already never overwrite
real data. The only genuinely new work is the Setup UI itself, plus one
small reconciliation: Setup asks for "next expected day" (the more
intuitive input), and the frontend computes that endpoint's own `lastStart`
param from it (`lastStart = next_expected − cycle_length`) — so the backend
needed no changes for this at all.

**Dhor log page and journal quick-add now use plans, not just link them:**
- `dhorPage.js` fetches today's Dhor plan(s) on open. Zero: unchanged manual
  picker. One: every field pre-fills from it, and saving links back to it
  (existing `plan_id` handling in `logHelpers.js`, unchanged). More than
  one: a plain selector, never auto-picked.
- The journal's quick-add cells previously showed a "planned" indicator and
  passed `plan_id` through on save, but never pre-filled the form's actual
  values — tapping one still opened a blank form. Now fixed for `sabaq` and
  `dhor` (whose plan fields map directly onto their quick-add fields).
  `sabaq_dhor` is not pre-filled: its plan rows store `surah`/`ayah_from`/
  `ayah_to` (matching `sabaq`), but the log itself needs a computed `zone`
  string that isn't wired into the frontend yet (same gap already flagged
  in `sabaqDhorPage.js`) — left manual rather than guessed at.

**Also (small, root-cause fix):** the Dhor segment/granularity math
(`segmentsPerJuz`/`unitMarkerCount`) used to be a `dhorPage.js`-local copy.
Moved to `shared/data.js` (already dual-loaded by frontend and Worker) since
`dhorSchedule.js` needs the exact same math server-side — two copies is
exactly what `CONVENTIONS.md` principle 2 exists to prevent.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/api.js
js/app.js
js/auth.js
js/dhorPage.js
js/icons.js
js/journal.js
js/settingsScreen.js
shared/data.js
worker/src/index.js
worker/src/profile.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files:**
```
worker/migrations/0011_dhor_schedule_and_haidh_settings.sql
worker/src/dhorSchedule.js
```

**Retest before merging to `main`**: `TESTING.md` §23, especially the
juz'-gap generation case (a pool like {1, 29, 30}) and the haidh-shifts-the-
window case — both are the kind of thing that looks fine with a small,
contiguous test pool and only shows a problem with a real, gappy one.



Bismillah. Corrects the remaining iPhone-specific gap in V3.8.1: a newly
installed Home Screen app now opens the student's personal `/<uniqueID>` URL
on its very first launch, so the PIN-only screen appears without requiring a
one-time ID entry inside the standalone app.

**Why V3.8.1 was incomplete on iPhone**: iOS Home Screen web apps have cookies
and storage separate from Safari. The ID saved while using the personal page
in Safari therefore was not available inside a newly-created standalone app.
Worse, the shared manifest's `start_url: "/"` explicitly discarded the
personal path during installation, leaving the new app with no possible way
to know which student it belonged to. The fallback screen in the reported
screenshot was therefore the expected result of those two platform rules.

**Apple-mobile installation path**: new `js/pwaManifest.js` detects iPhone,
iPad, iPod, and iPadOS desktop-mode user agents. On those devices it omits the
shared Web App Manifest link, allowing Add to Home Screen to save the exact
current page URL. The existing Apple standalone meta tags and touch icon stay
in place, so the installed experience remains full-screen and branded. Every
other platform still receives `manifest.json`, preserving the normal Chrome/
Android PWA installation route.

**Defence in depth retained**: V3.8.1's remembered-ID behavior remains. It is
still useful after a fallback login, for existing installations, and on
platforms whose installed app shares origin storage. PINs are never stored and
the authentication token remains session-only.

**Required once for existing iPhone installations**: the old Home Screen icon
has already saved `/` as its launch target. Page code cannot rewrite that
installed shortcut. Delete that icon, open the personal `/<uniqueID>` URL in
Safari, and use **Add to Home Screen** again after V3.8.2 is deployed. Future
launches from the replacement icon start on the PIN-only personal screen.

No Worker, D1 schema, or migration changes are needed.

**Files changed:**
```
index.html
sw.js
CHANGELOG.md
TESTING.md
```
**New file:**
```
js/pwaManifest.js
```

**Retest before merging to `main`**: `TESTING.md` §22 on a real iPhone,
including deleting the old icon and reinstalling from a valid personal URL.

## V3.8.1 — home-screen PIN-only return login (2026-07-28)

Bismillah. Installed home-screen launches now remember which journal belongs
to that device, so a returning student enters only their PIN rather than the
unique ID and PIN every time.

**Root cause corrected**: the manifest always launched the installed PWA at
`/index.html`, while the personalized login could only obtain an ID from a
`/<uniqueID>` path. That made every home-screen launch fall through to the
generic ID+PIN screen even after a successful login.

**Remembered device identity**: a successful login now saves only the unique
ID in `localStorage` (`hh_login_id`). The PIN is never stored, and the auth
token remains in `sessionStorage`, so closing the app still requires a fresh
PIN. Opening a personal `/<uniqueID>` link takes priority over the remembered
ID and does not replace it unless that new account successfully logs in.
An already-open authenticated V3.8.0 session is upgraded too: its verified
profile ID is remembered as soon as the new frontend loads.

**Routing and account safety**: `/` and `/index.html` are both treated as
neutral launch paths, covering new installs and already-installed icons that
may retain the old URL. After a remembered-ID lookup succeeds the address is
canonicalized back to the personal URL. `bootApp()` uses the same effective-ID
rule, preserving the V3.4.2 cross-account guard without treating `index.html`
as if it were a student ID. The PIN/create-PIN screens now include **Use
another ID**, which forgets the device association and returns to the generic
sign-in screen; ordinary Log out intentionally keeps the remembered ID.

**Manifest**: `start_url` is now `/`, with an explicit `/` scope. No Worker,
D1 schema, or migration changes are needed.

**Files changed:**
```
manifest.json
index.html
js/api.js
js/auth.js
js/app.js
sw.js
CHANGELOG.md
TESTING.md
```

**Retest before merging to `main`**: `TESTING.md` §21, especially both `/`
and `/index.html` launches on an already-installed mobile home-screen app.

## V3.8.0 — top-paint fix generalized + Hifz Setup (2026-07-27)

Bismillah. Two pieces: a permanent fix for the "invisible until scroll"
bug (queued as a finding, now actioned), and the full Hifz Setup card
(history baseline + default targets), turning the Setup screen into 2
cards.

**Top-paint fix, generalized**: `fixJournalTopPaint()` — hardcoded to only
ever correct `#screen-journal` — is now `fixScreenTopPaint(screenId)`,
called unconditionally at the end of `showScreen()` for whichever screen
is actually showing (including the "not built yet" placeholder). This is
why Setup had the identical symptom: the original fix simply never ran
for any screen besides journal. No future new screen can reintroduce this
gap now, since nothing needs to remember to wire it in again.

**Setup restructured into 2 cards**, matching the unified day-log view's
grid/rail pattern (V3.6.1) — row/grid on larger screens, swipeable rail
on mobile, dot indicators, Sky (`#D0DBE7`) background on both:
- **Profile** — the existing view-only header + journal name + gender,
  unchanged in content, just its own card now, with its own save icon.
- **Hifz Setup** — mushaf (existing picker, moved here from Profile) →
  history (pick Surahs or Juz' — exclusive choice, switching discards the
  other's selection; the matching grid slides in; multiple items ARE
  selectable within whichever mode is active) → default targets
  (mistakes/juz', minutes/juz', frequency in days — pre-filled with 2/40/30).
  Its own independent save icon, separate from Profile's.

**Backend**: migration 0010 adds `baseline_mode`, `baseline_selection`
(JSON array, stored as text), `target_mistakes_per_juz`,
`target_minutes_per_juz`, `target_frequency_days` to `students`.
`profile.js` extended accordingly, with validation on each new field.
Deliberately NOT integrated with `position_json`'s `activeJuz`/`studyOrder`
yet — the baseline is a one-time self-reported fact, not derived progress
state, and that deeper integration is real follow-up work for whenever the
rings feature (which also reads `position`) actually gets built.

**Deliberately unchanged**: saving either card sets `setup_complete`, so
completing just one card is enough to stop being routed back to Setup —
neither card is required to unlock the other.

**Files changed:**
```
index.html
js/app.js
js/icons.js
css/settings.css
worker/src/profile.js
SCHEMA.md
sw.js
```
**New files:**
```
js/settingsScreen.js (full rewrite, not additive)
worker/migrations/0010_history_baseline_targets.sql
```

**Retest before merging to `main`**: `TESTING.md` §20. Migration 0010
needs to actually be applied to D1 before the Hifz Setup card's new
fields will save.

---

## V3.7.1 — Setup screen: sizing fix + save icon (2026-07-27)

Bismillah. Both findings documented against V3.7.0, now actioned.

**Desktop container width**: `--width-desktop` (tokens.css) bumped 25% →
30%. Separately, `#screen-settings` never actually had the width-cap rule
that `.login-card`/`#screen-admin` already carry — it's a single-container
form, same category as those two, and should have had this from the start.
Added the same `max-width: var(--width-tablet)` (768–1179px) /
`max-width: var(--width-desktop)` (≥1180px) rule, mirroring their exact
pattern. Both pieces were needed together — the token bump alone wouldn't
have fixed the reported stretching, since the screen was never wired into
the system in the first place.

**Save icon**: the Setup screen's bottom-of-form text "Save" button moved
to an icon-only button on the right of the header row, next to the "Setup"
title — icon-over-button preference (already on file, reiterated for this
screen specifically). New `save` icon added to `icons.js`, converted from
the uploaded `save.svg` to match this file's existing format; stroke-width
normalized to `1.8` to match most of the current set (the source file used
`1`), same normalization already applied to `home.svg` in the same round
of uploads.

**Explicitly out of scope for this delivery**: the broader icons-folder
migration (item 5 from the nav/icon restructuring discussion) — still a
separate, not-yet-fully-scoped delivery (`close.svg`'s intended use is
still unconfirmed, among other things). This delivery only actions the
two specific V3.7.0 findings.

**Files changed:**
```
index.html
css/tokens.css
css/settings.css
js/icons.js
js/settingsScreen.js
sw.js
```

**Retest before merging to `main`**: `TESTING.md` §19.

---

## V3.7.0 — Setup screen: profile section (2026-07-27)

Bismillah. First piece of the bigger 4-area onboarding design discussed in
chat (profile, history+targets, Dhor planning, haidh tracking) — deliberately
scoped to JUST the profile section this delivery, kept separate from the
other 3 so a broad change doesn't land in the same delivery as a big new
feature (the exact mistake behind the V3.6/V3.6.2 incident).

**New Setup screen** (`screen-settings`), reached two ways: the existing
"Settings" nav item (was a placeholder until now), and automatically on a
new user's first login, before `setup_complete` is set — `bootApp()` in
`app.js` now checks `profile.setup_complete` instead of always going
straight to the journal.

**View-only header**: name, Unique ID, URL (with the existing copy-button
pattern reused from the create-PIN/registered screens).

**Editable**: journal name (a custom title for the journal, not the
student's real name — new `journal_name` column), gender (already existed
as a field, just never had setup-screen UI), and mushaf choice — all 3
options shown (13 line / 15 line Madani / Hybrid), Hybrid rendered
disabled/unselectable since it isn't built yet (new `mushaf` column,
constrained to the 2 real values; the server rejects `hybrid` as a value
for the same reason the UI doesn't offer it).

**Backend**: migration 0009 adds `journal_name` and `mushaf` to `students`.
`profile.js`'s existing GET/POST (already handled name/gender/track_haidh/
setup_complete from the V1.4-era work) extended to include both.

**Deliberately NOT in this delivery**: history capture, default targets,
Dhor planning, haidh tracking, and the icons-folder/nav-label
restructuring — all separate, later work.

**Files changed:**
```
index.html
js/app.js
worker/src/profile.js
SCHEMA.md
CONVENTIONS.md
sw.js
```
**New files:**
```
worker/migrations/0009_setup_profile_fields.sql
css/settings.css
js/settingsScreen.js
```

**Retest before merging to `main`**: `TESTING.md` §18. Needs the migration
applied to D1 before the new fields will actually save — this is a real
schema change, not just frontend.

---

## V3.6.2 — cache policy reversed: nothing cached, anywhere (2026-07-26)

Bismillah. V3.6 paired the `?v=` versioning with `_headers` set to
`immutable, max-age=31536000` for `css/js/shared` — the standard pattern
production build tools use, safe specifically because their deploys are
atomic (a new version string can't appear before every file behind it has
landed). This project's deploys are manual, file-by-file uploads with no
such guarantee, and that gap was hit directly: a browser loaded
`app.js?v=3.6.1` mid-deploy, before the full V3.6.1 file set had actually
landed, got the old code back, and cached it *immutably* — meaning no
later deploy under that same version string could ever fix it for that
browser. `reflectionCard.js`'s 404 during the same window got cached the
same way.

**Reversed, not tuned:** rather than picking a shorter-but-still-nonzero
cache duration, `_headers` now sets `Cache-Control: no-store` for
everything, project-wide — no caching at all, anywhere, by any browser or
intermediate cache. For a project at this stage (active development,
changing minute to minute, no atomic deploy step, and no real user traffic
yet where cache-hit-rate would matter), there's essentially nothing to
gain from caching and a full year of blast radius to lose if this gap
gets hit again. `CONVENTIONS.md` #10 updated with the full reasoning for
future reference, including when it might be worth reintroducing (atomic
deploys, or real production traffic).

**What stays:** the `?v=` query-string versioning on every CSS/JS
reference — it isn't what caused this, and it's still what breaks a cache
that forms somewhere outside this project's control (a stray proxy, a CDN
that ignores `_headers`), plus what any future reintroduced caching would
key off.

**Version bump**: `?v=3.6.1` → `?v=3.6.2` across every reference in
`index.html`, and `sw.js`'s `ASSETS`/`CACHE_NAME` to match — this is what
actually clears the currently-stuck bad cache, since `no-store` alone
doesn't undo a cache entry that already exists under the old URL.

**Files changed:**
```
_headers
index.html
sw.js
CONVENTIONS.md
```

**Retest before merging to `main`**: `TESTING.md` §17.

---

## V3.6.1 — unified day-log view (2026-07-26)

Bismillah. Replaces the 3 separate Sabaq / Sabaq Dhor / Dhor screens with
one screen holding all 4 cards (Sabaq, Sabaq Dhor, Dhor, and a new
Tadabbur/reflection card) — all 3 journal column headers now open this
same screen, starting on whichever card matches the header clicked.

**Layout**: large/desktop screens show all 4 cards as a static 1×4 grid,
no scrolling. Tablet shows a swipeable rail, 2 cards in view. Mobile shows
a swipeable rail, 1 card in view. Dot indicators track position on the
rail (hidden on the desktop grid, where there's nothing to indicate a
position within). Each card is independently vertically scrollable, so
its fields + Recent history fit without growing the card unboundedly.

**Recent history**: each of the 3 log cards' existing "Recent" swipe rail
(past entries of that type) moved to the bottom of its own card — same
feature as before, just relocated.

**Independent per-card date selectors**: Sabaq, Sabaq Dhor, and Dhor each
get their own `<input type="date">`, defaulting to today every time the
screen opens. Changing one card's date only changes which date THAT
card's next save uses — the other 3 cards stay on whatever date they're
each individually set to. This is genuinely new: every save previously
hardcoded `date: todayISO()`, so there was no way to log a missed day at
all before this. Note this only affects what date a NEW entry saves
under — it does not load an existing entry for editing (multiple entries
per day are deliberately allowed app-wide, see SCHEMA.md, so there's no
single "the" entry for a date to load).

**Tadabbur card, new**: the `reflections` table and `apiReflections` API
client already existed with no frontend — this is the first UI for it.
Deliberately different from the other 3 cards: reflections are meant to be
ONE per day, so this card loads today's existing reflection (if any) on
open and updates it in place on save, rather than always creating a new
row. No date selector, no Recent rail on this card, per spec.

**Two latent bugs fixed, exposed by mounting cards simultaneously**: both
`tajweed.js`'s "+ add" button and `commentPrivacy.js`'s comment
textarea/checkbox used fixed, non-unique ids (`tajweedAddBtn`,
`cb_comment`, `cb_private`). This was invisible while only one detail page
was ever mounted at a time, but the unified view mounts all 3 log cards'
pickers/comment blocks at once — `document.getElementById` always
resolves to the FIRST matching id in the document, so the 2nd/3rd card's
"+ add"/comment controls would have silently wired themselves to the 1st
card's elements instead. Both now scope their lookups to their own
container via `querySelector`, documented as new `CONVENTIONS.md`
principle #11.

**Files changed:**
```
index.html
js/app.js
js/tajweed.js
js/commentPrivacy.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/dhorPage.js
css/detail-pages.css
sw.js
CONVENTIONS.md
```
**New files:**
```
js/reflectionCard.js
js/logDetailScreen.js
```

**Version bump**: every CSS/JS reference in `index.html` moved from
`?v=3.6.0` to `?v=3.6.1` (per the `CONVENTIONS.md` #10 discipline from
V3.6) since multiple files changed; `sw.js`'s `ASSETS` list and
`CACHE_NAME` updated to match — still not registered, no behavior change
there.

**Retest before merging to `main`**: `TESTING.md` §16. The per-card date
selectors and the container-scoping fixes both specifically need testing
with all 3 log cards open together (not one at a time), since that's
exactly the condition that was previously untested.

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
