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
does nothing for the browser's ordinary HTTP cache or Cloudflare's edge
cache, which will happily keep serving an old `nav.css` under that same
unversioned URL forever. The `_headers` file (V3.6) now tells both of
those to cache CSS/JS aggressively (`immutable`, one year) specifically
*because* the URL changes whenever the content does — so skipping the
version bump on a release isn't a cosmetic miss, it's the one thing that
makes the aggressive caching safe in the first place.

**In practice:** `index.html`, `manifest.json`, and `sw.js` themselves are
deliberately NOT versioned and stay on `no-cache` (see `_headers`) — they're
the entry points that reference everything else, so they must always be
re-fetched fresh, or the browser never learns a new version string exists.

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
    detail-pages.css  — tajweed picker, timer, the 3 detail-page forms
    admin.css         — admin screen (user list, register form)
  js/
    icons.js          — shared inline SVG icon set
    api.js            — fetch wrapper + every endpoint client function
    auth.js           — login screen, auth band, dropdown, nav item list
    home.js           — Home page tile grid
    tajweed.js        — shared tajweed tag picker (major/minor aware)
    commentPrivacy.js — shared student-comment + privacy block
    timer.js          — the real start/lap/stop Dhor timer
    journal.js        — the landing journal table + quick-add modal
    dhorPage.js        — dedicated Dhor page (picker, timer, tajweed)
    sabaqPage.js        — dedicated Sabaq page
    sabaqDhorPage.js    — dedicated Sabaq Dhor page
    adminPage.js        — admin user-list screen
    app.js              — bootstrap, screen routing (see principle 8)

/shared/
  data.js        — Quran structural data (see principle 2): SURAHS,
                    JUZ_BOUNDARIES, RUB_BOUNDARIES, TAJWEED_DEFAULTS
                    (with major/minor classification), AYAH_WORD_RANGE,
                    LINE13_RANGES, getLines13ForAyahRange()

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
