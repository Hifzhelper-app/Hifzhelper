#!/usr/bin/env bash
set -Eeuo pipefail

# Hifzhelper one-time Production -> Development D1 seed utility.
# Copies only Maktab activity/attendance history plus maktab_position.
# It never copies students, PIN hashes, settings, calendars, groups, or secrets.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$WORKER_DIR/.." && pwd)"
CONFIG="$WORKER_DIR/wrangler.jsonc"
WRANGLER="$WORKER_DIR/node_modules/.bin/wrangler"

PROD_DB="hifzhelper-maktab1"
DEV_DB="hifzhelper-maktab1-dev"
PROD_ENV="production"
DEV_ENV="development"

# Operational data needed to reproduce the Maktab Summary + Attendance state.
# maktab_position is included because Maktab Dhor defaults/pool state depend on it.
TABLES=(
  "attendance"
  "maktab_sabaq_log"
  "maktab_sabaq_dhor_log"
  "maktab_dhor_log"
  "maktab_position"
)

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hifzhelper-seed.XXXXXX")"
BACKUP_DIR="$WORKER_DIR/.seed-backups/$STAMP"
ROLLBACK_NEEDED=0

say() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
  local status=$?
  trap - EXIT

  if [[ $status -ne 0 && $ROLLBACK_NEEDED -eq 1 ]]; then
    say ""
    say "Seed failed after Development was cleared. Attempting automatic rollback..."
    if restore_development; then
      say "Rollback completed from: $BACKUP_DIR"
    else
      say "WARNING: automatic rollback did not complete. Keep the backup folder and follow the restore steps in SEED-DEV-README.md." >&2
    fi
  fi

  rm -rf "$TMP_DIR"
  exit "$status"
}
trap cleanup EXIT

run_wrangler() {
  "$WRANGLER" "$@"
}

query_json() {
  local db="$1"
  local env_name="$2"
  local sql="$3"
  local out="$4"
  run_wrangler d1 execute "$db" \
    --remote \
    --env "$env_name" \
    --config "$CONFIG" \
    --command "$sql" \
    --json > "$out"
}

extract_and_check_users() {
  node - "$1" "$2" "$3" <<'NODE'
const fs = require('fs');

function collectRows(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(collectRows);
  if (typeof value !== 'object') return [];
  if (Array.isArray(value.results)) return value.results;
  if ('result' in value) return collectRows(value.result);
  return [];
}

function readRows(path) {
  const raw = fs.readFileSync(path, 'utf8').trim();
  if (!raw) throw new Error(`No JSON returned in ${path}`);
  return collectRows(JSON.parse(raw));
}

const [refsPath, prodUsersPath, devUsersPath] = process.argv.slice(2);
const refs = readRows(refsPath).map(r => String(r.id));
const prodUsers = new Map(readRows(prodUsersPath).map(r => [String(r.id), r]));
const devUsers = new Map(readRows(devUsersPath).map(r => [String(r.id), r]));

const missing = [];
const mismatched = [];
for (const id of refs) {
  const p = prodUsers.get(id);
  const d = devUsers.get(id);
  if (!d) {
    missing.push(id);
    continue;
  }
  if (!p) continue;
  if (String(p.name ?? '') !== String(d.name ?? '') || String(p.role ?? '') !== String(d.role ?? '')) {
    mismatched.push({ id, prod: `${p.name} [${p.role}]`, dev: `${d.name} [${d.role}]` });
  }
}

if (missing.length) {
  console.error('Referenced Production user IDs missing from Development:');
  for (const id of missing) console.error(`  - ${id}`);
}
if (mismatched.length) {
  console.error('Referenced IDs exist in both DBs but name/role differs:');
  for (const row of mismatched) console.error(`  - ${row.id}: PROD ${row.prod} | DEV ${row.dev}`);
}
if (missing.length || mismatched.length) process.exit(1);

console.log(`User preflight passed: ${refs.length} referenced Production IDs all match Development by id/name/role.`);
NODE
}

print_counts() {
  node - "$1" "$2" <<'NODE'
const fs = require('fs');
function collectRows(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(collectRows);
  if (typeof value !== 'object') return [];
  if (Array.isArray(value.results)) return value.results;
  if ('result' in value) return collectRows(value.result);
  return [];
}
function rows(path) { return collectRows(JSON.parse(fs.readFileSync(path, 'utf8'))); }
const [path, label] = process.argv.slice(2);
console.log(label);
for (const r of rows(path)) console.log(`  ${r.table_name}: ${r.row_count}`);
NODE
}

