# Academy identity and profile delivery — V4.2.15.29

Development release deployed on 16 October 2026. Migrations 0031 and 0032,
the reviewed 34-profile permanent-ID cutover and authenticated Academy
profile delivery are applied in development. Production is unchanged.

## Current sign-in contract — V5.0 (17 October 2026)

Academy now owns the linked user's PIN as well as shared profile fields. The
stronger shared credential and secure Academy entry replace the earlier
independent-PIN design below. See ACADEMY-SIGNIN.md. Journal UUID ownership and
separate Cloudflare accounts, Workers and databases remain unchanged.

## Academy-branded hosting — V4.2.15.30 (17 October 2026)

The selected address is `https://hifz.maktab4life.org/`, attached to the existing
Hifz-account Pages project `hifzhelper-dev` (release branch `dev`). The Academy
DNS zone holds a CNAME to `hifzhelper-dev.pages.dev`. The client explicitly maps
the new hostname to `hifzhelper-api-dev.hifzhelper-app.workers.dev`; it must remain
a development endpoint until a separately reviewed production rollout.

Academy links point to this address plus the account's current login ID. Requests
go directly to Hifz hosting and its Worker; Academy is not a proxy and its D1 is
not queried for ordinary Hifz use. Custom-domain association precedes DNS
activation, after the matching frontend is published. Browser storage being
unavailable must not change the selected backend. Existing PINs and journals
stay in their development D1; PIN formats and credential sharing are unchanged.

## Identifier contract

| Field | Meaning |
| --- | --- |
| students.login_id | Sign-in code shared with Academy; initially the old students.id |
| students.id | Permanent journal/profile owner; the Academy accounts.account_id for a linked profile |
| students.academy_managed | Marks a profile whose permanent ID was reconciled with Academy |
| Journal student_id and staff/author references | Foreign keys to the permanent students.id |

Login and public account lookup use login_id. Tokens carry students.id,
and protected requests check the current account and role in Hifz D1.
No ordinary Hifz request calls Academy. Existing PIN hashes and their
Hifz-only pepper remain unchanged; Academy hashes are never copied.
New or reset Hifz PINs require two matching entries before the Worker stores
the hash. A mismatch clears both entries and returns to the initial step.

The personal URL, remembered login and device account switcher retain the
login alias. Journal operations use the permanent user ID. Old sessions
must sign in again after deployment/cutover.

## Preparation and cutover

1. Confirm the target environment and export a private, recoverable database
   backup. Rehearse the change against that export.
2. Read current Hifz profiles and Academy account IDs/login IDs. Prepare an
   exact-match plan with worker/tools/prepare-academy-identity.mjs:

   node worker/tools/prepare-academy-identity.mjs --hifz hifz.json --academy academy.json --environment development --output plan.json

3. Resolve every active unmatched or duplicate profile. The planner refuses
   ambiguity and inactive Academy targets for active Hifz users. Unmatched
   inactive Hifz profiles retain their original IDs and historical records.
4. During the reviewed maintenance window, apply migration 0031_login_identity
   to add/backfill login_id, the ownership marker, guard and receipt tables.
5. Deploy the matching Worker and frontend while keys still retain their old
   values. The new code can operate with login_id and id initially equal.
   Confirm both deployments before changing any permanent profile keys.
6. Run applyIdentityPlan(DB, plan, environment) through a trusted maintenance
   executor. It is an exported D1 operation, not a public application endpoint.
   The preparation CLI deliberately has no remote-write mode. Verify existing
   PIN login, personal URLs, learner journals and staff views before general use.

The rekey is one D1 batch with deferred foreign-key checks. It discovers
declared student-owner and actor references, excluding protected Cloudflare
metadata tables, and updates all related columns of each table together.
Stale profile roles, aliases, activation changes, new active users and ID
collisions abort the whole batch. A successful receipt makes retries harmless.
The planner refuses to merge two profiles into one Academy user implicitly.

The current schema has 35 declared profile-reference columns. Grouped updates
keep this operation within the Workers Free query budget; the helper refuses
a schema expansion that would exceed 50 SQL statements in the invocation.

Do not run the key updates as separate console statements. Do not substitute
an ordinary non-transactional loop for DB.batch(). A whole-database restore
would also remove later journal entries: rollback after users resume writing
requires a reviewed inverse mapping/reconciliation, not an automatic restore.

## Profile ownership

Shared profile administration is owned by Academy when the Worker has
PROFILE_AUTHORITY=academy, or when the database has a successful cutover receipt.
The development configuration enables this policy before the journal-ID cutover.
It applies to the whole Hifz database, including retained inactive rows:

- Shared name, contact details, account activation and Hifz roles are read-only
  in Hifz admin. Worker endpoints reject direct attempts to change them.
- Local registration, deletion and teaching-profile creation are closed.
- Hifz groups, journal settings, Haidh settings and teaching operations remain
  editable under their existing permissions.
- PIN verification, PIN hashing, lockouts and the existing Hifz PIN reset
  operation remain local and independent.

## One-way profile and PIN-reset delivery

Migration 0032 adds `academy_profile_links` (Academy user ID, permanent Hifz
student ID, source revision and PIN-reset version), plus `students.credential_epoch`.
Academy V106.91 queues changes in the source transaction and sends signed,
bounded snapshots after saving, with recovery on its existing 15-minute schedule.
The receiver at `/internal/academy/profile-sync` requires a development-specific
HMAC secret, matching target and a fresh timestamp. No ordinary Hifz request
contacts Academy. Each batch applies up to eight profiles atomically.

Only newer source revisions can update name, login ID, WhatsApp number, role
and active status. Journal settings and records remain local. Academy PIN resets
clear Hifz's independent hash and lockout and increment its credential epoch,
revoking prior sessions. Retries cannot reset a newly confirmed PIN again.
A newly granted Hifz user receives a profile with the permanent Academy ID;
conflicting legacy aliases fail for review instead of claiming journals.

Initial links are seeded from the reviewed 34-profile exact match before the
atomic rekey. Five unmatched inactive profiles keep their original keys/history.
Academy migration 0028 adds queue metadata, a projection and transactional
triggers, without copying credentials or changing source profile records.

## Development acceptance — 16 October 2026

V4.2.15.27 profile locks and V4.2.15.28 PIN confirmation are deployed on `dev`.
The current full-export rehearsal passes with all 34 active profiles matched,
eight existing PIN hashes preserved, journal contents preserved, zero role or
status changes and zero foreign-key violations. The rekey covers 35 declared
reference columns and remains within the Workers Free query budget.
V4.2.15.29 and Academy V106.91 Workers are deployed in development. All 34
initial snapshots were accepted and acknowledged, with no pending deliveries.
Live checks preserved all existing PIN hashes, local settings and journal tables.
A disposable account verified provisioning, every shared field, access revocation,
PIN confirmation, reset/lockout/session revocation and safe reset replay; it was
removed afterwards. No real user's PIN was reset during these checks.
The `dev` and `development` branch builds publish the matching frontend releases.
Production remains unchanged.
