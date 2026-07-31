# Hifzhelper — Engineering Conventions

These are the working principles for this project. They exist because most of
them were learned the hard way earlier in the build — each one below notes
the mistake it's guarding against, so future edits don't quietly reintroduce it.

## 1. Root-cause correction, not overrides

If a model or assumption turns out to be wrong, fix the model — don't patch
around it with a special case.

*Why this is here:* the student-progress model was originally a single
"frontier juz'" number (juz' 1 → 30 in order). Real methodology turned out to
be non-linear (30 → 29 → branch → ...), and the first fix was a patch
("what if we just skip ahead"). The correct fix was replacing the whole model
with per-juz' state. Patch-first cost more total effort than root-cause-first
would have.

**In practice:** if you find yourself adding an `if` to handle one case that
doesn't fit the current model, stop and ask whether the model itself is
wrong before writing the `if`.

## 2. Single source of truth for shared data

Data used by more than one file must live in exactly one file, imported by
the others. Never copy-paste a data table into a second location "for now."

*Why this is here:* rub'/juz' boundary data, the surah list, and tajweed
defaults live in `data.js`. Once the Worker needs to validate entries against
the same boundaries, it must `import` this file — not carry its own copy.
Two copies of "the same" data drift silently, and the resulting bug (a
juz'/quarter computed differently on the frontend vs. the backend) would be
very hard to notice until someone's progress looks wrong for no clear reason.

## 3. No silent fallbacks that hide failures

If a request to Sheets (or anything external) fails, surface the failure.
Never quietly substitute an empty/default value that looks like a valid
"nothing here yet" state.

*Why this is here:* a silent fallback turns a real bug (API quota hit, bad
auth token, network blip) into what looks like normal empty state — the kind
of thing that shows up as a confused support message weeks later instead of
an error today.

## 4. Validate at the boundary, not by convention

The Worker validates the shape of incoming data (required fields present,
correct types, values in range) before writing to Sheets. It does not trust
the frontend to always send well-formed data.

*Why this is here:* frontend and backend are separate files, deployed
separately, and will drift out of sync over time as one changes without the
other. Boundary validation is what catches that drift before it corrupts
stored data, rather than after.

## 5. Schema parity, explicit and documented

Field names must match, character-for-character, across the Google Sheet
columns, the Worker's code, and the frontend's code. Any deliberate renaming
between layers is a bug waiting to happen — don't do it. The canonical
names live in `SCHEMA.md` and `data.js`; everything else follows them.

*Why this is here:* `dhor_from` (Sheet) vs. `dFrom` (Worker) vs. `d_from`
(frontend) referring to the same field, under three different names, is
exactly the kind of mismatch that silently breaks a write path.

## 6. Comment *why*, not just *what*, for anything sourced or decided

Any data or decision that came from an external source, a specific user
requirement, or a non-obvious tradeoff gets a comment explaining where it
came from or why it's the way it is — not just what it does.

*Why this is here:* the rub' boundary arrays look like arbitrary numbers if
you don't know they were extracted and verified from specific source files.
Without that context, a future edit might "fix" a value that looks odd but
is actually correct — or worse, not think to double check it at all.

## 7. Environment-specific values live in one config spot, never hardcoded inline

A URL, ID, or setting that differs between dev and production must be easy
to find and change in exactly one place — never copy-pasted as a literal
string into application logic.

*Why this is here:* `frontend/js/api.js`'s `API_BASE` was hardcoded to the
old dev Worker's URL. When the project moved to working directly on
production, that string was simply never touched — the login screen kept
silently talking to a database that had never heard of the accounts being
tested, producing a confusing "Invalid ID or PIN" error that had nothing to
do with the ID or PIN. The fix was one line, but only because it was found
by accident; nothing about the code structure would have surfaced it sooner.

## 8. Don't render UI that depends on async state before that state has arrived

If a screen's content depends on something fetched asynchronously (the
logged-in user's role, a profile, permissions), render it *after* that
fetch resolves — never eagerly, against whatever default value a variable
happened to start with.

*Why this is here:* the auth dropdown was rendered immediately on boot,
before the profile fetch (which sets the real `role`) had completed. It
silently rendered against the default `role: 'student'` every time,
regardless of who was actually logged in — the Admin nav tile never
appeared for anyone, admin included, and nothing about it looked like an
error; it just looked like a missing feature.

## 9. Every component owns its own responsive behavior, at both ends

A component must handle both failure modes of screen width, not just
one: it must not overflow/spill off narrow (mobile) screens, and it must
not stretch to fill a large screen just because space is available — its
max-width should scale to how much content it actually holds. Relying on
the page shell being "mobile-first" is not the same as every individual
component actually respecting the viewport it's rendered in.

*Why this is here:* a "Register" button inside a flex row overflowed off
a phone screen entirely, because the button's own `width: 100%` rule
(meant for standalone use elsewhere) silently became its flex-basis
inside that row. Separately, a data table that looked fine on mobile
stretched edge-to-edge on a wide desktop monitor with huge gaps between
columns, because nothing constrained its container's max-width. Same
underlying discipline, two different symptoms depending on screen size —
worth checking both, not just the one that happens to get noticed first.

## 10. Every CSS/JS reference carries a version query string — bump it on every change

`index.html`'s `<link>`/`<script>` tags (and `sw.js`'s own `ASSETS` list, kept
in sync) point at `css/*.css?v=X.Y.Z` / `js/*.js?v=X.Y.Z`, not bare
filenames. Whenever ANY of those files changes, the version string bumps
across all of them together — not just the one file that changed. There's
no build step generating this automatically; it's manual discipline.

*Why this is here:* `sw.js`'s `CACHE_NAME` was already bumped on every
release, but that only ever evicts the *service worker's own* cache — it
does nothing for the browser's ordinary HTTP cache or a CDN edge cache,
either of which could otherwise keep serving an old `nav.css` under that
same unversioned URL indefinitely. The version bump is what makes a stale
copy visibly wrong (new URL, so a genuinely different request) instead of
silently reused, regardless of what any cache along the way decides to do.

**V3.6 → V3.6.2, reversed:** V3.6 paired this with `_headers` set to
`immutable, max-age=31536000` for `css/js/shared` — the standard pattern
build tools like Webpack/Vite use, which is safe *only* because their
deploys are atomic (a new version string can never appear before every
file behind it has landed). This project's deploys are manual and
file-by-file, so that atomicity doesn't hold — a browser hitting a URL
mid-deploy caught the old `app.js` under the new `?v=`, and because
`immutable` means "never revalidate," no future deploy under that same
version string could ever fix it for that browser. `_headers` now sets
`Cache-Control: no-store` across the board instead — nothing gets cached
by anyone, anywhere, so every load is always current. The version query
strings stay regardless: they're what breaks a cache that forms somewhere
outside this project's control (a stray proxy, a CDN that ignores the
header), and they're what long-lived caching would key off if it's ever
worth reintroducing — once deploys are atomic, or this ships to real
users where cache-hit-rate actually matters for performance. Neither is
true yet, so there's currently nothing to gain from caching and a full
year of blast radius to lose if the same gap recurs.

