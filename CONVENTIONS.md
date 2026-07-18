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

## File structure

```
/frontend/
  index.html
  app.js
  styles.css
  manifest.json
  sw.js

/shared/
  data.js        — Quran structural data (see principle 2), loaded by the
                    frontend as a plain script and require()'d by the Worker

/worker/
  wrangler.jsonc  — production + development environments, each with its own D1
  package.json
  src/
    index.js      — router
    auth.js       — PIN login, token issuing/verification, lockout
    entries.js
    attendance.js
    position.js
    utils.js      — response helpers, boundary validation (principle 4)
  migrations/
    0001_initial.sql
    0002_auth_lockout.sql

SCHEMA.md          — Google Sheet / D1 structure, canonical field names
CONVENTIONS.md      — this file
SETUP.md            — GitHub + Cloudflare setup checklist
```

`shared/data.js` is loaded by the frontend via `<script src="../shared/data.js">`
(deliberately not an ES module — see the comment in that file on why) and
imported by the Worker via a relative `require()`/`import` at build time —
same file, two places it runs, never two versions of it maintained by hand.
