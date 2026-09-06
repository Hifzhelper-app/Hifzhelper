# One-time Production → Development D1 seed

This utility is for the **one-time** Hifzhelper exercise discussed on 2026-09-05. Run it from the macOS Terminal rather than copying rows in the Cloudflare browser console.

## What it copies

It replaces these Development tables with the current Production rows:

- `attendance`
- `maktab_sabaq_log`
- `maktab_sabaq_dhor_log`
- `maktab_dhor_log`
- `maktab_position`

`maktab_position` is copied with the log history because Maktab Dhor defaults and pool state depend on it.

It **does not** copy `students`, PIN hashes, auth/lockout state, groups, Maktab settings, terms/calendar, or secrets. Development users therefore keep their Development login state.

## Safety checks

Before it changes Development, the script:

1. uses the existing `worker/wrangler.jsonc` Production and Development bindings;
2. checks every Production user ID referenced by the copied data exists in Development;
3. also requires the referenced ID's `name` and `role` to match;
4. shows Production and current Development row counts;
5. requires the exact typed confirmation `SEED DEVELOPMENT`;
6. exports a rollback copy of the current Development target tables;
7. only then clears and imports the target tables;
8. verifies post-import row counts and foreign keys;
9. automatically attempts rollback if anything fails after Development has been cleared.

## Run from macOS Terminal

From the repository root:

```bash
cd worker
npm install
npm run seed:dev-from-prod-once
```

Wrangler must already be authenticated to the Cloudflare account that owns both D1 databases. If required, run:

```bash
npx wrangler login
```

Then rerun the seed command.

The script displays the two database names before it does anything destructive:

- Production: `hifzhelper-maktab1`
- Development: `hifzhelper-maktab1-dev`

Read that banner before typing the confirmation.

## Rollback backup

A successful run leaves the old Development rows under:

```text
worker/.seed-backups/YYYYMMDD-HHMMSS/
```

Keep that folder until Development has been checked in the browser/device. It contains database data and should not be shared or committed. `.gitignore` excludes it.

If automatic rollback ever reports that it could not complete, do **not** keep testing on the partially seeded Development DB. Use the retained files to restore the five tables after clearing them, or ask for help with the exact restore command.

## Expected result

Development keeps its own users/configuration, but its Maktab Summary, Attendance register/Haidh history, log detail screens and Maktab Dhor current-position state are seeded from Production for realistic testing.