## 11. Shared components scope their internal lookups to their own container, never a fixed global id

A shared render function (`renderTajweedPicker`, `renderCommentBlock`, etc.)
that's ever mounted more than once in the same document must find its own
buttons/inputs via `containerElement.querySelector(...)`, not
`document.getElementById('someFixedId')` — even for elements it creates
itself inside its own markup.

*Why this is here:* `tajweed.js`'s "+ add" button and `commentPrivacy.js`'s
comment textarea/checkbox both used fixed ids (`tajweedAddBtn`,
`cb_comment`, `cb_private`). This was invisible for two years because only
one detail page was ever mounted at a time — but `document.getElementById`
always resolves to the FIRST matching id in the whole document, and the
unified day-log view (V3.6.1) mounts all 3 log cards' pickers/comment
blocks simultaneously. Without this fix, tapping "+ add" on the Sabaq Dhor
or Dhor card would have silently wired itself to the SABAQ card's button
instead — a bug that would only ever surface by someone testing the 2nd or
3rd card specifically, not by reading either file in isolation.

**In practice:** if a render function takes a `containerId` and creates
child elements with their own logic, look them up via `querySelector`
scoped to that container — never assume there's only one instance of
yourself in the document, even if that's true today.

## 12. A per-screen visual correction belongs in the routing path, not a named call from one screen

`fixJournalTopPaint()` (the Safari "invisible until scroll" correction —
see V3.4.3) was hardcoded to always target `#screen-journal`, and only
ran because `showScreen()` happened to call it by name inside the
`id === 'journal'` branch. Every screen built after that point (Setup,
and anything future) had the exact same underlying symptom, silently,
because nothing called the correction for them — the fix existed, it
just never ran anywhere else.

*Why this is here:* a correction that depends on the *screen's own
render function remembering to call it* will always eventually get
missed for the next new screen — the failure mode is invisible until
someone actually hits it on a real device, same as the tajweed/comment
container-scoping bug (principle 11) was invisible until multiple cards
were mounted at once.

