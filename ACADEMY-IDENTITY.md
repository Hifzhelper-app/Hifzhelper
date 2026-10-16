# Academy identity foundation — V4.2.15.27

Development testing release prepared on 16 October 2026. The additive schema
migration 0031 has been applied to the development database. The reviewed
Academy-ID data cutover remains a separate operation. Production is unchanged.

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

The current schema has 34 declared profile-reference columns. Grouped updates
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

## Remaining integration stage

This release is the identity/schema foundation and ownership boundary.
Academy-to-Hifz change delivery (durable outbox, authenticated receiver,
retries, version ordering and reconciliation) is not implemented here.
Production rollout should follow that delivery stage. Development cutover
can be used to validate the identity and journal migration first.

Profile ownership and the journal-ID cutover are independent. Enabling
PROFILE_AUTHORITY=academy closes local profile administration and registration
without rekeying journals or writing a migration receipt. Without that setting,
additive migration 0031 alone retains legacy registration behaviour until the
successful cutover receipt. The production configuration is unchanged.
Do not expose a new administrative profile-sync route without its trusted
server authentication and operation allowlist.

## Validation status — 16 October 2026

The migration and PIN flow passed the full local regression suite and a local
Cloudflare D1 runtime rehearsal. Exact-record comparisons used synthetic data.
Live profile reconciliation confirms 42/42 production and 34/34 development
active profiles matched Academy at 17:35 Riyadh time.

Cloudflare authorization was refreshed on 16 October, and the development
database export succeeded at 18:51 Riyadh time. The full exported copy passed
both SQLite and local Cloudflare D1 runtime rehearsals at 18:53: all 368
application records matched the expected identity-only changes, all eight
stored PIN hashes were preserved, all 34 reference columns were covered, and
foreign-key checks found no violations. The operation used 37 SQL statements.
There were 34 matched active profiles and five retained inactive profiles.

V4.2.15.26 was deployed to the GitHub dev branch and both development builds
were verified. The additive migration 0031 has been applied: all 39 profiles
retain their original IDs and login aliases, and foreign-key checks still pass.
The Academy-ID data cutover has not been applied. The GitHub dev branch is
connected to hifzhelper-api-dev and hifzhelper-dev.pages.dev (Pages project
hifzhelper-dev); pushing the release there triggers the existing development
builds. Their deployment results must be verified before the data cutover.
The refreshed command-line authorization currently covers Hifz D1 and basic
account information. Production remains unchanged.

V4.2.15.27 corrects the development ownership policy: names, contact numbers,
roles and activation are protected before rekeying. The same policy drives
admin/self-profile responses, frontend locks, registration and write validation.
No further database migration is required.
