# Hifzhelper — one-time Production → Development seed

**Purpose:** copy current Production Maktab activity and Attendance data into Development for realistic testing. This is a one-time macOS Terminal operation; it is not an app release and does not change the served Hifzhelper version.

## Before running

- Work from the current Hifzhelper repo containing `worker/wrangler.jsonc`.
- Confirm you are logged into the Cloudflare account that owns both D1 databases.
- Production binding in the repo: `hifzhelper-maktab1` / `production`.
- Development binding in the repo: `hifzhelper-maktab1-dev` / `development`.

## Run

```bash
cd worker
npm install
npm run seed:dev-from-prod-once
```

The script will preflight the referenced users and show row counts. It does **nothing destructive** until you type exactly:

```text
SEED DEVELOPMENT
```

## Data copied

Development copies/replaces Production rows for:

- `attendance`
- `maktab_sabaq_log`
- `maktab_sabaq_dhor_log`
- `maktab_dhor_log`
- `maktab_position`

It deliberately does **not** copy `students`, PIN/auth fields, groups, Maktab settings, terms/calendar, or secrets.

## After running

1. Open Development and verify Maktab Summary history.
2. Verify Attendance/Haidh history and ordering.
3. Open a few student/activity detail views.
4. Check Quick Log Dhor defaults for a student with existing history (`maktab_position` was copied for this consistency).
5. Keep the rollback folder until satisfied:
   `worker/.seed-backups/YYYYMMDD-HHMMSS/`
6. Delete that backup folder manually once Development is confirmed good.

## Safety / rollback

- Existing Development target rows are exported before the script clears anything.
- If a failure occurs after clearing Development, the script automatically attempts to restore those five tables from the backup.
- Post-seed Production/Development row counts must match.
- Foreign-key checks must return clean before the run is declared successful.