**In practice:** generalized to `fixScreenTopPaint(screenId)`, called
unconditionally at the end of `showScreen()` for whatever screen is
actually active (V3.8.0) — a cross-cutting per-screen concern belongs in
the one place every screen already passes through, not in each screen's
own render function.

## File structure

```
/frontend/
  index.html
  manifest.json
  sw.js
  css/
    tokens.css        — palette + ring-color variables, defined once (see
                         the "define colors upfront as named variables"
                         principle from chat — same idea as principle 2)
    base.css          — resets, layout primitives, mobile-first foundation
    nav.css           — auth band, dropdown, Home page tiles
    journal-table.css — the physical-planner-style landing table
    components.css    — login screen, modals, forms, buttons, swipe rails
    detail-pages.css  — tajweed picker, timer, the unified day-log view's
                        4-card grid/rail layout (V3.6.1 — previously "the
                        3 detail-page forms", before they were merged)
    admin.css         — admin screen (user list, register form)
    settings.css      — Setup screen (V3.9.0, switch redesign V3.10.0):
                        ONE continuous page, 4 independently-saved
                        sections, plus the generic .switch-track/
                        .switch-option/.switch-thumb component (2-way,
                        3-way, and neutral-center variants) and the
                        .settings-row label-left/input-right pattern
  js/
    icons.js          — shared inline SVG icon set
    api.js            — fetch wrapper + every endpoint client function
    uiSwitch.js       — generic switch/segmented-control component
                        (V3.10.0, extracted here V3.12.0 from
                        settingsScreen.js so commentPrivacy.js and other
                        non-Setup screens can use it too — loads early)
    position.js       — client-side position tracking (V3.12.0, rebuilt
                        V3.14.0): computes Sabaq's next default and sums
                        of a multi-surah span, entirely client-side per
                        the Worker's own position.js comment. Shape is now
                        { sabaqTo, activeJuz } — sabaqTo is the single
                        source of truth, activeJuz a derived value kept
                        only for the not-yet-rebuilt Sabaq Dhor card. The
                        V3.12.0 juz'-completion→baseline auto-add is
                        REMOVED (superseded — now Setup's own job)
    auth.js           — login screen, auth band, dropdown, nav item list
    home.js           — Home page tile grid
    tajweed.js        — shared tajweed tag picker (major/minor aware),
                        container-scoped (V3.6.1 — see principle 11).
                        V3.12.0: compact trigger button opening a popup
                        with a checkbox per tag (was an inline row of
                        toggle buttons) — multi-select doesn't fit a
                        scroll-wheel or a plain dropdown
    commentPrivacy.js — shared student-comment + privacy block,
                        container-scoped (V3.6.1 — see principle 11).
                        V3.12.0: "Notes" (was "Your comment on this
                        session"); Private/Public switch (uiSwitch.js),
                        default Public, replacing the "keep hidden from
                        teachers" checkbox
    timer.js          — the real start/lap/stop Dhor timer
    journal.js        — the landing journal table + quick-add modal
                        (V3.9.0: quick-add now pre-fills field values from
                        a linked plan, not just the plan_id)
    dhorPage.js         — Dhor card: picker, timer, tajweed, own date
                          selector (one of 4 cards, V3.6.1); V3.9.0 adds
                          plan-as-default (pre-fills from today's Dhor
                          Schedule plan, if any); V3.10.0 removes the
                          separate per-device waterval/uthmani dropdown —
                          ref is now derived from the student's own
                          mushaf choice (Setup), fetched fresh on open
    sabaqPage.js        — Sabaq card, own date selector (one of 4 cards).
                          V3.14.0: sabaq_from/sabaq_to (combined
                          "surah:ayah" strings, can span multiple surahs,
                          capped at one juz' boundary) replace the old
                          surah/ayah_from/ayah_to trio entirely. Each
                          field is one combined control (chevron opens
                          the surah picker, ayah is a bounded number
                          input, no auto-rollover). Position-driven
                          prepopulation reworked around the simplified
                          { sabaqTo, activeJuz } shape (js/position.js);
                          line/page calc now sums across every surah a
                          span touches (getLinesForSpan)
    sabaqDhorPage.js    — Sabaq Dhor card, own date selector (one of 4).
                          V3.13.0: position-driven checklist — shows the
                          quarter Sabaq is currently in (partial) plus
                          each already-completed quarter before it (up to
                          3), each prepopulated checked; whichever stay
                          checked at save composite into one overall
                          from/to ayah range, replacing the old free-text
                          zone field
    reflectionCard.js   — Tadabbur card (V3.6.1, new) — one reflection
                          per day, no date selector, upserts in place.
                          V3.12.0: Private/Public switch, was a checkbox
    logDetailScreen.js  — orchestrates the 4 cards into one screen:
                          renders all 4, rail scroll position, dot sync.
                          V3.12.0: dots show text labels (Sabaq/SDhor/
                          Dhor/Tadabbur) and sit above the rail (were
                          plain circles below it); also injects each
                          card's header icon + save-button icon once here
    adminPage.js        — admin user-list screen
    settingsScreen.js   — Setup screen (V3.9.0, switch redesign V3.10.0,
                          V2 refinements V3.11.0): 4 independently-saved
                          sections — Profile (gender as a small inline
                          switch on the Name row), Hifz Setup (mushaf
                          switch with hints for all 3 options, neutral-
                          center Juz'/Surah switch that always rests
                          neutral, "Target for Dhor" targets), Dhor Plan

                          (renamed from "Dhor Schedule" — switches +
                          Tomorrow's Portion, an explicit rotation
                          starting point built from the student's own
                          baseline), and Haidh
    app.js              — bootstrap, screen routing (see principle 8);
                          also owns fixScreenTopPaint() (see principle 12)

/shared/
  data.js        — Quran structural data (see principle 2): SURAHS,
                    JUZ_BOUNDARIES (13-line, confirmed) + JUZ_BOUNDARIES_UTHMANI
                    (15-line, derived), HALF_BOUNDARIES + QUARTER_BOUNDARIES_UTHMANI
                    (both prints, all granularities — see RUB_BOUNDARIES'
                    own comment for how each is derived), SURAH_JUZ_RANGE
                    (which juz' each surah touches — identical for both
                    prints, verified), RUB_BOUNDARIES, TAJWEED_DEFAULTS
                    (with major/minor classification), AYAH_WORD_RANGE,
                    LINE13_RANGES, getLines13ForAyahRange(), AYAH_LINE_UTHMANI +
                    getLines15ForAyahRange() (the 15-line print's own line-count
                    mechanism, added 2026-07-29 — genuine per-ayah data, not an
                    approximation the way the 13-line one is), and (V3.9.0)
                    segmentsPerJuz()/unitMarkerCount()/
                    segmentRangeForUnitIndex() — Dhor segment/granularity
                    math shared between dhorPage.js and the Worker's
                    dhorSchedule.js, moved here from a dhorPage.js-local
                    copy so the two can never silently drift apart

/worker/
  wrangler.jsonc  — production + development environments, each own D1
  package.json
  src/
    index.js       — router
    auth.js        — PIN login, token issuing/verification, lockout
    admin.js        — admin-only: list/reset-pin/change-role/register
    logHelpers.js    — shared CRUD/duplicate-detection/privacy logic used
                        by the four independent logs
    sabaqLog.js, sabaqDhorLog.js, dhorLog.js, reflections.js
    plans.js         — the plans feature
    dhorSchedule.js  — Dhor rolling-schedule generator (V3.9.0): on-demand,
                        not a background job — tops up the next 7 active
                        days' worth of plans (plan_type='dhor') from a
                        student's dhor_granularity/quantity/frequency/
                        days_of_week settings, called from the frontend
                        whenever it's a good moment (Setup save, Dhor
                        page open), never a Cron Trigger. V3.11.0 adds an
                        optional explicit start-segment override (Setup's
                        new "Tomorrow's Portion" field) for one generation
                        call only — every other call keeps the original
                        auto-detect-from-history anchor
    attendance.js, position.js, profile.js
    utils.js         — response helpers, boundary validation (principle 4)
  migrations/
    0001_initial.sql
    0002_auth_lockout.sql
    0003_two_entries_per_day.sql
    0004_profile_setup.sql
    0005_v2_independent_logs.sql
    0006_plans_timer_privacy.sql
    0007_admin_role.sql
    0008_whatsapp_number.sql
    0009_setup_profile_fields.sql
    0010_history_baseline_targets.sql
    0011_dhor_schedule_and_haidh_settings.sql

SCHEMA.md          — D1 structure, canonical field names
CONVENTIONS.md      — this file
SETUP.md            — GitHub + Cloudflare setup checklist
TESTING.md          — repeatable manual test checklist per feature
CHANGELOG.md        — versioned delivery history
```

`shared/data.js` is loaded by the frontend via `<script src="../shared/data.js">`
(deliberately not an ES module — see the comment in that file on why) and
imported by the Worker via a relative `require()`/`import` at build time —
same file, two places it runs, never two versions of it maintained by hand.