compare_counts() {
  node - "$1" "$2" <<'NODE'
const fs = require('fs');
function collectRows(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(collectRows);
  if (typeof value !== 'object') return [];
  if (Array.isArray(value.results)) return value.results;
  if ('result' in value) return collectRows(value.result);
  return [];
}
function mapCounts(path) {
  return new Map(collectRows(JSON.parse(fs.readFileSync(path, 'utf8'))).map(r => [String(r.table_name), Number(r.row_count)]));
}
const [prodPath, devPath] = process.argv.slice(2);
const prod = mapCounts(prodPath);
const dev = mapCounts(devPath);
let bad = false;
for (const [table, expected] of prod) {
  const actual = dev.get(table);
  if (actual !== expected) {
    console.error(`${table}: Production=${expected}, Development=${actual ?? 'missing'}`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log('Post-seed row-count verification passed for every copied table.');
NODE
}

assert_no_foreign_key_errors() {
  node - "$1" <<'NODE'
const fs = require('fs');
function collectRows(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(collectRows);
  if (typeof value !== 'object') return [];
  if (Array.isArray(value.results)) return value.results;
  if ('result' in value) return collectRows(value.result);
  return [];
}
const path = process.argv[2];
const rows = collectRows(JSON.parse(fs.readFileSync(path, 'utf8')));
if (rows.length) {
  console.error('Foreign-key verification returned rows:');
  console.error(JSON.stringify(rows, null, 2));
  process.exit(1);
}
console.log('Foreign-key verification passed for copied tables.');
NODE
}

export_table() {
  local db="$1"
  local env_name="$2"
  local table="$3"
  local output="$4"
  run_wrangler d1 export "$db" \
    --remote \
    --env "$env_name" \
    --config "$CONFIG" \
    --table "$table" \
    --no-schema \
    --output "$output" \
    --skip-confirmation
}

clear_development_tables() {
  local sql="BEGIN TRANSACTION;"
  local table
  for table in "${TABLES[@]}"; do
    sql+=" DELETE FROM ${table};"
  done
  sql+=" COMMIT;"
  run_wrangler d1 execute "$DEV_DB" \
    --remote \
    --env "$DEV_ENV" \
    --config "$CONFIG" \
    --command "$sql" \
    --yes >/dev/null
}

import_set_into_development() {
  local dir="$1"
  local table
  for table in "${TABLES[@]}"; do
    say "  importing $table"
    run_wrangler d1 execute "$DEV_DB" \
      --remote \
      --env "$DEV_ENV" \
      --config "$CONFIG" \
      --file "$dir/$table.sql" \
      --yes >/dev/null
  done
}

restore_development() {
  [[ -d "$BACKUP_DIR" ]] || return 1
  clear_development_tables || return 1
  import_set_into_development "$BACKUP_DIR" || return 1
  ROLLBACK_NEEDED=0
  return 0
}

[[ "$PROD_DB" != "$DEV_DB" ]] || fail "Production and Development database names are identical; refusing to continue."
[[ -f "$CONFIG" ]] || fail "Cannot find $CONFIG"
[[ -x "$WRANGLER" ]] || fail "Wrangler is not installed in worker/node_modules. Run: cd worker && npm install"
command -v node >/dev/null 2>&1 || fail "Node.js is required (the project already uses it for Wrangler)."

cd "$WORKER_DIR"

say "Hifzhelper one-time Production -> Development seed"
say "Production : $PROD_DB ($PROD_ENV)"
say "Development: $DEV_DB ($DEV_ENV)"
say ""
say "Will REPLACE these Development tables with Production data:"
for table in "${TABLES[@]}"; do say "  - $table"; done
say ""
say "Will NOT copy students, PIN hashes, authentication state, groups, calendar, settings, or secrets."
say ""

say "Checking Cloudflare authentication..."
run_wrangler whoami >/dev/null

REF_SQL="WITH refs(id) AS (\
 SELECT student_id FROM attendance\
 UNION SELECT student_id FROM maktab_sabaq_log\
 UNION SELECT entered_by FROM maktab_sabaq_log\
 UNION SELECT teacher_id FROM maktab_sabaq_log\
 UNION SELECT student_comment_by FROM maktab_sabaq_log\
 UNION SELECT teacher_feedback_by FROM maktab_sabaq_log\
 UNION SELECT student_id FROM maktab_sabaq_dhor_log\
 UNION SELECT entered_by FROM maktab_sabaq_dhor_log\
 UNION SELECT teacher_id FROM maktab_sabaq_dhor_log\
 UNION SELECT student_comment_by FROM maktab_sabaq_dhor_log\
 UNION SELECT teacher_feedback_by FROM maktab_sabaq_dhor_log\
 UNION SELECT student_id FROM maktab_dhor_log\
 UNION SELECT entered_by FROM maktab_dhor_log\
 UNION SELECT teacher_id FROM maktab_dhor_log\
 UNION SELECT student_comment_by FROM maktab_dhor_log\
 UNION SELECT teacher_feedback_by FROM maktab_dhor_log\
 UNION SELECT student_id FROM maktab_position\
) SELECT DISTINCT id FROM refs WHERE id IS NOT NULL ORDER BY id;"

COUNT_SQL="SELECT 'attendance' AS table_name, COUNT(*) AS row_count FROM attendance\
 UNION ALL SELECT 'maktab_sabaq_log', COUNT(*) FROM maktab_sabaq_log\
 UNION ALL SELECT 'maktab_sabaq_dhor_log', COUNT(*) FROM maktab_sabaq_dhor_log\
 UNION ALL SELECT 'maktab_dhor_log', COUNT(*) FROM maktab_dhor_log\
 UNION ALL SELECT 'maktab_position', COUNT(*) FROM maktab_position;"

FK_SQL="PRAGMA foreign_key_check(attendance);\
 PRAGMA foreign_key_check(maktab_sabaq_log);\
 PRAGMA foreign_key_check(maktab_sabaq_dhor_log);\
 PRAGMA foreign_key_check(maktab_dhor_log);\
 PRAGMA foreign_key_check(maktab_position);"

say "Running user-ID preflight..."
query_json "$PROD_DB" "$PROD_ENV" "$REF_SQL" "$TMP_DIR/prod-refs.json"
query_json "$PROD_DB" "$PROD_ENV" "SELECT id, name, role FROM students ORDER BY id;" "$TMP_DIR/prod-users.json"
query_json "$DEV_DB" "$DEV_ENV" "SELECT id, name, role FROM students ORDER BY id;" "$TMP_DIR/dev-users.json"
extract_and_check_users "$TMP_DIR/prod-refs.json" "$TMP_DIR/prod-users.json" "$TMP_DIR/dev-users.json"

query_json "$PROD_DB" "$PROD_ENV" "$COUNT_SQL" "$TMP_DIR/prod-counts.json"
query_json "$DEV_DB" "$DEV_ENV" "$COUNT_SQL" "$TMP_DIR/dev-before-counts.json"
say ""
print_counts "$TMP_DIR/prod-counts.json" "Production rows to seed:"
print_counts "$TMP_DIR/dev-before-counts.json" "Current Development rows that will be replaced:"
say ""

say "This is a destructive Development-only operation. A rollback backup will be created first."
printf 'Type exactly SEED DEVELOPMENT to continue: '
IFS= read -r confirmation
if [[ "$confirmation" != "SEED DEVELOPMENT" ]]; then
  say "Cancelled. No Development data was changed."
  exit 0
fi

mkdir -p "$BACKUP_DIR"
say ""
say "Backing up current Development target tables to:"
say "  $BACKUP_DIR"
for table in "${TABLES[@]}"; do
  say "  backing up $table"
  export_table "$DEV_DB" "$DEV_ENV" "$table" "$BACKUP_DIR/$table.sql"
done

say "Exporting Production seed data to a temporary directory..."
for table in "${TABLES[@]}"; do
  say "  exporting $table"
  export_table "$PROD_DB" "$PROD_ENV" "$table" "$TMP_DIR/$table.sql"
done

say "Replacing Development operational history..."
clear_development_tables
ROLLBACK_NEEDED=1
import_set_into_development "$TMP_DIR"

say "Verifying row counts..."
query_json "$DEV_DB" "$DEV_ENV" "$COUNT_SQL" "$TMP_DIR/dev-after-counts.json"
compare_counts "$TMP_DIR/prod-counts.json" "$TMP_DIR/dev-after-counts.json"

say "Verifying foreign keys..."
query_json "$DEV_DB" "$DEV_ENV" "$FK_SQL" "$TMP_DIR/fk-check.json"
assert_no_foreign_key_errors "$TMP_DIR/fk-check.json"

ROLLBACK_NEEDED=0
say ""
say "SUCCESS: Development now has the Production Maktab activity + Attendance seed data."
say "Development student/login rows were not changed."
say "Rollback backup retained at:"
say "  $BACKUP_DIR"
say "After you have verified Development, you can delete that backup folder manually."
