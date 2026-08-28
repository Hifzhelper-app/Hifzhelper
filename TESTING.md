# Hifzhelper — Testing Guide

A repeatable checklist for confirming the backend actually works, not just
that the code looks right. Run this against **dev** before merging to
`main`; re-run the "Smoke test" subset against **production** after merging,
to confirm the merge itself didn't break anything.

Tool: any REST client works (Hoppscotch, Postman, curl). Examples below
assume Hoppscotch, matching how V1.0 was actually tested.

Base URLs:
- Dev: `https://hifzhelper-api-dev.hifzhelper-app.workers.dev`
- Production: `https://hifzhelper-api.hifzhelper-app.workers.dev`

---

## 0. One-time setup per environment

Insert a test student directly via that database's D1 Console:
```sql
INSERT INTO students (id, name, role, created_date, active)
VALUES ('K7M2QX', 'Test Student', 'student', '2026-07-18', 1);
```
Use a distinct, obviously-fake ID/name so it's never mistaken for a real
student — don't reuse `K7M2QX` for a real person later.

**On production specifically**: only add this if you want to run the smoke
test there after a merge. That means a fake row sitting in real maktab data
permanently — a deliberate choice, not something to do by default just
because this doc says "per environment." If you'd rather not, skip
production testing entirely and rely on dev coverage + trusting the merge.

---

## 1. Auth

| Test | Request | Expect |
|---|---|---|
| First login | `POST /auth/login` `{"id":"K7M2QX","pin":"1234"}` | `200`, `firstLogin: true`, a token |
| Repeat login (correct PIN) | same body again | `200`, `firstLogin: false` |
| Wrong PIN | `{"id":"K7M2QX","pin":"9999"}` | `401 Invalid ID or PIN` |
| Lockout | repeat the wrong PIN 5 times total | 5th attempt: `429`, message names a lockout time |
| Missing/malformed body | `{"id":"K7M2QX"}` (no pin) | `400` |

## 2. Sabaq / Sabaq Dhor / Dhor / Reflections (V2 — four independent logs)

Requires `Authorization: Bearer <token>` from a successful login above.
No caps in V2 — every `POST` is a new row (never an upsert), and `DELETE`
identifies a row by its own `id`, not by date.

**Sabaq**

| Test | Request | Expect |
|---|---|---|
| Save | `POST /sabaq` `{"date":"2026-07-18","surah":67,"ayah_from":1,"ayah_to":5}` | `200 {"id": N, "isDuplicate": false}` |
| Read | `GET /sabaq` | array containing that row |
| Second entry, same day | `POST /sabaq` again, same date, different ayah range | `200`, a **new** `id` — GET now shows two rows for that date, not one updated row |
| Exact duplicate | `POST /sabaq` with identical content to an existing row, same date | `200`, `isDuplicate: true` — still saved, just flagged, not rejected |
| Add a comment later | `PATCH /sabaq` `{"id": N, "student_comment": "felt good today"}` | `200`; GET shows `student_comment` set, plus `student_comment_by`/`student_comment_at` populated |
| Correct a mistake in the entry itself | `PATCH /sabaq` `{"id": N, "ayah_to": 8}` | `200`; GET shows the updated `ayah_to`, rest of the row unchanged — confirms edits aren't limited to comments (V2.3 correction) |
| Edit content + comment in one call | `PATCH /sabaq` `{"id": N, "surah": 2, "student_comment": "fixed the surah"}` | `200`; both changes applied in the same row |
| Delete by id | `DELETE /sabaq?id=N` | `200`; GET no longer shows that row (other rows for the same date untouched) |

**Sabaq Dhor** — same shape via `/sabaq-dhor`, fields `zone`/`tajweed_tags`/`mistakes`.

**Dhor** — same shape via `/dhor`, fields `segment_from`/`segment_to`/`ref`/`mistakes`/`minutes`. Also check: invalid `ref` (not `waterval`/`uthmani`) → `400`.

**Reflections** — via `/reflections`, field `reflection` only. No `PATCH` (no comment concept) — confirm attempting one isn't expected to exist as a route.

**Attendance side-effect**: saving any Sabaq/Sabaq Dhor/Dhor entry should mark that date `present` in the `attendance` table (check via D1 console) — reflections should **not** trigger this.

## 3. Attendance

| Test | Request | Expect |
|---|---|---|
| Auto-present | after saving an entry for a date (test 2 above) | `SELECT * FROM attendance WHERE student_id='K7M2QX'` in the D1 console shows that date as `present`, with no separate `/attendance` call ever made |
| Manual override | `POST /attendance` `{"date":"2026-07-20","status":"haidh"}` | `200`; then saving an entry for that same date **should** flip it to `present` — sabaq always wins, even over a manually-set `haidh` |
| Predict haidh | `POST /attendance/predict` `{"cycleLength":28,"periodLength":5,"lastStart":"2026-06-01"}` | `200 {"predicted": N}`; GET `/attendance?month=2026-07` shows `predicted-haidh` rows, none overwriting existing real entries |

## 4. Position

| Test | Request | Expect |
|---|---|---|
| Save | `POST /position` `{"position_json":"{\"activeJuz\":30,\"studyOrder\":[30],\"juz\":{}}"}` | `200 {"saved": true}` |
| Read back | `GET /position` | same `position_json` string returned |
| Survives reload | log out and back in (frontend), or just re-fetch | data still there — this is the actual point of moving off localStorage |

---

## 5. Profile & setup

| Test | Request | Expect |
|---|---|---|
| Get profile before setup | `GET /profile` | `setup_complete: 0`, `gender`/`track_haidh` likely null/0 |
| Complete setup | `POST /profile` `{"name":"Test Student","gender":"F","track_haidh":true,"setup_complete":true}` | `200 {"saved": true}` |
| Confirm it stuck | `GET /profile` | `setup_complete: 1`, `gender: "F"`, `track_haidh: 1`, `name` updated |
| Invalid gender | `POST /profile` `{"gender":"X"}` | `400 gender must be M or F` |
| Partial update doesn't clobber | `POST /profile` `{"track_haidh":false}` (omit name/gender) | `200`; GET shows `name`/`gender` unchanged, only `track_haidh` flipped |

## 6. Plans (V3.0)

| Test | Request | Expect |
|---|---|---|
| Create a plan | `POST /plans` `{"plan_type":"dhor","target_date":"2026-08-01","segment_from":11,"segment_to":12,"ref":"waterval","notes":"Juz 3 Q3-4"}` | `200 {"id": N}` |
| Read plans for that day | `GET /plans?date=2026-08-01` | array containing the plan, `status: "planned"` |
| Quick-checkbox complete | `PATCH /plans` `{"id": N, "status": "completed"}` | `200`; GET shows `status: "completed"`, `completed_log_id: null` |
| Full-detail complete | `POST /dhor` with `{"date":"2026-08-01","segment_from":11,"segment_to":12,"ref":"waterval","plan_id": M}` (a fresh plan) | `200`; `GET /plans?date=2026-08-01` shows that plan's `status: "completed"` and `completed_log_id` set to the new dhor_log row's id |
| Invalid/foreign plan_id | Save a log with a `plan_id` that doesn't exist or belongs to another student | `200` (save still succeeds — linking is a bonus, never fails the save) |
| Delete a plan | `DELETE /plans?id=N` | `200`; GET no longer shows it |

## 7. Timer / lap (V3.0)

| Test | Request | Expect |
|---|---|---|
| Save with lap times | `POST /dhor` `{"date":"2026-08-01","segment_from":1,"segment_to":1,"ref":"waterval","duration_seconds":320,"lap_times":[125,95,100]}` | `200` |
| Read it back | `GET /dhor` | the entry's `lap_times` comes back as a real array `[125,95,100]`, not a JSON string |
| Invalid lap_times | `POST /dhor` with `"lap_times": "not an array"` | `400` |
| Negative lap value | `POST /dhor` with `"lap_times": [100, -5]` | `400` |

## 8. Privacy (V3.0)

Requires two things to test properly: a second **teacher** account, and
checking responses as different requesters (not just as the student).

| Test | Request | Expect |
|---|---|---|
| Private student_comment | `PATCH /sabaq` `{"id": N, "student_comment": "felt rushed", "student_comment_private": true}` | `200`; GET as the student shows the comment; GET as any teacher shows `student_comment: null` |
| teacher_feedback visibility 'all' | `PATCH /sabaq` `{"id": N, "teacher_feedback": "well done", "teacher_feedback_visibility": "all"}` (as the teacher) | Student and any teacher both see it |
| teacher_feedback visibility 'teachers_only' | Same, `"teacher_feedback_visibility": "teachers_only"` | Student sees `null`; any teacher sees the real value |
| teacher_feedback visibility 'private' | Same, `"teacher_feedback_visibility": "private"` | Student sees `null`; the authoring teacher sees it; a **different** teacher sees `null` |
| Private reflection | `POST /reflections` `{"date":"...","reflection":"...","is_private":true}` | Student sees it; any teacher's `GET /reflections?student_id=...` shows `reflection: null` for that row |

## 9. Admin (V3.3.1)

Requires logging in as `ABCDEFG` (bootstrap admin, PIN `1234` on first login)
to get an admin token. Every test below should also be tried once with a
**student's** token, to confirm the `403 Not authorized` gate actually works,
not just that the admin path works.

| Test | Request | Expect |
|---|---|---|
| List users (as admin) | `GET /admin/users` | array of all students, no `pin_hash` field present |
| List users (as student) | same, with a student token | `403 Not authorized` |
| Reset a PIN | `POST /admin/reset-pin` `{"id":"K7M2QX"}` | `200 {"reset": true}`; that student's next login is treated as first-login again (whatever PIN they submit becomes the new one) |
| Reset unknown ID | `POST /admin/reset-pin` `{"id":"ZZZZZZ"}` | `404 Student not found` |
| Change role | `POST /admin/change-role` `{"id":"K7M2QX","role":"teacher"}` | `200`; `GET /admin/users` shows the updated role |
| Invalid role | `POST /admin/change-role` `{"id":"K7M2QX","role":"bogus"}` | `400` |
| Register a new student | `POST /admin/register-student` `{"name":"Test Two"}` | `200 {"id": "<6-char code>", "name": "Test Two"}`; that new ID can then log in for the first time exactly like any other account |
| Register with no name | `POST /admin/register-student` `{}` | `400` |

## 10. Self-registration duplicate-check & lookup (V3.4)

| Test | Request | Expect |
|---|---|---|
| Register, no WhatsApp | `POST /auth/register` `{"name":"Test Three"}` | `200 {"id": "<6-char code>", "name": "Test Three"}` |
| Register, WhatsApp, no existing match | `POST /auth/register` `{"name":"Test Four","whatsapp_number":"+1 555-0100"}` | `200`, real row created |
| Duplicate name+WhatsApp (different formatting) | `POST /auth/register` `{"name":"test four","whatsapp_number":"15550100"}` | `200 {"matched": true}` — **no new row created** |
| Force past a duplicate | Same body as above, plus `"force": true` | `200`, a second, separate row created for the same name+WhatsApp |
| Duplicate check ignores inactive accounts | Deactivate the "Test Four" account (`active = 0` via admin), then repeat the duplicate request without `force` | `200`, a fresh account created directly — no match prompt |
| Lookup an active ID with no PIN yet | `GET /auth/lookup?id=<Test Three's ID>` | `200 {"name": "Test Three", "hasPin": false}` |
| Lookup an active ID with a PIN set | Log in once as that ID first, then repeat the lookup | `200`, `hasPin: true` |
| Lookup a nonexistent ID | `GET /auth/lookup?id=ZZZZZZ` | `404` |
| Lookup an inactive ID | `GET /auth/lookup?id=<a deactivated student's ID>` | `404` — identical to nonexistent, doesn't reveal the account exists |
| Lookup with no id param | `GET /auth/lookup` | `400` |

**Frontend, manual (needs a browser, not just the REST client):**
1. Visit `/<a real, active ID with no PIN yet>` → lands on the create-PIN screen with "Ahlan wa Sahlan, [name]", not the ID+PIN screen.
2. Enter a 4-digit PIN → focus jumps to the confirm row automatically, no button tapped.
3. Enter a *different* 4-digit PIN in the confirm row → error shown, both rows clear, focus returns to the first box.
4. Enter matching PINs in both rows → logs straight into the journal, no button tapped either time.
5. Log out, revisit the same URL → now lands on the personalized sign-in screen (PIN only, no ID field), and entering the correct PIN signs in automatically on the 4th digit.
6. Visit the bare domain with no path, or a made-up path like `/ZZZZZZ` → lands on the fallback ID+PIN screen, with "New Registration", no "4-digit PIN"/"First time" text, and the "Forgot your pin or ID?" message instead of "Lost your PIN?".
7. Register a brand new student → auto-navigates to the "Registered!" screen showing the exact confirmation message and the personal URL with a working copy button, not back to the register form.
8. From the register screen, submit a name+WhatsApp that already matches an existing student → the two-choice prompt appears instead of silently registering; "Create a new journal anyway" proceeds to register; "Reset PIN for the existing journal" opens a pre-filled `mailto:` link instead.
9. On the journal landing page, refresh a few times → the green "Welcome" banner pushes the page content down while visible instead of covering the auth band/heading.

## 11. Session security, duplicate handling, admin list (V3.4.1)

| Test | Request | Expect |
|---|---|---|
| Self-registration duplicate | `POST /auth/register` with a name+WhatsApp matching an existing active student | `200 {"matched": true}` — no row created |
| Self-registration force-create | Same body plus `"force": true` | `200`, new row created with name auto-numbered, e.g. `"John Smith 2"` |
| Third duplicate, auto-numbering | Force-create a THIRD student sharing that same name | Name becomes `"John Smith 3"`, not `"John Smith 2"` again |
| Admin registration duplicate | `POST /admin/register-student` (as admin) with a name+WhatsApp matching an existing active student | `200 {"matched": true, "matchedId": "<existing ID>"}` |
| Admin registration force-create | Same body plus `"force": true` | `200`, new row created, name auto-numbered same as self-registration |
| Admin registration, no WhatsApp given | `POST /admin/register-student` `{"name": "Test Five"}` | `200`, created normally — duplicate check only runs when a WhatsApp is given |

**Frontend, manual:**
1. Log in as a student, then press the browser's back button → immediately logged out, back on a login screen — never silently shows a different account's journal.
2. Log in, close the tab entirely, reopen the same URL → asks to sign in again (token didn't survive the close).
3. Self-register with a name+WhatsApp that already matches an existing student → the two-choice prompt appears; choosing "Create a new journal anyway" asks about deactivating the old one (Yes opens a prefilled email, either way the new journal still gets created with an auto-numbered name).
4. From the admin panel, register a student whose name+WhatsApp matches an existing one → "Continue"/"Reset PIN" prompt appears; "Reset PIN" resets the *existing* student directly (check via a subsequent login, no email involved); "Continue" creates the new one and, if confirmed, also deactivates the existing one.
5. In the admin student list, tap the copy icon on a row → URL copied, icon briefly shows a checkmark. On a browser that supports `navigator.share` (e.g. mobile Safari/Chrome), a share icon is also present and opens the native share sheet; on desktop Firefox, the share icon isn't there at all.
6. In the admin student list, mark a student inactive → their name greys out in the list; no separate "Inactive" text appears anywhere in the row.
7. Register a new student via self-registration → on the "Registered!" screen, tap "Copy and Continue" without touching the copy icon first → still navigates to the create-PIN screen, and pasting anywhere confirms the URL was copied regardless.

## 12. Session hardening, duplicate-check gap, protocol changes (V3.4.2)

| Test | Request | Expect |
|---|---|---|
| No-WhatsApp duplicate, self-registration | `POST /auth/register` `{"name":"Test Six"}`, then again with the same name, no whatsapp_number | Second call: `200 {"matched": true}` — no new row created |
| No-WhatsApp duplicate, force-create | Same second call plus `"force": true` | `200`, new row created as "Test Six 2" |
| No-WhatsApp duplicate, admin registration | `POST /admin/register-student` (as admin), same name twice, no whatsapp_number | Second call: `200 {"matched": true, "matchedId": "<first ID>"}` |
| WhatsApp still takes priority when given | Register "Test Seven" with a WhatsApp number, then register a *different* name with that same WhatsApp number | No match — name must also match, WhatsApp alone isn't enough (unchanged from V3.4.1) |

**Frontend, manual:**
1. Log in, press back once → banner reads "Press back again to log out," still on the journal. Press back again immediately → now logged out, on a login screen.
2. Log in via a personal URL, then manually edit the ID in the address bar to a *different* valid student's ID and press enter → does NOT keep showing the first student's journal; drops to a login/create-PIN screen for the new ID instead.
3. Self-register with a name matching an existing student but leave WhatsApp blank → match prompt still appears (this is the gap being closed). Edit the name slightly so it's no longer a match, then press Continue → registers normally, no duplicate warning, no auto-numbering.
4. From the admin panel, trigger a duplicate match, then edit the WhatsApp number in the form before pressing Continue → if the edited value no longer matches, creates a plain new student, not a numbered duplicate.
5. Trigger the "also deactivate?" prompt (admin Continue) and the Reset PIN confirm → both read "CANCEL: Both journals remain active ; OK: mark existing journal INACTIVE" / similar, not a bare generic question.
6. WhatsApp fields (admin registration form, admin user-detail card) show no "optional" text anywhere, and both still submit fine when left blank.
7. Resize a login/register/admin screen across breakpoints → mobile fills the width, ~600-899px shows 50% width centered, ≥900px shows 25% width centered, on both `.login-card` screens and the admin screen.
8. General text throughout the app (labels, error messages, button text) reads noticeably larger than before — compare against a pre-V3.4.2 screenshot if unsure.
9. On the fallback login screen, "New Registration" sits at the bottom of the card now, below the "Forgot your pin or ID?" text.
10. Visit a personal URL for an account with no PIN set yet → the create-PIN screen shows the full "This is your personal URL..." message and a copyable URL, and the "Confirm PIN" row is invisible until all 4 "New PIN" digits are entered.
11. **On an actual iOS Safari device** (not just a desktop browser — this can't be verified there): the top of the journal/auth band is no longer obscured by the notch/status bar. Re-check Android too, to confirm it's still fine (it already was).

## 13. Duplicate-flow correctness, inactive search, deactivate-resets-PIN (V3.4.3)

| Test | Request | Expect |
|---|---|---|
| Inactive student now matches | Deactivate an existing student via `/admin/update-user` `{"id":"...","active":false}`, then register (self or admin) with that same name+WhatsApp, no force | `200 {"matched": true, ...}`, with `matchedActive: false` |
| Deactivating resets the PIN | Log in once as a student (sets a PIN), then `POST /admin/update-user` `{"id":"...","active":false}`, then check via `/auth/lookup?id=...` | `hasPin: false` — confirms pin_hash was cleared automatically |
| Admin match response includes status | Trigger a match against an active student via `/admin/register-student` | Response includes `matchedId` AND `matchedActive: true` |
| Force-create response includes match info | `POST /admin/register-student` with `force:true` against a name+WhatsApp that still collides | Created response includes `matchedId`/`matchedActive` for the collision, even though force was set |
| Self-registration force-create, no longer matches | Trigger a self-registration match, then force-create with a DIFFERENT WhatsApp number | `200`, plain new record — response has `matched: false`, no auto-numbered name |

**Frontend, manual:**
1. Trigger an admin duplicate match, then edit the WhatsApp field to a clearly different number, then press Continue → registers normally, **no** "mark existing journal inactive?" prompt appears (this was the reported V3.4.2 bug).
2. Deactivate a student, then self-register or admin-register with that same name+WhatsApp → the match prompt appears and explicitly says the existing journal is inactive; self-registration's Continue offers a reactivation-request email instead of a deactivate question.
3. Admin's match hint text reads "Student: [name], WhatsApp number: [number] has the same details and is currently active/inactive..." with the actual values filled in, not a generic message.
4. Resize a login/register/admin screen through 1024–1300px (simulating an iPad landscape) → now lands in the 50% tablet bucket, not the 25% desktop one.
5. Admin registration box: "Student's name" and "WhatsApp" fields stack vertically and fill the box width at every screen size, never sitting inline/misaligned.
6. The duplicate-match hint and the registration-confirmation message ("This is your personal URL...") both read visibly larger than before — same size as labels/buttons.
7. Journal table: weekday abbreviation under the date is a little larger; "+ add" text unchanged.
8. **On an actual iPhone Safari** (not simulable elsewhere): the journal content shows immediately on load, no longer requiring a scroll to appear — the fix changed twice after this was first tested (see CHANGELOG "Correction"/"Second correction" notes under V3.4.3), so this needs re-confirming fresh, not just re-reading.
8b. Scroll down the journal table on any device — the Date/Sabaq/Sabaq Dhor/Dhor/Feedback column headers stick to the top of the screen, positioned right below the auth band, and no longer overlap the first data row.
8c. The "Journal" heading is gone; the header row and the table below it extend to the edges of the screen (only a small ~4px margin), and the header/table columns stay visually aligned with each other.
9. Auth dropdown menu: "Log out" (not "Sign out") appears after "Refresh," and only its icon (not its text) is red.
10. The Hifzhelper logo appears above the existing content on the fallback, personalized login, registration, and create-PIN screens — check on a narrow phone width that it shrinks to fit rather than overflowing.

## 14. PWA Level 1 — installability (V3.5)

No backend requests involved — this is a manifest/HTML/asset-only change,
so every check here needs an actual browser (DevTools can confirm the
manifest is well-formed, but not real install/home-screen behavior).

1. Chrome DevTools → Application → Manifest → no red validation errors; all
   three icons (192, 512, and the maskable 512) load, none show a 404.
2. Desktop Chrome or Android Chrome → address bar install icon / ⋮ menu →
   an Install option is offered; the installed app icon shows the Sage-green
   logo, not a broken/missing icon.
3. After installing on Android → check the home-screen/launcher icon under
   the device's adaptive-icon mask shape (circle or squircle depending on
   device) → the logo mark isn't clipped or cut off.
4. iOS Safari → Share sheet → "Add to Home Screen" → the resulting icon
   matches `appicons/apple-touch-icon.png`, not a screenshot of the page.
5. Launch from that iOS home-screen icon → opens standalone (no Safari
   address bar/toolbar); the status bar is translucent, with the app's
   content visible underneath it rather than a solid color bar.
6. Any browser tab → shows the actual favicon, not a blank/generic page
   icon.
7. DevTools → Application → Service Workers → confirm this is still empty —
   `sw.js` is intentionally NOT registered as part of this delivery
   (Level 2, separate future work).

## 15. Real cache-busting (V3.6)

Needs an actual deployed Cloudflare Pages preview/production URL —
`_headers` has no effect at all when `index.html` is just opened as a
local file, and DevTools' "Disable cache" checkbox will mask the very
thing this is supposed to fix (it bypasses the browser cache entirely,
so re-test with that checkbox OFF).

1. DevTools → Network tab (cache enabled, not disabled) → load the site →
   click on `css/tokens.css` (or any CSS/JS request) → Response Headers
   shows `Cache-Control: public, max-age=31536000, immutable`.
2. Same check on the page request itself (`index.html`, or `/`) →
   `Cache-Control: no-cache, must-revalidate` — NOT a long max-age.
3. Change one character in any CSS file, bump `?v=` in `index.html` (and
   `sw.js`'s `ASSETS` list) to a new value, deploy → reload the page →
   confirm the new CSS actually applies immediately, not after a hard
   refresh.
4. Without bumping `?v=` at all, reload the page a few times → confirm
   `css/*`/`js/*` requests show "(disk cache)" or a `304`/no new download
   in the Network tab — i.e. confirm the long cache is actually being
   honored, not accidentally bypassed.
5. Re-check the original medium/large-screen rendering report from before
   this delivery, on a fresh load with cache enabled — if it was in fact a
   stale-CSS issue, this should resolve it; if it still reproduces after a
   confirmed-fresh load, the cause is something else and needs the
   Elements/Computed-styles screenshot requested earlier.

## 16. Unified day-log view (V3.6.1)

1. From the journal, tap the "Sabaq" column header → lands on the new
   combined screen with the Sabaq card in view (mobile/tablet) or visible
   in the grid (desktop). Tap "Sabaq Dhor" from the journal instead →
   same screen, but starts on/scrolled to the Sabaq Dhor card. Same for
   "Dhor".
2. **Desktop width (≥1180px)**: all 4 cards (Sabaq, Sabaq Dhor, Dhor,
   Tadabbur) visible at once in a single row, no horizontal scrolling, no
   dot indicators shown.
3. **Tablet width (768–1179px)**: swiping the rail shows 2 cards at a
   time; dots are visible and the correct one highlights as you swipe.
4. **Mobile width (<768px)**: swiping shows 1 card at a time; dots
   visible and tracking correctly. Tapping a dot smooth-scrolls to that
   card.
5. Each card's content (fields + Recent history) scrolls independently
   within that card if it overflows — the card itself doesn't grow the
   whole page.
6. **Independent date selectors**: on the Sabaq card, change the date to
   3 days ago and save an entry with distinctive content → confirm via
   the Recent rail (or D1) it saved under that date, NOT today. Confirm
   the Sabaq Dhor and Dhor cards' date fields are unaffected and still
   show today.
7. **Tajweed picker, all 3 cards open together** (this is the specific
   condition that was previously broken): tap "+ add" on the Sabaq Dhor
   card's tajweed picker and add a custom tag → confirm the new tag
   appears on the SABAQ DHOR card, not silently on the Sabaq card. Repeat
   for the Dhor card.
8. **Comment block, all 3 cards open together**: type different text into
   the Sabaq card's comment box and the Dhor card's comment box → save
   each → confirm (via D1 or the Recent rail) each saved its OWN comment
   text, not one overwriting the other or both ending up with the same
   value.
9. **Tadabbur card**: write a reflection and save → reload the page,
   return to this screen → confirm the same reflection loads back
   (prefilled), and saving again updates it in place rather than creating
   a second row (check via D1: still only one `reflections` row for
   today).
10. Dhor card's timer still works normally (start/lap/stop) — this card
    is the only one of the 4 with a timer, so it wasn't touched by the
    container-scoping fix, but worth confirming nothing regressed.

## 17. Cache policy reversed — nothing cached (V3.6.2)

Needs an actual deployed Cloudflare Pages URL, same as §15.

1. DevTools → Network tab (cache enabled, not disabled — same caveat as
   §15) → load the site → click on `css/tokens.css` or any `js/*` request
   → Response Headers shows `Cache-Control: no-store`, not a long
   `max-age`.
2. Reload the page a few times → confirm `css/*`/`js/*` requests show as
   fresh network fetches every time (not "(disk cache)"/"(memory
   cache)"/304) — this is the opposite check from §15's step 4, since the
   policy itself reversed.
3. This is also the fix for the earlier stuck-cache bug: reload the site
   now and confirm the unified day-log view (V3.6.1) actually loads —
   `screen-logDetail`, not the "not built yet" placeholder — and that
   `js/reflectionCard.js`/`js/logDetailScreen.js` both return 200, not
   404, in the Network tab.
4. If any of the above still shows old behavior, the browser used for
   testing likely still holds the OLD stuck cache entry from before this
   fix — that's expected for `no-store` going forward but doesn't undo an
   entry that was already cached under the old `?v=3.6.1` URL; a one-time
   hard refresh clears it, and it shouldn't be needed again after that.

## 18. Setup screen — profile section (V3.7.0)

Needs the migration (0009) actually applied to D1 first, or the new fields
will 400/fail to save.

1. A brand-new student (fresh registration, first PIN creation, never
   completed setup before) → logs in → lands on the Setup screen
   automatically, NOT the journal.
2. Name/Unique ID/URL at the top are correct and NOT editable (no input
   box — plain text/read-only). Copy button next to the URL actually
   copies it (same behavior as the create-PIN/registered screens' copy
   buttons).
3. Enter a journal name, pick a gender, pick "13 line" → Save → reload the
   page → Setup screen (via Settings nav) shows the same 3 values still
   set correctly.
4. Try "15 line Madani" instead → saves correctly, only one mushaf option
   shows as selected/active at a time.
5. The "Hybrid" button is visibly greyed out and does nothing when
   clicked — confirm via Network tab that no request fires and via D1
   that `mushaf` never becomes `'hybrid'`.
6. After Save (with `setup_complete` now true), log out and log back in →
   lands on the journal this time, NOT Setup — confirms the one-time
   redirect only applies before setup is completed.
7. From the journal, open the dropdown/Home tile menu → "Settings" → the
   same Setup screen loads (not a placeholder), with whatever was
   previously saved shown correctly.
8. Confirm history capture, default targets, Dhor planning, and haidh
   tracking are genuinely absent from this screen — this delivery is
   scoped to profile only, on purpose.

## 19. Setup screen sizing fix + save icon (V3.7.1)

1. Desktop width (≥1180px): the Setup screen no longer stretches near
   full-width — it's capped and centered, same visual treatment as the
   login screen / admin screen, at the new 30% (up from 25%).
2. Tablet width (768–1179px): Setup is capped at 50%, centered — same as
   before, unaffected by this change (confirm it didn't regress).
3. Mobile width (<768px): Setup still fills the available width — no cap
   at this size, matching every other single-container screen.
4. The Save action is now an icon (floppy disk), on the right of the
   "Setup" header, NOT a text button at the bottom of the form.
5. Clicking the save icon still actually saves (journal name/gender/
   mushaf persist correctly) — this moved position and appearance only,
   the underlying save logic is unchanged.
6. The "saved ✓" confirmation still appears/fades correctly next to the
   icon after a successful save.

## 20. Top-paint fix generalized + Hifz Setup (V3.8.0)

Needs migration 0010 applied to D1 first, or the new Hifz Setup fields
will 400/fail to save.

1. Load Setup (Settings nav, or first login) on Safari specifically —
   confirm the content is visible immediately, no scroll needed, on BOTH
   cards (not just whichever one happens to render first).
2. Load a screen that previously had this bug fixed (journal) — confirm
   it's still fine; this was a generalization, not a rewrite of that
   screen's own behavior.
3. Load the "not built yet" placeholder (any unbuilt nav item) — confirm
   its content is visible immediately too, same fix now applies there.
4. Desktop (≥1180px): Profile and Hifz Setup show side by side as a 2-
   column grid, both with a Sky background, no dots visible.
5. Tablet/mobile: swiping moves between the two cards; dots track
   correctly; tapping a dot scrolls to that card.
6. Profile card: edit journal name/gender, tap ITS save icon → saves
   correctly; confirm Hifz Setup's fields are untouched by this save
   (independent saves, not one shared action).
7. Hifz Setup: pick "Surahs" → grid of 114 surah names appears (slides
   in); select several → tap ITS save icon → reload → same surahs still
   selected. Switch to "Juz'" → confirm the previous Surah selections are
   gone (mode switch discards the other mode's selection) → select a few
   juz' → save → reload → correct juz' still selected, mode is "juz".
8. Default targets: change the 3 values away from 2/40/30 → save → reload
   → confirmed values persisted (not reset to the defaults).
9. Complete only ONE of the two cards (e.g. just Profile) → log out → log
   back in → confirm you're NOT routed back to Setup (either card alone
   is enough to mark setup_complete).

## 21. Home-screen PIN-only return login (V3.8.1)

Use a real installed PWA on both iOS and Android if available; browser
DevTools can verify storage/routing but not every home-screen launch detail.

1. Clear site data, open `/`, and log in with ID + PIN → login succeeds,
   the URL becomes `/<that ID>`, `localStorage.hh_login_id` contains only
   that ID, and the PIN is absent from all browser storage.
2. Fully close the installed app, then reopen it from the home-screen icon →
   the personalized greeting and PIN-only boxes appear; no ID field appears.
3. Repeat step 2 with an existing install whose icon still launches
   `/index.html` → same PIN-only result (no reinstall should be required).
4. Tap Log out → the personalized PIN-only screen returns for the same
   account; the remembered ID remains, while `sessionStorage.hh_token` is
   gone.
5. Tap **Use another ID** → the app returns to `/`, the remembered ID is
   removed, and the generic ID+PIN screen appears.
6. With account A remembered, open account B's valid personal URL → B's
   personalized PIN screen appears, but A remains remembered until B enters
   the correct PIN. A wrong PIN for B must not replace A.
7. Successfully log in as B → B becomes the remembered ID. Close and reopen
   from the home screen → B's PIN-only screen appears.
8. With a valid token for A, navigate directly to B's personal URL → A's
   journal must never appear; the existing cross-account guard clears the
   token and shows B's login screen.
9. Remove/disable the remembered account in D1, then launch at `/` → the
   generic fallback remains usable, with the remembered ID pre-filled rather
   than a blank or broken screen.
10. Upgrade/refresh from V3.8.0 while an authenticated session is still open
    and no `hh_login_id` exists → the verified profile ID is remembered, so
    the next full close/reopen uses PIN-only login.

## 22. iPhone Home Screen keeps the personal URL (V3.8.2)

This specifically requires a real iPhone/iPad Add to Home Screen test. An old
icon keeps the launch target captured when it was installed, so it must not be
reused for steps 3–6.

1. Deploy V3.8.2, then delete the existing Hifzhelper Home Screen icon from
   the iPhone. This removes only the shortcut/web-app instance, not server
   data in D1.
2. In Safari, open the student's exact personal URL (`https://HOST/<ID>`) and
   confirm the personalized greeting/PIN-only screen appears before installing.
3. From that personal page, use Share → **Add to Home Screen**. Do not install
   from `/`, `/index.html`, or the generic ID+PIN screen.
4. Before signing in inside the new standalone app, launch its Home Screen
   icon → it opens the same `/<ID>` route and immediately shows the student's
   personalized PIN-only screen, with no Unique ID field.
5. Enter the PIN, fully close the app, and reopen it → it still returns to the
   same student's PIN-only screen.
6. Tap Log out → the same PIN-only screen returns; tap **Use another ID** →
   the app deliberately moves to the generic root sign-in.
7. iPhone/iPad Safari Web Inspector: on the personal page, confirm there is
   no `link[rel="manifest"]`; the Apple standalone meta tags and
   `apple-touch-icon` remain present.
8. iPadOS with desktop-style user agent: repeat steps 2–4 to verify the
   `MacIntel` + touch-point detection also preserves the personal URL.
9. Android/desktop Chrome: confirm `link[rel="manifest"]` is added to the DOM,
   `manifest.json` loads successfully, and the app remains installable there.
10. Negative control: if the app is intentionally added from the bare `/`
    fallback page, it cannot know a student yet and showing ID+PIN is correct.

## 23. Setup redesign: Dhor Schedule, Haidh, plan pre-fill (V3.9.0)

**Setup screen shape**
1. Open Settings → confirm ONE continuously scrollable page, no swipeable
   card rail or dots — Profile, Hifz Setup, Dhor Schedule, Haidh (Haidh
   only if gender is currently F) stacked in that order, each with its own
   save icon + status.
2. Change only Profile's journal name → tap Profile's save → reload →
   confirm the journal name persisted AND nothing in Hifz Setup/Dhor
   Schedule/Haidh was touched (each section's save is genuinely
   independent, not a page-wide save).
3. Gender: tap Male, then Female → confirm the Haidh section appears the
   moment Female is tapped, before saving anything — then disappears again
   if you tap back to Male. Save with Female selected → reload → Female
   still selected, Haidh section still shown.

**Juz'/Surah slide-in grids**
4. Tap "Juz'" → a full overlay opens with 30 cells and a close icon; tap a
   few, tap close → overlay closes, a summary line under the buttons now
   reads "N juz' marked complete." Tap "Surah" → opens empty (not the
   Juz' selection) with 114 cells, vertically scrollable.
5. Select a few surahs, close, then tap Hifz Setup's own Save button →
   reload → confirm the surah selection (not the earlier juz' one)
   persisted — closing the grid only staged it; the section Save is what
   actually persisted it.
6. Re-open "Juz'" after step 5 → confirm it opens EMPTY (mode is now
   'surah', so the other mode's old selection is gone, same exclusive rule
   as before this screen's redesign).

**Dhor Schedule — save and generation**
7. Set portion = Quarter, quantity = 1, frequency = Daily, days = every
   day → Save. Confirm the save succeeds even with no Hifz Setup baseline
   saved yet, but check the Dhor page (next section) shows no plan — the
   generator should report nothing generated rather than erroring.
8. On a test student with Hifz Setup's baseline saved as Juz' mode with a
   *contiguous* small pool (e.g. juz' 28-30) and mushaf set: save Dhor
   Schedule (Quarter, 1, Daily, every day) → open the Dhor log page →
   confirm `plans` now has rows for the next several active days,
   segment ranges staying within the expected juz'.
9. Gap case — set the baseline pool to something non-contiguous, e.g.
   {1, 29, 30} (not 2-28) → save Dhor Schedule → confirm no generated
   segment range ever spans outside one of {1, 29, 30} — a session at the
   end of juz' 1 must NOT bleed into juz' 2's markers just because 29
   comes next in the pool.
10. Log (or hand-insert) a `dhor_log` row further along in the rotation
    than the last generated plan → save Dhor Schedule again (or reopen the
    Dhor page) → confirm the NEXT generated plan continues from the logged
    position, not from the older, now-stale plan position.
11. Haidh-day case: mark a date within the rolling window as `haidh` or
    `predicted-haidh` in `attendance` → regenerate → confirm no dhor plan
    lands on that date, and that the window extends outward by one active
    day to make up for it rather than the student ending up with fewer
    total planned sessions.
12. Frequency = Twice a day → confirm active days get 2 plan rows, not 1;
    re-run generation without changing anything → confirm it does NOT
    create a 3rd/4th row for a day that already has 2 (idempotent).

**Dhor log page and journal quick-add**
13. With exactly one Dhor plan for today: open the Dhor log page → confirm
    juz'/position/unit are pre-filled from it and a "Pre-filled from
    today's plan" hint shows. Save → confirm the plan's status becomes
    `completed` with `completed_log_id` set (existing linking, unchanged).
14. Create a second Dhor plan for today by hand → reopen the Dhor page →
    confirm a plain selector appears instead of either being auto-picked;
    picking one pre-fills from it, picking neither leaves the manual picker
    as today's baseline behaviour.
15. Journal table: tap a greyed "planned" Dhor cell → confirm the quick-add
    form now opens with segment/reference already filled in (not blank).
    Same check for a planned Sabaq cell (surah/ayah pre-filled). A planned
    Sabaq Dhor cell should still open blank (zone has no clean source to
    pre-fill from yet) — confirm this is a plain empty form, not an error.

**Haidh**
16. Set cycle length, duration, and next expected day → Save → confirm
    `attendance` gains `predicted-haidh` rows and an existing real entry on
    any of those dates was NOT overwritten. Reload Setup → confirm the 3
    values redisplay (not reset to blank).

**Nav**
17. Confirm "Plans" no longer appears anywhere — Home tile grid, dropdown,
    or otherwise. The only way to reach Dhor Schedule/Haidh is via
    Settings.

## 24. Hybrid mushaf + Setup/Dhor Schedule switch redesign (V3.10.0)

1. Setup → Mushaf: confirm "Hybrid" is now tappable (no longer greyed
   out). Tap it → confirm the hint line below reads "15 line pages with
   13 line quarter markings." and no hint shows for the other two.
2. Set mushaf to Hybrid, save. Open the Dhor log page → log a segment →
   confirm the saved entry's `ref` is `waterval` (check via the recent-
   entries rail or the DB directly) — Hybrid must use 13-line quarter/
   half/juz' rules, never uthmani.
3. Set mushaf to 15-line Madani, save → log a Dhor entry → confirm `ref`
   is `uthmani` this time. Set back to 13-line → confirm `ref` is
   `waterval`. Three mushaf values, three consistent results.
4. Dhor log page: confirm there's no reference dropdown anywhere on it
   any more — the picker (Juz'/position) should still work, just without
   a manual ref choice.
5. Dhor Schedule: change mushaf in Setup, save, then check a freshly
   generated plan's `ref` matches the new mushaf's expected value
   (`worker/src/dhorSchedule.js` derives it the same way).

**Switches — all of Setup + Dhor Schedule:**
6. Gender: tap Male, then Female → confirm the thumb slides fully to
   whichever is tapped, active side's text goes white, and the Haidh
   section still appears/disappears live exactly as before.
7. Mushaf: tap each of the 3 options → thumb should occupy exactly one
   third each time, sliding smoothly, no overlap or gap.
8. "Mark completed sections": before marking anything, confirm the thumb
   rests in the visible middle, muted grey — not slid to either side.
   Tap "Juz'" → grid opens regardless of thumb position; mark a few,
   close → thumb slides to the LEFT third. Tap "Surah" → opens empty
   (different mode) → mark some, close → thumb slides RIGHT. Reopen
   "Juz'" → confirm it's empty again (mode switched, old selection
   cleared, same rule as before this redesign).
9. Surah grid: confirm 3 columns now (was 2) and still scrolls correctly
   with all 114 entries reachable.
10. Dhor Schedule: confirm the quantity number box is now to the LEFT of
    the Juz'/Half/Quarter switch (was reversed before). Tap through all
    3 granularity options and both frequency options, confirming the
    thumb behaves the same way as the mushaf switch.
11. Days of week: confirm all 7 buttons stay on one line at a typical
    phone width — no wrapping to a second row.
12. Default targets and Haidh: confirm all 6 fields (3 targets + 3 haidh)
    are now single rows, label left, input right, and that saving each
    section still works and redisplays correctly on reload.

## 25. Setup V2: text/layout refinements, neutral-center fix, Tomorrow's Portion (V3.11.0)

1. Confirm gender now shows as a small M/F switch right on the Name row,
   not its own row further down.
2. Mushaf: tap 13-line → confirm hint reads "13-line IndoPak/Waterval.";
   tap 15-line Madani → "15 Line Uthmani script."; tap Hybrid → the
   existing hint, unchanged.
3. Confirm the label above the Juz'/Surah switch now reads "Mark
   completed sections using".
4. Mark a few Juz' as complete, close the popup → confirm the switch's
   thumb is back in the neutral middle, NOT slid to the Juz' side (this
   is the corrected behaviour — check it actually differs from what
   V3.10.0 shipped). Same check for Surah.
5. Confirm "Default targets" now reads "Target for Dhor" and visually
   stands out (darker/heavier) compared to a normal field label like
   "Mistakes / juz'" right below it.
6. Confirm the Dhor Schedule section heading now reads "Dhor Plan".
7. Tap into any numeric field (targets, portion quantity, haidh cycle
   length/duration) on an actual phone → confirm a plain number pad
   appears, not the full keyboard.

**Tomorrow's Portion:**
8. With a baseline saved (e.g. juz' 1-3) and granularity set to Quarter:
   confirm the "Tomorrow's portion" dropdown lists `Q-Juz-1-1` through
   `Q-Juz-3-4` in order, plus the default "let the plan continue..."
   option at the top.
9. Switch granularity to Half → confirm the list re-populates with
   `H-Juz-N-1`/`H-Juz-N-2` labels instead (13-line/Hybrid) — or
   `Hizb-N` labels, globally numbered, if mushaf is 15-line Madani.
10. Switch mushaf between 13-line/15-line/Hybrid → confirm the list
    relabels correctly each time (Hybrid should label like 13-line).
11. Pick a specific portion (not the default), save → confirm (via the
    plans table or the Dhor log page for tomorrow's date) that the
    FIRST generated session starts at exactly that segment.
12. Leave the dropdown on the default option and save → confirm
    generation behaves exactly as before V3.11.0 (auto-detects from the
    last logged/planned entry, unaffected by this feature existing).
13. Open the Dhor log page a second time after an explicit-portion save
    → confirm it does NOT reset back to that same starting point again —
    the override should only apply to that one save's generation call.

## 26. Position tracking + Sabaq rewrite + detail-screen layout (V3.12.0)

**Position + Sabaq:**
1. As a brand-new student (no position saved yet), open the Sabaq card →
   confirm Surah is preset to An-Nas (114) and Ayah from to 1.
2. Enter Ayah to = 6 (finishes An-Nas), save → reopen the Sabaq card →
   confirm it now defaults to Surah 113 (Al-Falaq), Ayah from 1.
3. Confirm the Recent rail shows entries as `114:1-114:6` with lines/
   pages, not a surah name.
4. Enter Ayah to, tab/click away from the field (triggering change) →
   confirm Lines and Pages fields auto-populate. Manually edit one of
   them before saving → confirm the edited value is what actually saves
   (check via the recent rail or a DB query), not the auto-computed one.
5. Working scenario: log entries that walk all the way through surah 78
   (the last surah of juz' 30) to its final ayah → save → confirm Hifz
   Setup's "Mark completed sections" now shows juz' 30 as marked, without
   having opened the Juz' grid manually. Reopen Sabaq → confirm it now
   defaults to 67:1 (start of juz' 29).
6. Switch mushaf between 13-line/15-line/Hybrid in Setup → re-open Sabaq
   → confirm line/page auto-calc uses the right function for each (13-
   line approximate vs 15-line exact) without changing the surah:ayah
   defaults, which stay ref-aware but conceptually the same either way.

**All 4 cards — layout:**
7. Confirm every card's header row shows: icon (non-clickable), title,
   date field (Tadabbur excepted — no date), save status, and an
   icon+label Save button — and that there's no Save button at the
   bottom of any card any more.
8. On a desktop-width screen, confirm all 4 cards are visible in one row
   and none exceeds roughly 30% of the available width.
9. Tap the Tajweed control on any card → confirm a popup opens with a
   checkbox per tag (not a row of pill buttons); check a few, close →
   confirm the trigger button now summarizes what's selected, and that
   selecting multiple tags still works (this wasn't a single-select
   change).
10. Confirm the comment block reads "Notes", not "Your comment on this
    session", and that the privacy control is a Public/Private switch
    defaulting to Public, with no "keep hidden from teachers" text
    visible anywhere. Same check on Tadabbur's own privacy control.
11. Confirm the swipe dots (tablet/mobile widths) show the words Sabaq/
    SDhor/Dhor/Tadabbur, sit above the card rail, and still correctly
    highlight/scroll to the right card when tapped.

## 27. Sabaq Dhor's checkable-quarters redesign (V3.13.0)

1. With a fresh position (nothing sabaq'd in the current juz' yet), open
   Sabaq Dhor → confirm it shows "Nothing to revise yet" rather than an
   empty or broken checklist.
2. Log a Sabaq entry, then open Sabaq Dhor → confirm exactly one section
   appears, checked, spanning from the start of the current quarter to
   the just-logged Sabaq's end point.
3. Log several more Sabaq entries until at least one full quarter is
   behind the current one → confirm Sabaq Dhor now shows 2 sections: the
   completed quarter (full range) and the current one (partial), both
   checked by default.
4. Uncheck one section, save → confirm the saved entry's from/to range
   reflects only the sections left checked (check via the recent rail or
   a DB query on `sabaq_dhor_log`).
5. **Juz' 30 specifically**: as a fresh student (starts at 114:1 per
   V3.12.0), log Sabaq down through several quarters → open Sabaq Dhor at
   each stage and confirm the sections shown make sense in the *actual*
   backwards study order — e.g. once Sabaq has passed surah 98's start,
   confirm Sabaq Dhor shows a completed section for roughly 98:1-114:6,
   not a section built from the juz's structurally-first surahs (78-82),
   which would be backwards.
6. Switch mushaf between 13-line/15-line/Hybrid → confirm the sections
   still compute correctly for each (the quarter boundaries differ
   slightly between prints at a few points, per the V3.9.1 derivation).

## 28. Sabaq rebuild: sabaq_from/sabaq_to, multi-surah spans (V3.14.0)

1. As a brand-new student, open Sabaq → confirm From shows blank/— and To
   shows 114:6 is NOT preset the same way as before — confirm instead
   both fields show 114:1 and 114:6 respectively per the new rule.
2. Tap the chevron on either field → confirm the full 114-surah picker
   opens, and selecting one updates that field's surah (ayah resets to 1).
3. Try entering an ayah number beyond a surah's actual count (e.g. 114
   ayah 7 — An-Nas only has 6) → confirm it's bounded, not accepted as-is.
4. Enter a From/To spanning two different surahs within the same juz' →
   save → confirm it saves successfully and the recent rail shows both
   surahs correctly (e.g. "90:5-89:1" style, not just one surah number).
5. Enter a From/To that would cross TWO juz' boundaries at once → confirm
   this is rejected with a clear message, not silently saved wrong.
6. Log a sabaq entry that ends inside juz' 30 → reopen Sabaq → confirm To
   prepopulates with that entry's end point, From stays blank. Then log
   an entry that crosses into juz' 29 → reopen → confirm From prepopulates
   instead this time, To stays blank.
7. Log any Dhor entry at all → reopen Sabaq → confirm NEITHER field
   prepopulates any more, regardless of Sabaq history.
8. Confirm Lines/Pages auto-populate once both fields are set, and that
   a multi-surah span's totals look like a plausible sum across the
   surahs involved, not just the first or last one.
9. Confirm the old `sabaq_log` columns (`surah`, `ayah_from`, `ayah_to`)
   are actually gone from the live table after the migration runs (a
   `PRAGMA table_info(sabaq_log);` check, same pattern as prior migration
   verifications), not just unused.
10. Open Sabaq Dhor (unchanged in this delivery) → confirm it still shows
    sensible sections as before — this delivery shouldn't have broken it,
    since `computeSabaqDhorSections` was deliberately left working
    against the same position shape.

## 29. Dhor eligibility pool rework: quarter-unit granularity (V3.15.0)

1. Mark juz' 1 and 2 complete via Setup's Juz' grid, save → check via a
   direct DB query that `baseline_selection` now contains 8 numbers
   (1-8), not `[1,2]`.
2. Reopen the Juz' grid → confirm juz' 1 and 2 still show as checked
   (not everything, not nothing — the round-trip through quarter-units
   needs to come back correctly).
3. With juz' 1-2 marked and a Dhor Schedule configured, save/open the
   Dhor Schedule → confirm it still generates sensible sessions matching
   the chosen granularity (quarter/half/full), same as before this
   rework — this is a rebuild of internals, output should look unchanged
   for a fully-marked pool like this.
4. Confirm "Tomorrow's Portion" (Setup's Dhor Schedule section) still
   lists options correctly for juz' 1-2.
5. Directly test a partial-juz' scenario (can only be set via a DB edit
   for now, since the UI to create one — Sabaq Dhor's move-to-Dhor —
   isn't built yet): set `baseline_selection` to include only juz' 5's
   first-half quarter-units (17,18) alongside a fully-marked juz' 1
   (1,2,3,4) → confirm Dhor Schedule generation produces sensible
   sessions from juz' 1's full range and juz' 5's first half only,
   without ever drawing from juz' 5's second half.

## 30. UI notes round 2 + Phase 2a: Sabaq Dhor rollup (V3.16.0)

1. Confirm every card's header is 2 rows: icon+heading+Save on row 1
   (Save has both an icon and visible "Save" text), date alone on row 2
   at roughly 30% width (Tadabbur has no date row, unchanged).
2. Confirm the privacy control on all 4 cards (Notes' checkbox, and
   Tadabbur's own) is a plain checkbox, not the switch — default
   unchecked, checking it should mark the entry private on save.
3. Confirm "Recent" now shows a "History" button plus the last 2 entries
   stacked below it. Tap History → confirm a popup opens listing more
   entries (up to 50), not just the same 2.
4. On Sabaq, enter a range you know the line count for (e.g. something
   you've already checked totals 20 lines) → confirm Pages shows 1.5,
   not a real-page-derived number.
5. Log Sabaq entries into a fresh juz' until at least one quarter is
   complete and the current one is partial → open Sabaq Dhor → confirm
   the completed quarter shows as its own row (chevron hasn't merged
   anything yet by default).
6. Complete a second, adjacent quarter (so both members of a pair, e.g.
   1 and 2, are done) → tap the up chevron → confirm those two merge
   into one "First Half" row, while the current (still in-progress)
   quarter is untouched.
7. Tap the down chevron → confirm it splits back to separate quarters.
8. Close and reopen Sabaq Dhor → confirm the rollup level you left it on
   (quarters vs halves vs full) is remembered, not reset.
9. Check a couple of rows, save → confirm the saved entry's from/to
   range spans exactly the checked rows (via the recent rail or a DB
   query on sabaq_dhor_log), same composite behaviour as before.
10. With only the current quarter available (freshly started juz', or a
    juz' with nothing complete yet), confirm the chevrons don't error or
    produce a broken row — should just redraw the same single row.

## 31. Phase 2b: the move-to-Dhor transition (V3.17.0)

1. Get a student to the point where a full juz' is complete and Sabaq
   has crossed into the next one (per Phase 2a's testing) → open Sabaq
   Dhor → confirm the completed old juz' now shows as a lingering row
   (First Half + Second Half, or one Full Juz' row if rollup is set to
   "full") with a "Move to Dhor" button next to it.
2. Tap "Move to Dhor" on First Half → confirm it disappears from Sabaq
   Dhor, and check via `PRAGMA`/a DB query that `baseline_selection` now
   includes that half's 2 quarter-units.
3. Confirm Second Half's "Move to Dhor" button is now enabled (it
   shouldn't have been available before First Half moved, per the
   sequential rule) — move it too, confirm the lingering juz' disappears
   from Sabaq Dhor entirely once both halves are gone.
4. Separately (fresh scenario): leave a lingering juz' untouched (don't
   tap any Move to Dhor button) → continue logging Sabaq into the new
   juz' until at least one quarter of it completes → open Sabaq Dhor (or
   just check `baseline_selection` directly) → confirm the OLD juz' was
   moved to Dhor automatically, and that it's no longer showing as
   lingering.
5. Confirm a lone (unrolled) quarter never shows a "Move to Dhor" button
   — only halves and full-juz' rows should have one.
6. Confirm Setup's Dhor Schedule still generates sensible sessions after
   a move-to-Dhor (manual or automatic) — the newly-added quarter-units
   should show up in generation the next time it runs.

## 32. Detail-screen UI round 3 (V3.18.0)

1. Open any of the 3 log cards (Sabaq/Sabaq Dhor/Dhor) → confirm the
   header is now 2 rows: row 1 has the icon, heading, and Save
   button/status roughly at a 10:70:20 split; row 2 is just the date
   input at roughly 30% width with blank space beside it.
2. Confirm the "Notes" label and the "Private" checkbox+label now sit
   on the same row, checkbox on the same line as the label — not below
   the textarea.
3. Confirm the "Recent" heading text is gone entirely, and there's no
   list of the last 2 entries — just a single compact button.
4. Confirm that button is dark green (Evergreen) and reads "Sabaq
   History" / "Sabaq Dhor History" / "Dhor History" depending on the
   card (not generic "History"). Tap it → confirm the same full popup
   (up to 50 entries) still opens correctly.
5. On Sabaq, confirm the "Sabaq from"/"Sabaq to" fields now render as a
   4-column row (chevron, surah name, ayah number, chevron) with no
   overlapping/misaligned text regardless of how long the surah name is
   — try a few different surahs via the picker, including long names
   (e.g. Al-Baqarah) and short ones, to confirm the columns hold their
   width either way.
6. Tap the left chevron → confirm the surah picker still opens and
   selecting a surah still updates the field correctly (unchanged
   behaviour, just restyled).
7. Tap the new right-hand up/down chevrons → confirm they step the ayah
   number up/down by 1, respecting that surah's min/max ayah bounds
   (shouldn't go below 1 or above the surah's last ayah), and that Lines/
   Pages recompute afterward exactly as they do when typing a number in
   directly.
8. On a tablet-width or mobile-width screen, open the log-detail rail
   and swipe/scroll between the 4 cards → confirm the dot labels
   (Sabaq/SDhor/Dhor/Tadabbur) highlight the correct card as it comes
   into view, with no lag or wrong-dot-highlighted behaviour. This was
   the "erratic"/"misaligned" bug — re-test on both a phone-width and a
   tablet-width viewport, since the rail shows 1 vs. 2 cards at those
   sizes respectively.
9. Confirm the desktop static 4-column grid (≥1180px) is unaffected —
   no dots shown, all 4 cards visible without scrolling.

## 33. Detail-screen UI round 4 + prepopulation fix (V3.19.0)

1. As a student with existing Sabaq history (not juz' 30, not currently
   having any Dhor history logged), open the Sabaq card fresh → confirm
   "Sabaq from" prepopulates one ayah PAST where the last entry actually
   ended, not the same ayah repeated. Save an entry, reopen → confirm it
   advances again from the new position.
2. As a juz'-30 student in the same situation, confirm it's "Sabaq to"
   that prepopulates instead (juz' 30 is studied backwards), and that it
   also advances (backwards) rather than repeating.
3. As a student with any Dhor history logged at all, confirm NEITHER
   field prepopulates (unchanged rule).
4. As a student with no Sabaq history yet, confirm it still prepopulates
   114:1/114:6 (unchanged).
5. Advance a student until their current juz' is fully complete (nothing
   left to advance into) → confirm prepopulation goes blank rather than
   showing something for the wrong juz'.
6. On all 4 cards, confirm Save is now icon-on-top with a small caps
   label below, no border/background, normal (not bold) weight — tap it,
   confirm it still saves correctly and the "saved ✓" status still shows
   above it briefly.
7. On the log-detail screen, confirm there's a close (X) icon on the
   right of the swipe-dots row. Tap it → confirm it returns to Journal.
   Check this at both a mobile/tablet width (dots visible) and desktop
   width ≥1180px (dots hidden, static 4-card grid) — the close icon
   should be visible and working at both.
8. On Sabaq Dhor, confirm "Sections to revise" text is gone and "Mark
   sections revised" appears above the checkbox list instead. Confirm
   each row's checkbox is now on the right side of the row.
9. Open Sabaq Dhor fresh → confirm every checkbox starts UNCHECKED. Tap
   Save with nothing checked → confirm the existing "please check at
   least one section" error still shows. Check one or more, save →
   confirm it saves the correct composite range.
10. Confirm the rollup control is now a small 2-icon stepper to the left
    of the section list (not a row above it). With only the current
    quarter and nothing else complete, confirm BOTH icons are hidden
    (nothing to merge or split yet). Complete enough quarters to make a
    mergeable pair → confirm the merge icon appears; tap it, confirm the
    rows merge into a half AND the merge icon's visibility updates
    correctly for the new state (split icon should now show). Continue
    until a full juz' is possible → confirm the same pattern holds at
    that level too.
11. Confirm the rollup level still persists across a screen reload
    (position.sabaqDhorRollup), same as before this round.

## 34. Prepopulation frontier fix + UI polish (V3.20.0)

1. Recreate a bulk-entry scenario like ADMIN-01's: for a juz' 30 student,
   save a Sabaq entry with From set to a LOWER surah:ayah than To (e.g.
   From=88:1, To=114:6). Reopen Sabaq fresh → confirm "Sabaq to"
   prepopulates one ayah PAST 88:1 in the backward direction (i.e. still
   within/before surah 88), NOT anywhere near 114.
2. For a normal (non-bulk) juz' 30 entry where From is the higher
   surah:ayah and To is the lower one (the usual chronological order),
   confirm prepopulation still works exactly as before — this fix
   shouldn't change behavior for correctly-ordered entries.
3. For a non-juz'-30 student with both real Sabaq history and any Dhor
   history logged, confirm "Sabaq from" now prepopulates one ayah past
   the last Sabaq entry, instead of blanking out.
4. For a student with Dhor history but NO Sabaq history at all, confirm
   both fields still correctly stay blank (unchanged case).
5. For a student with neither Sabaq nor Dhor history, confirm it still
   prepopulates 114:1/114:6 (unchanged case).
6. On all 4 cards, confirm the Save icon is visibly larger and the whole
   icon+label unit is centered in its column, not pressed against the
   right edge.
7. On Sabaq Dhor, confirm each row's checkbox lines up at the same
   horizontal position across every row regardless of how long that
   row's label text is (roughly 80% across the row).
8. On Sabaq Dhor, confirm Mistakes and Tajweed now sit side by side on
   one line instead of stacked.

## 35. Edit past entries + checkbox alignment fix (V3.21.0)

1. On Sabaq Dhor, confirm every row's checkbox now lines up at the same
   horizontal position regardless of label length (including "Quarter 3
   (current): ..." style labels wrapping instead of pushing the checkbox
   right).
2. On any card, open History → confirm each row now shows a pencil icon.
3. **Sabaq, editing the LATEST entry**: tap edit on the most recent Sabaq
   entry → confirm the form loads with that entry's From/To/Lines/Pages/
   Tajweed/Notes, the banner shows "Editing entry from [date]", and Save
   now reads "Update". Change something (e.g. the To ayah) and Update →
   confirm the entry saved correctly AND that reopening Sabaq fresh now
   prepopulates from the NEW edited value, not the old one — position
   should have recomputed.
4. **Sabaq, editing an OLDER (non-latest) entry**: edit any entry that
   isn't the most recent one, change something, Update → confirm it
   saves, but reopening Sabaq fresh still prepopulates from whatever the
   actual latest entry is — position must NOT have moved to reflect the
   older edited entry.
5. Tap "Cancel" mid-edit on Sabaq → confirm the banner disappears, Save
   goes back to reading "Save", and the form resets to the normal
   prepopulated new-entry state (not left showing the edited entry).
6. On Sabaq Dhor, edit a past entry → confirm the banner shows the
   date and original range, the section checkboxes and rollup stepper
   are hidden, and only Mistakes/Tajweed/Notes are editable. Update →
   confirm those fields saved but the entry's original range is
   unchanged (check History again, the range shown should be identical
   to before).
7. Same check on Dhor: edit a past entry, confirm only Mistakes/Tajweed/
   Notes are editable, segment and timer data stay untouched after Update.
8. On any card, start editing an entry, then exit the whole log-detail
   screen via the xclose icon WITHOUT saving or cancelling. Reopen the
   screen fresh → confirm the form is back in normal "new entry" mode
   (no stale banner, Save button says "Save") and saving a genuinely new
   entry creates a new row rather than overwriting the one you were
   mid-edit on.

## 36. Dhor duration becomes a real input (V3.21.1)

1. Open Dhor fresh → confirm there's now a "Duration (minutes)" field
   above the Timer, empty by default.
2. Type a duration directly (e.g. "15.5") without touching the timer at
   all, save → confirm the entry saves with the right duration and no
   lap times.
3. Use the timer (start, a couple laps, stop) → confirm the minutes
   field auto-fills with the equivalent value at 1 decimal place, and
   the summary below the timer shows the lap count.
4. Save that entry → check History (or the raw record) shows the
   duration matching the timer's actual result and the lap times are
   present.
5. Use the timer again, then manually change the minutes field
   afterward → confirm the lap-count summary disappears immediately
   (laps cleared) as soon as you start typing, and saving records only
   the duration you typed, no lap times.
6. Leave duration blank entirely and save → confirm it still saves fine
   with no duration (unchanged "nothing compulsory" rule).
7. Edit a past Dhor entry that has both duration and lap times → confirm
   the minutes field and lap summary both populate correctly. Update
   without touching duration → confirm it's unchanged after saving.
   Edit again and this time change the duration → confirm lap times are
   now gone from that entry after Update.
8. Confirm segment (Seg X-Y) is still shown as read-only/not editable
   in the edit banner, unchanged from V3.21.0.

## 37. CRITICAL: Save + History on all 3 cards, checkbox alignment (V3.21.2)

**Check this section first, before any other testing** — it verifies
the fix for a bug that broke Save entirely.

1. Open Sabaq, fill in a valid entry, tap Save → confirm it actually
   saves (check for the "saved ✓" status and that History now shows the
   new entry). Do the same for Sabaq Dhor and Dhor.
2. On all 3 cards, confirm the History button now appears and opens the
   popup correctly (this was completely missing before this fix).
3. Open the browser console while loading the app (if possible) →
   confirm there's no `ReferenceError` on page load.
4. On Sabaq Dhor, confirm every row's checkbox now lines up in a
   genuinely identical column regardless of label length — check this
   with a mix of long ("Quarter 3 (current): ...") and short labels
   visible at once, and also check a case where one row has a "Move to
   Dhor" button and others don't, to confirm that doesn't throw off
   alignment either.
5. Tap "Move to Dhor" on an eligible row → confirm it still works
   correctly (the button's own click handler wasn't touched, just its
   DOM position).
6. Re-run a couple of spot checks from §35/§36 (edit an entry, use the
   Dhor timer) to confirm those still work correctly now that Save is
   fixed — they were untestable before this fix since Save itself
   wasn't working.

## 38. Dedicated edit screen + Delete (V3.22.0)

1. On any card, open History and tap the pencil icon → confirm the
   screen changes dramatically: the Sabaq/SDhor/Dhor/Tadabbur tabs and
   dots row disappear, the other 3 cards disappear, and the card being
   edited fills the space with a grey "Editing [Type] from [date]" bar
   at the top (no icon/heading/Save button visible) instead of its
   normal header.
2. Confirm the grey bottom bar appears too, below Notes: Cancel, Delete
   (red), Update — evenly spaced, centered.
3. Tap Cancel (either the top or bottom one) → confirm the normal
   4-card view returns, tabs/dots reappear, and the form resets to a
   fresh new-entry state.
4. Make a change and tap Update → confirm it saves correctly (reuse the
   relevant checks from §35-37) and the normal view returns afterward.
5. On Sabaq, open the edit screen for the MOST RECENT entry → confirm
   Delete is greyed out/disabled. Open it for an OLDER entry → confirm
   Delete is enabled there.
6. Tap Delete on an enabled entry → confirm the exact confirmation text
   appears ("Deleting this entry may create gaps in your history which
   cannot be recovered. Are you sure you want to DELETE?"). Cancel that
   dialog → confirm nothing happens. Do it again and confirm → confirm
   the entry is actually gone from History afterward.
7. On Dhor specifically, open the edit screen → confirm the Juz'/
   Starting at/Amount pickers and any plan banner are hidden while
   editing (only Mistakes, Duration, Tajweed, Notes should show).
8. Exit the whole log-detail screen mid-edit via the xclose icon
   WITHOUT saving/cancelling/deleting, then reopen it fresh → confirm
   it opens in normal view, not stuck in edit mode, and confirm no
   console errors appear on that reopen (this is exactly the failure
   mode V3.21.2 had — re-verify it didn't reappear here).

## 39. Edit screen polish + null-entry crash fix (V3.22.1)

1. Open the edit screen on any card → confirm "Editing [Type] from
   [date]" appears ABOVE the date field, not below it.
2. On Sabaq, open the edit screen for the most recent entry → confirm
   Delete is gone entirely (not just greyed out) from the bottom bar,
   leaving Cancel and Update. Open an older entry → confirm Delete is
   there again.
3. Find (or create, by saving an entry with From/To left blank if that's
   reachable, or via a direct DB check) a Sabaq history entry showing
   "null-null" → tap its edit icon → confirm the edit screen actually
   opens this time (previously it silently failed and dropped back to
   the normal Sabaq view). Confirm "Sabaq from"/"Sabaq to" show the "—"
   placeholder rather than any error, and that Delete works correctly
   on this entry.
4. Re-run a couple of spot checks from §38 (edit a normal entry, cancel,
   update) to confirm the reordering didn't break anything else.

## 40. Dhor detail rebuild, Phase A (V3.23.0)

1. As a student with a Dhor plan scheduled for TODAY, open Dhor →
   confirm it still pre-fills from today's plan exactly as before, with
   "Pre-filled from today's plan."
2. As a student with a plan for today AND another plan also dated today,
   confirm the existing multi-plan picker still shows (unaffected by
   this round).
3. As a student with NO plan for today but a plan scheduled on a PAST
   date that's still status='planned' (i.e. missed), open Dhor → confirm
   it pre-fills from that missed plan's segment, the date field shows
   THAT plan's own date (not today), and the hint reads something like
   "catching up on [date], which was missed."
4. As a student with no plan for today or missed, but a plan scheduled
   for a FUTURE date, open Dhor → confirm it pre-fills from that
   session, but the date field stays on TODAY (not the future date).
5. As a student with no plan at all (Dhor Schedule never configured, or
   genuinely no upcoming/missed rows) but real Dhor log history exists,
   open Dhor → confirm it continues from the last logged entry, walking
   forward through the eligible pool at the SAME granularity as that
   last entry (e.g. if the last entry was a half-juz', the next
   suggestion should also be a half-juz', not a quarter).
6. As a brand-new student with no plan and no Dhor history at all (but
   some memorised juz'/quarters in Hifz Setup), open Dhor → confirm it
   suggests the very first eligible segment at quarter granularity.
7. As a student with no eligible pool at all yet (nothing memorised in
   Setup), confirm the form falls back to a genuinely blank manual
   picker, same as before this round — no error, no crash.
8. On any card, confirm Cancel no longer appears in the edit-screen top
   bar (only in the bottom bar now), and that Cancel still works
   correctly from the bottom bar on all 3 cards.
9. On any card, confirm the date field is no longer truncated, and that
   History now sits directly beside it, right-justified, roughly the
   same height as the date field, with a bit of padding before the
   screen edge.

## 41. Dhor layout polish, pre-Phase B (V3.23.1)

1. Open Dhor → confirm the layout order is now: Date+History, then
   Amount+View Plan directly below it, then Juz'/Starting at, then
   Mistakes+Tajweed on one line, then Duration+Stopwatch on one line.
2. Tap View Plan → confirm a popup opens listing upcoming scheduled
   Dhor sessions with readable "Juz X"/"Juz X H1"/"Juz X Q1" labels
   (not raw "Seg X-Y" numbers), sorted by date. If nothing's scheduled,
   confirm it says so rather than showing an empty list.
3. Confirm the Stopwatch button beside Duration is icon-on-top, no
   border, centered in its half of the row. Tap it → confirm the
   Start/Stop/Lap timer widget appears below; tap again → confirm it
   hides. Confirm using the timer still correctly fills Duration same
   as before this round.
4. Open History on Dhor → confirm entries show "Juz X"-style text
   instead of "Seg X-Y".
5. As a student with more than one plan for today, confirm the
   multi-plan picker buttons also show "Juz X"-style text now.
6. Edit a past Dhor entry → confirm the "not editable here" note in the
   banner reads "Juz X..." instead of "Seg X-Y", and confirm the
   Amount+View Plan row hides while editing (same as Juz'/Starting at
   already did) rather than staying visible and misleadingly
   interactive.
7. Cancel out of that edit → confirm the Amount+View Plan row reappears
   correctly.

## 42. Plan Dhor (V3.24.0)

1. Confirm "Juz" (no apostrophe) appears everywhere in the app you'd
   previously seen "Juz'" — Dhor's own Juz label/dropdown, Setup's Juz
   grid heading and buttons, the quick-add placeholder.
2. Open Dhor → confirm Row 2 is Date/Plan Dhor/History in one row, Row
   3 is a Quarter/Half/Full switch (not a dropdown) sized visibly
   shorter than Row 2's buttons.
3. Type "12" into Duration (no colon) → confirm it's read as 12:00 once
   you tab away or save, not 12 seconds. Type "5:30" → confirm it's
   read as-is. Confirm the label above it now reads "Timer".
4. Tap Plan Dhor → confirm the screen opens with Save/Close icons at
   top and a Dhor Plan / View All Completed / View All switch below.
5. On Dhor Plan tab (with a plan scheduled today), confirm it's a plain
   checkbox list, not a range-select.
6. On View All Completed or View All, tap one row, then tap a
   different row further down → confirm everything in between becomes
   selected/checked, including rows that were originally at a coarser
   rollup level than what got selected (confirm those show correctly,
   including a genuinely partial row showing as indeterminate — a dash,
   not fully checked or unchecked).
7. Tap a third row after that → confirm the previous range selection is
   completely cleared and this becomes a fresh single-row selection,
   not an addition to the old range.
8. Tap Select All → confirm everything in the current tab becomes
   selected.
9. Select exactly one clean quarter, save → confirm it populates
   Juz/Position/Amount normally and Mistakes/Duration/Tajweed/Timer all
   still work; save the entry and confirm it's correct in History.
10. Select something that spans 2 juz (or an odd shape within one juz),
    save → confirm the exact confirmation text appears, and confirm
    Cancel leaves your selection untouched for editing. Confirm OK
    switches the card to From/To fields with Mistakes/Tajweed/Timer/
    Duration all visibly disabled, Notes still usable.
11. Tap From or To in that disabled state → confirm Plan Dhor reopens
    with the same selection already ticked.
12. Save that entry → confirm it saves successfully with null
    mistakes/duration and no tajweed tags, and check it doesn't crash.
13. On View All, select something not yet marked complete and save it
    (as a clean unit) → confirm it now shows as complete (not greyed)
    next time you open View All Completed.
14. Edit a past Dhor entry while a raw-range selection is still active
    on the card → confirm Mistakes/Duration are enabled again in the
    edit screen (not stuck disabled), and the stale From/To row is
    gone.
15. As a genuinely brand-new student (nothing in Setup, no Dhor
    history at all), open Dhor → confirm the fields are blank, not
    pre-filled with a first segment.

## 43. Dhor Schedule generation fix + Dhor Plan tab redesign (V3.24.1)

1. Configure a student's Dhor Schedule for Half granularity, quantity 2,
   twice a day, all 7 days selected. Clear any existing 'planned' Dhor
   plan rows for this student (so generation runs completely fresh),
   then trigger generation (open Dhor). Confirm the next active day gets
   FOUR separate half-sized rows (not two full-juz rows) — check via
   Plan Dhor's Dhor Plan tab for that day.
2. Confirm every row in the Dhor Plan tab now shows its date.
3. Open Plan Dhor on a day with a real, pre-existing Dhor history (any
   account) → confirm you see: yesterday (rolled up into one row if it
   had multiple sessions), today (every row shown individually), and
   the next 5 days (each rolled up).
4. Find or create a day with multiple sessions where SOME are logged
   (completed) and some aren't → confirm that day shows as an
   expandable row (a small triangle + the date/portion summary), not a
   plain checkbox. Tap it → confirm it expands to show each individual
   session with its own correct checked/unchecked-or-disabled state.
5. Find a day where ALL sessions are already logged → confirm it shows
   as ONE row, checked AND visibly disabled/greyed — not selectable.
6. Find a day where NONE are logged yet → confirm it shows as one
   normal, selectable checkbox summary row.
7. Select a rolled-up day (or an expanded individual session) → confirm
   it correctly loads into the Dhor card's form (clean unit → normal
   fields; anything spanning >1 juz or not a clean shape → the
   confirmation + From/To disabled-fields flow, same as the rest of
   Plan Dhor).
8. Confirm there's no way to edit a plan's own date or portion anywhere
   in this tab — selecting only ever loads into the card's form.

## 44. Pure queue model, Phase A: scheduling engine rewrite (V3.25.0)

1. Pick a test student with an existing Dhor Schedule configured and some
   `dhor_log` history. Note the current row count for `plan_type='dhor'`
   in `plans` (D1 console: `SELECT COUNT(*) FROM plans WHERE student_id =
   '<id>' AND plan_type = 'dhor';`).
2. Open the Dhor card for that student (triggers the open-time
   `/dhor-schedule/ensure` call) → confirm no error appears on screen, and
   re-run the count query from step 1 → confirm the count is UNCHANGED
   (no new dated rows were inserted — the main behavior change here).
3. With no `plans` row for today, confirm the Dhor card still pre-fills
   from `dhor_log` history as before ("continuing from your last Dhor
   session") and that the segment shown is genuinely the next one after
   the last logged entry.
4. Manually insert a `plans` row for TODAY via D1 console
   (`plan_type='dhor'`, `status='planned'`, `target_date` = today) →
   reopen the Dhor card → confirm it still pre-fills from that row
   ("Pre-filled from today's plan.") exactly as before.
5. Manually insert a `plans` row for a FUTURE date (a few days out) via D1
   console, then reopen the Dhor card with no today-row present → confirm
   it does NOT borrow that future row anymore (no "pre-filled from your
   next upcoming session" banner) — it should fall through to
   continue-from-last (or blank, if no history) instead.
6. Manually insert a `plans` row for a PAST date, still `status='planned'`
   (simulating a leftover "missed" row from before this deploy), then
   reopen the Dhor card with no today-row present → confirm it's simply
   ignored (no "catching up on a missed session" banner) — same
   continue-from-last/blank fallback as step 5.
7. In Setup, save the Dhor Schedule section (with or without a Tomorrow's
   Portion picked) → confirm the normal save-success indicator still
   appears, with no "Couldn't save" error — confirms `ensureDhorSchedule`
   returning its now-empty result doesn't throw.
8. For a student with no Dhor Schedule configured at all, confirm opening
   the Dhor card and saving Setup's Dhor Schedule section both still
   behave exactly as before (no new errors introduced by this change).

## 45. Pure queue model, Phase B: Dhor card prepopulation rewire (V3.26.0)

1. Manually insert exactly ONE `plans` row for TODAY for a test student
   (`plan_type='dhor'`, `status='planned'`, `target_date` = today) → open
   their Dhor card → confirm it silently pre-fills from that row (no
   picker of any kind) and the banner reads exactly "Pre-filled from
   today's plan." (no count mentioned).
2. Manually insert a SECOND (and a third) `plans` row for the same
   student, same today's date → reopen the Dhor card → confirm:
   - No inline picker/buttons appear anywhere on the card (this is the
     main behavior change — compare against pre-V3.26.0 screenshots or
     TESTING.md history if unsure what the old picker looked like).
   - The form is pre-filled from the FIRST of those rows in creation
     order (the earliest one you inserted).
   - The banner reads "Pre-filled from today's plan (1 of 3 — see Plan
     Dhor for the rest)."
3. With that same batch still in place, edit the pre-filled Juz/Position/
   Amount before saving → confirm the edit is accepted normally and Save
   works, same as manual entry always has (prepopulation is a default,
   not a lock).
4. Open Plan Dhor (separately) with that same batch still in place →
   confirm all 3 rows are visible and selectable there — this is what
   "the rest of the batch is still reachable via Plan Dhor" means in
   practice.
5. Clear today's rows, confirm the student has real `dhor_log` history →
   open the Dhor card → confirm it still pre-fills the next segment after
   the last logged entry, banner reads "No plan set up yet — continuing
   from your last Dhor session." (unchanged from before this phase).
6. For a student with no plan and no history at all → confirm a genuinely
   blank form, no banner text, no console errors.
7. Open your browser's dev tools Network tab, then open the Dhor card →
   confirm there's no request to `/dhor-schedule/ensure` at all any more
   (only `/dhor-schedule/default-entry`).

## 46. Dhor card position-selector redesign + a real latent bug fix (V3.26.1)

1. Open the Dhor card fresh (any student). Confirm the Amount switch
   defaults to Quarter, and "Starting at" shows a 4-way switch labeled
   1/2/3/4, slot 1 selected.
2. Tap Half on the Amount switch → confirm "Starting at" immediately
   rebuilds as a 2-way switch labeled 1/2, and resets to slot 1 (not
   whatever quarter slot was previously selected).
3. Tap Full (Juz) → confirm the whole "Starting at" field disappears, and
   the Juz dropdown expands to fill the row (no empty gap beside it).
4. Save an entry with Full (Juz) selected → confirm via History or the
   D1 console that the saved `segment_from`/`segment_to` covers the
   ENTIRE juz' (a full-perJuz span starting at the juz's own first
   marker) — this is the actual bug check: before this fix, saving Full
   right after having had a non-1 Quarter/Half position selected could
   silently save a segment that ran into part of the next juz' instead.
5. Tap back to Quarter → confirm 4 options reappear, reset to slot 1.
   Tap Half again → confirm 2 options, reset to slot 1. Tapping between
   units repeatedly should never leave the switch showing a selection
   that doesn't match one of the currently-visible slots.
6. Select slot 2 under Half, then Save → confirm (via `describeDhorSegment`
   in the History rail, or the D1 console) this recorded as "H2" — the
   *second* half, not a quarter or an off-boundary range.
7. Open the card for a 15-line (Madani) account → repeat steps 1-6.
   Confirm the switch still shows 4 labeled 1/2/3/4 for Quarter and 2
   labeled 1/2 for Half (same labels as 13-line) — the underlying stored
   segment numbers will differ from a 13-line account's, but nothing
   about what's on screen should look different.
8. Apply a plan from Plan Dhor, or let the card prepopulate from
   `continue_last` — confirm the position switch correctly reflects
   whichever slot that plan/history entry actually falls on (not reset to
   slot 1) — this is the "prepopulation is left alone" behavior, distinct
   from the "manual switch reset" behavior in steps 2/5.
9. Start editing an existing History entry (pencil icon) → confirm the
   whole Juz/Position/Amount picker (including the new switch) is hidden
   during edit, same as before this change — editing never touches
   segment/position, only mistakes/tajweed/comment/duration.

## 47. Nav dropdown menu fixed to the viewport (V3.26.2)

1. Open any screen with enough content to scroll (Journal, or a long
   History list). Scroll down a good amount first.
2. Tap the menu icon in the top band → confirm the dropdown appears
   immediately below the band, fully visible, without needing to scroll
   back up — this is the actual bug: before this fix, it opened
   off-screen near the top of the page instead.
3. Tap a nav item inside the open dropdown → confirm it navigates AND
   closes the dropdown, same as before this change.
4. Reopen the dropdown, then tap the menu icon again to close it without
   picking anything → confirm it closes cleanly.
5. Repeat step 1-2 on a notched phone (iPhone with a Dynamic Island/
   notch) if available → confirm the dropdown still lines up flush
   under the band, not overlapping it or leaving a gap — this checks the
   live-measured height actually accounts for the device's safe-area
   inset correctly, not just on devices without one.
6. Rotate the device (or resize the browser window enough to change the
   safe-area calculation) while logged in, then open the menu → confirm
   it still lines up correctly rather than using a stale measurement
   from before the rotation.

## 48. Tomorrow's Portion removed; Pure queue model, Phase C: Plan Dhor's queue view (V3.27.0)

1. Open Setup for any student → confirm "Tomorrow's portion" no longer
   appears anywhere in the Dhor Schedule section.
2. Save Setup's Dhor Schedule section → confirm it still saves
   successfully (no error), same as before.
3. Open a fresh Dhor card → confirm the Amount switch now defaults to
   Half (not Quarter).
4. For a student with NO pool at all (nothing marked in Hifz Setup) →
   open Plan Dhor's "Dhor Plan" tab → confirm it shows the "nothing to
   show yet" message, not an error.
5. For a student with a pool but no Setup configured and no dhor_log
   history → open Plan Dhor → confirm it shows 7 single-item rows, each
   1 unit at whatever the Dhor card's Amount switch currently shows
   (default Half) — change the card's switch, reopen Plan Dhor, confirm
   the granularity shown updates to match.
6. For a student with real `dhor_log` history and Setup configured (e.g.
   granularity=half, quantity=2, frequency=twice) → open Plan Dhor →
   confirm today shows 4 individual half-juz' rows (no dates, no
   checkboxes pre-disabled), with the first one already checked matching
   what's pre-filled on the card itself.
7. Confirm the "rest of the week" rows below today are rolled up (one
   row per remaining day, "Juz X to Juz Y" label) → tap one to expand →
   confirm it shows each individual item with its own checkbox → close
   Plan Dhor and reopen it → confirm every row is back to collapsed.
8. Select a few individual rows across different rolled-up days, then
   Save → confirm this behaves the same as any other Plan Dhor
   selection (populates the card directly if it resolves to one clean
   unit, otherwise switches the card into raw-range mode) — the save
   logic itself wasn't touched by this phase.
9. Check the History rail or D1 console for any entry description that
   used to show "Qundefined" → confirm it now reads correctly (e.g.
   "Juz 3 Q4"), not just for new entries but for the label itself
   wherever it's used.

## 49. Urgent TODO list cleared; Dhor card UI polish + Plan Dhor behavior fixes (V3.28.0)

1. In Plan Dhor, select a clean half-juz portion (e.g. exactly the 2
   quarters making up one half) and Save → confirm the Dhor card
   populates with the correct Juz number and Half selected — not a blank
   Juz dropdown. Repeat for a full juz and a single quarter.
2. Manually pick a selection that spans more than one juz' (a raw range)
   and Save → confirm the card switches into its disabled-fields From/To
   display showing the correct Juz/segment labels, not blank or
   "undefined" anywhere.
3. Check a recent `dhor_log` row saved via the raw-range path *before*
   this fix (if one exists) — via History or the D1 console — for a
   `NaN` or garbage `segment_from`/`segment_to`. This confirms the bug's
   real-world impact; whether/how to repair it is a separate decision.
4. Confirm `POST`/`PATCH`/`DELETE /plans` are gone (a manual request to
   any of them should 404 or route-not-found) while `GET /plans` still
   works normally — open the Journal landing page and confirm upcoming
   plans still display.
5. Open the Dhor card: confirm "Plan" and "History" (not "Plan Dhor"/
   "Dhor History") as the Row 2 button labels, with no visible text
   wrapping or overlap. Confirm the Amount switch reads all 3 words
   ("Quarter"/"Half"/"Full") without clipping, roughly centered with
   visible margin on both sides.
6. Confirm there's no banner text anywhere above Juz/Position (neither
   the old "Pre-filled from…" nor "No plan set up yet…"), and that
   "Starting at" no longer appears as a label — while Juz and Position
   still start at the same vertical position as each other.
7. Confirm the Timer icon is vertically centered next to the Duration
   field, not sitting above/below it.
8. In Plan Dhor's "Dhor Plan" tab, tap today's first item, then tap a
   later item (either another one of today's, or one inside an expanded
   "rest of week" row) → confirm everything between the two gets
   selected, and a third tap starts a fresh selection — same behavior as
   "View All Completed"/"View All".
9. Tap a "rest of week" row with more than one item → confirm it
   actually expands this time (▸ becomes ▾, individual items appear) —
   this was the confirmed bug. Collapse it again, close Plan Dhor, and
   reopen → confirm it's back to collapsed.

## 50. Pool updates moved to the Dhor card's Save; Dhor Plan's range-select fixed for queue wraparound (V3.29.0)

1. In Plan Dhor, select something not currently in the pool and hit
   Save → confirm the card populates as before, but check the pool
   (Setup's Juz' grid, or a direct `baseline_selection` query) — it
   should be UNCHANGED at this point, not yet include the new selection.
2. Now actually log the entry from the card (hit the card's own Save) →
   confirm the pool updates now, and the new units are present.
3. Close Plan Dhor / abandon the card without logging anything after a
   Plan Dhor selection → confirm the pool is still unchanged (this is
   the actual bug case: previously the pool would have grown here even
   with nothing logged).
4. Log a fully manual entry (never opened Plan Dhor this session) for a
   segment not yet in the pool → confirm the pool still updates
   correctly — this path shouldn't depend on Plan Dhor ever having been
   opened.
5. Log an entry for a segment already fully inside the pool → confirm
   no unnecessary profile save happens (or if it does, that the pool
   content is unchanged either way) — this is the no-op case.
6. Log a raw-range entry (spanning multiple juz') → confirm its
   underlying quarter-units are added to the pool the same as a clean
   single-unit entry would be.
7. For a student whose pool is small enough that the Dhor Plan queue
   wraps around within the displayed week (or manufacture this via D1 —
   a small pool, high quota) → tap two rows that are adjacent in the
   displayed list but come from opposite ends of the pool numerically →
   confirm only those rows (and whatever's strictly between them in the
   list) get selected — not everything numerically in between.
8. Confirm "View All Completed"/"View All" still range-select exactly as
   before — untouched by this change.

## 51. Dhor card UI: real root causes fixed, custom date display, rollup default flipped (V3.30.0)

1. Open the Dhor card on a normal-width screen → confirm the Amount
   switch now spans a clear majority of the row width, centered, all 3
   labels ("Quarter"/"Half"/"Full") fully readable with no clipping.
2. Open the Dhor card on a narrow mobile width → confirm "Plan" and
   "History" (Row 2) stay fully inside the card, no button touching or
   crossing the card's edge.
3. Compare the Juz dropdown and the Position switch side by side →
   confirm their top AND bottom edges now line up exactly.
4. Compare the Duration input and the Timer button side by side →
   confirm their bottom edges line up exactly (not just "roughly
   centered"). Confirm the Timer icon is noticeably bigger than before.
5. On all 3 cards with a date field (Sabaq, Sabaq Dhor, Dhor) → confirm
   the date shows as "DDD dd-MMM" (e.g. "Mon 03-Aug"), identically across
   different browsers/devices, not whatever the browser's own native
   format happens to be.
6. Tap the date display on each card → confirm the native date picker
   opens (same picker as before), pick a different date → confirm the
   display updates to show the new date in the same consistent format.
7. Save an entry after changing the date this way → confirm the saved
   date is correct (the underlying native input's value is what actually
   gets sent, unchanged from before this round).
8. Open Plan Dhor's "View All Completed" and "View All" tabs fresh (a
   juz' that's never been manually expanded/collapsed before) → confirm
   it shows rolled up to Juz level by default, not individual quarters.

## 52. Unified spacing/sizing system across all 3 detail cards; date-display bug fixed at its root (V3.31.0)

1. Open the Dhor card fresh (not from editing an existing entry) →
   confirm the date shows today's actual date in "DDD dd-MMM" format
   immediately, not "Select date."
2. Open Sabaq and Sabaq Dhor fresh → confirm the same.
3. Edit an existing entry on any of the 3 cards (loads a past date via
   `entry.date`) → confirm the display updates to that entry's date
   correctly, not stuck on whatever was showing before.
4. Compare the date field's height and width across all 3 cards side by
   side → confirm they now look like the same component sized to the
   same short text, not one noticeably wider than the others.
5. On the Dhor card specifically → confirm "Plan" and "History" are
   visibly bigger/roomier now that the date isn't taking a fixed 40% of
   the row.
6. Compare Row 2, Juz, Position, Duration, and the Timer button's
   heights across the Dhor card → confirm all of them match exactly.
7. Compare Sabaq/Sabaq Dhor's date+history row height against Dhor's
   Row 2 → confirm they now match too (previously Sabaq/Sabaq Dhor had
   no explicit height at all).
8. Confirm there's now visible space between the Quarter/Half/Full
   switch and Row 2 above it, not touching.

## 53. Plan Dhor: granularity-aware rollup labels, pill-tracking bug fixed, View All Completed removed, switch centering fixed (V3.32.0)

1. For a student whose Setup is configured for halves (not quarters) →
   open Plan Dhor's "Dhor Plan" tab → confirm a "rest of week" row that
   doesn't span a full juz' shows "H1"/"H2" language, not "Q1"/"Q4".
2. Confirm a row that genuinely spans complete juz' (starts at the very
   beginning of one juz' and ends at the very end of another) still
   shows the plain "Juz X to Juz Y" form.
3. Open Plan Dhor → tap "View All" → confirm the pill/highlight actually
   moves to "View All" and "Dhor Plan" is no longer marked active — not
   just the content changing underneath.
4. Confirm there are only 2 tabs now ("Dhor Plan"/"View All") — "View
   All Completed" is gone.
5. On "View All" → confirm it still shows every juz' 1-30, with anything
   not yet in the pool greyed out, same as before.
6. Confirm the tab switch's labels look properly centered vertically —
   not sitting oddly high/low or looking squeezed within the pill.

## 54. Plan Dhor's vertical compression fixed at its actual root: a flex-shrink gotcha (V3.33.0)

1. Open Plan Dhor on "Dhor Plan" → confirm the switch, title row, and
   Select All button all look normal-sized.
2. Switch to "View All" (30 rows, much longer than Dhor Plan's list) →
   confirm the switch and title row look exactly the same size as they
   did on "Dhor Plan" — no shrinking, no matter how long the list below
   is.
3. Shrink the browser window's height (or open DevTools docked to the
   bottom, as in the screenshots that caught this) while "View All" is
   showing → confirm the switch stays the same size; only the list
   below should get shorter/need more scrolling.
4. Confirm the content list itself still scrolls properly when it's
   taller than the available space.

## 55. Dhor's timer replaced with the session-timer component (V3.34.0)

1. Open the Dhor card, tap Stopwatch → confirm the new full-screen timer
   opens (black background, big ring, "Start Dhor"/"Stop Dhor" labels
   under the 2 round buttons).
2. Tap Start Dhor (the play button) → confirm it starts counting, the
   ring fills, and the icon switches to pause.
3. Tap Lap a few times → confirm each lap appears in the list.
4. Tap the Close (X) icon → confirm the timer minimises to a small
   floating pill at the bottom of the screen, still showing elapsed time
   ticking, rather than disappearing entirely.
5. Tap the pill → confirm it re-expands to the full view with the same
   elapsed time and lap list intact (nothing reset).
6. Tap the Save icon → confirm the timer closes, and the Dhor card's own
   Duration field now shows the correct mm:ss total.
7. Save the Dhor entry → open History → confirm the entry shows the
   correct duration AND a line listing each lap's time.
8. Start a NEW timer session, minimise it (Close), then switch to
   Sabaq/Sabaq Dhor/Tadabbur and back to Dhor → confirm the mini pill
   (or full view, if it was left open) still shows the timer running,
   not reset.
9. Test with Amount set to Full, Half, and Quarter → confirm the ring's
   target (the "of XX:XX" reading) changes to 40/20/10 minutes
   respectively.
10. Edit an existing Dhor entry that has lap_times → confirm Duration
    still loads correctly (this path doesn't go through the new timer
    at all, so should behave exactly as before).

## 56. Timer's target linked to the real Setup value (V3.34.1)

1. Confirm Setup's Hifz Setup section shows a "Minutes / juz'" field
   (default 40 if never touched).
2. Change it to something else (e.g. 60), save Setup.
3. Open the Dhor card, set Amount to Full, tap Stopwatch → confirm the
   ring's "of XX:XX" reading shows 60:00, not 40:00.
4. Change Amount to Half → close and reopen the timer → confirm it now
   shows 30:00 (half of the configured 60).
5. Reset Setup's target back to 40 (or leave a fresh student untouched)
   → confirm the timer still defaults to 40/20/10 as before — no
   regression for anyone who's never customized this field.
6. Start a timer, minimise it, navigate to Settings and then Journal →
   confirm the floating pill is visible and still ticking on both
   screens, not just while the Dhor card itself is showing — confirmed
   as the intended behavior this round.

## 57. Timer icon semantics redefined, card-level lap rollup, responsive width cap (V3.34.2)

1. Open the timer, let it run a few seconds, tap Close → confirm it
   fully disappears (not minimises), and the Duration field on the card
   is untouched (nothing was saved).
2. Reopen, run it, tap Reset → confirm the display goes back to 00:00
   AND stays stopped — tapping it again shouldn't show the clock still
   ticking from 0; a genuine Start tap should be required.
3. Confirm the top row (full view) now shows 4 icons: Close, Reset,
   Note Time (clipboard-clock icon), Minimise.
4. Tap Minimise → confirm it shrinks to the pill and keeps running.
   Confirm the pill shows: a top row of 3 small icons (Close/Reset/Note
   Time) and a second row (elapsed time, Lap, Pause/Restart, Maximise).
5. From the pill, tap Lap → confirm a lap gets recorded (check via Note
   Time afterward that it shows up). Tap Pause/Restart → confirm it
   toggles correctly. Tap Maximise → confirm it returns to full view
   with the same elapsed time and laps intact.
6. Tap Note Time (either view) → confirm a confirmation dialog appears.
   Tap Cancel → confirm nothing changes, timer keeps its current state.
   Tap Note Time again, confirm OK this time → confirm Duration
   populates, the timer closes, and a small "Lap times" rollup appears
   next to the Timer button (if laps were recorded).
7. Tap the "Lap times" rollup → confirm it expands to show each lap's
   time, collapses again on a second tap.
8. Save the actual Dhor entry (the card's own Save button) → confirm
   the lap-times rollup disappears from the card, and the entry's laps
   show up correctly in History instead.
9. On a tablet-width and then desktop-width browser window, open the
   full-view timer → confirm it's capped at 50%/30% width respectively,
   centered, not spanning the full screen. Confirm mobile width still
   shows it full-screen.

## 58. Auto-repopulate after Dhor save, "nothing entered" confirmation, Sabaq same-ayah prepopulation, Sabaq Dhor duplicate-save fix (V3.34.3)

1. Save a Dhor entry (any valid one) → confirm the card immediately
   clears and shows the next queue item, ready to log again, without
   navigating away.
2. On a fresh Dhor card, without touching anything, tap Save → confirm
   a confirmation dialog appears. Tap Cancel → confirm nothing was
   saved. Tap Save again, confirm OK this time → confirm it saves
   normally.
3. Fill in just Mistakes (leave everything else untouched) and Save →
   confirm no confirmation dialog appears — one real field is enough.
4. Repeat for Duration, Tajweed, and Notes individually — each alone
   should be enough to skip the confirmation.
5. Edit an existing Dhor entry and Save without changing anything →
   confirm no confirmation dialog appears (edits are exempt).
6. Repeat steps 2-5 for Sabaq (Lines/Pages/Tajweed/Notes as the 4
   fields).
7. Confirm Sabaq Dhor is unaffected — it should still hard-block (not
   just warn) when nothing is checked, same as before.
8. Open Sabaq fresh → confirm both From and To now show the same
   starting ayah, not one populated and the other showing a dash.
9. Check a section in Sabaq Dhor and Save → confirm the checkbox is
   unchecked afterward, not still showing checked. Tap Save again
   immediately (nothing checked now) → confirm it correctly blocks with
   "please check at least one section," not a silent duplicate save.

## 59. Timer pill layout finalised: Maximise repositioned, row order fixed, lap dots, mobile safe-area (V3.34.4)

1. Minimise the timer → confirm the top row shows 4 icons in order:
   Close, Reset, Note Time, Maximise (rightmost).
2. Confirm the second row shows, left to right: the Pause/Restart
   toggle, elapsed time (roughly centered), Lap.
3. Tap Lap 3 times → confirm 3 small white dots appear under the Lap
   button. Tap Reset → confirm the dots clear along with the time.
4. On an actual mobile device (or simulated mobile viewport with a
   notch/home indicator) → open the full-view timer → confirm none of
   its controls (top row icons, the round Start/Stop buttons) are
   hidden behind or overlapping the status bar or home indicator area.

## 60. Rail restructured: Timer is now a permanent card, Tadabbur has its own screen (V3.34.5)

1. Open the day-log view (any journal cell) → confirm the rail shows 4
   dots: Sabaq, SDhor, Dhor, Timer (not Tadabbur).
2. Swipe/scroll through the rail on mobile → confirm the 4th card is
   the Timer (dark theme, ring, controls), not a Tadabbur form.
3. On desktop width → confirm all 4 cards (Sabaq/Sabaq Dhor/Dhor/Timer)
   show side by side in the grid, none clipped or overflowing its own
   30%-width column.
4. From the Dhor card, tap Stopwatch → confirm the rail scrolls/swipes
   to the Timer card (not a full-screen overlay covering everything).
5. Start the timer, tap Minimise → confirm it becomes the floating
   pill, still visible over the rail.
6. Tap Maximise → confirm it scrolls back to the Timer card with the
   same elapsed time and laps intact.
7. Minimise the timer, navigate to Settings, then tap Maximise on the
   pill → confirm it navigates back to the day-log view AND scrolls to
   the Timer card correctly.
8. Start filling in the Dhor card (e.g. type some mistakes) without
   saving, then tap Maximise from the pill (timer already minimised
   from a different screen) → confirm the Dhor card's in-progress,
   unsaved input is still there afterward, not wiped by a fresh render.
9. Tap the nav menu → confirm "Tadabbur" is now its own destination,
   separate from the day-log view.
10. Open Tadabbur from the nav → confirm it loads/saves a reflection
    correctly, same as it always did as the 4th rail card.
11. Tap Close on the timer (full or pill) → confirm it resets (time
    back to 00:00) but doesn't disappear or leave a gap in the rail.

## 61. Rail scroll position fixed after editing; Duration split into 2 numeric fields (V3.34.6)

1. From History, edit a Sabaq Dhor entry and save → confirm the view
   returns to the Sabaq Dhor card, not Sabaq.
2. Repeat for a Dhor entry → confirm it returns to the Dhor card.
3. Repeat for a Sabaq entry (should already have worked, confirm no
   regression) → confirm it returns to Sabaq.
4. On the Dhor card, tap into Minutes and type a single digit (e.g. "7")
   → tap into Seconds directly (not via keyboard Next) → confirm Minutes
   still just shows "7" (not auto-cleared or reformatted).
5. Type 2 digits into Minutes (e.g. "45") → confirm focus jumps
   automatically to Seconds without tapping.
6. Type a single digit into Minutes (e.g. "5"), then tap Save directly
   (skip Seconds entirely) → confirm the entry saves with 5:00, not 5
   seconds or a validation error.
7. Confirm the native numeric keypad appears for both fields on a real
   mobile device, with no colon or other non-numeric character expected
   in either field.
8. Use the Timer's Note Time to populate Duration → confirm both fields
   populate correctly (e.g. a 7:05 session shows "7" and "05").
9. Edit an existing Dhor entry with a real duration → confirm both
   fields load correctly from history.

## 62. Fixed: Timer card was invisible on every screen load (V3.34.7)

1. Load the day-log view fresh (first visit, or after a hard refresh) →
   confirm the Timer is visible as the 4th card in the rail immediately,
   not just after some other interaction.
2. Swipe/scroll to it on mobile, or confirm it's visible in the desktop
   grid alongside Sabaq/Sabaq Dhor/Dhor.
3. Save a Dhor entry (which re-runs renderDhorScreen per V3.34.3's
   auto-repopulate) → confirm the Timer card is still visible afterward,
   not hidden by the save's own screen refresh.
4. Navigate away to Settings and back to the day-log view → confirm the
   Timer card is still there on return.
5. Start the timer, minimise it, navigate around, then maximise back →
   confirm the full view (the actual rail card, not an overlay) is
   visible and shows the correct running state.

## 63. Full view resized for mobile, mini pill repositioned around a genuine iOS Safari bug (V3.34.8)

1. On an actual iPhone (or a simulated 390x844 viewport), open the full
   Timer view → confirm the entire layout is visible with no clipping —
   all 4 top icons, the ring, the Lap button, and both round controls
   with their "Start Dhor"/"Stop Dhor" labels fully visible without
   scrolling.
2. On a genuinely shorter device (e.g. an SE-sized screen) → confirm
   the ring shrinks further rather than staying the same size and
   clipping again.
3. On a taller/larger phone → confirm the ring doesn't exceed 210px
   (shouldn't grow past its cap just because there's more room).
4. Minimise the timer on an actual iPhone in Safari, with the toolbar
   visible (not scrolled up) → confirm the pill is fully visible on
   screen, not partially or fully hidden below the visible area.
5. Scroll the page while the pill is minimised (toolbar shows/hides) →
   confirm the pill stays visible and correctly positioned throughout,
   not left behind at a stale position.
6. Confirm the pill still displays and works correctly on Android /
   desktop browsers (where the iOS-specific bug doesn't apply) — the
   CSS fallback should still hold there without any visualViewport
   involvement mattering.

## 64. Mini pill's positioning bug actually fixed at its root, not worked around (V3.34.9)

1. On desktop, minimise the timer → confirm the pill's position looks
   correct (back to how it looked before V3.34.8's regression), bottom-
   centered, not sitting oddly low.
2. On an actual iPhone in Safari, minimise the timer with the toolbar
   visible → confirm the pill is fully visible on screen.
3. Scroll the page while minimised (toolbar shows/hides) → confirm the
   pill stays correctly positioned throughout.
4. With the timer minimised, tap anywhere on the screen NOT over the
   pill itself → confirm normal page interaction still works (the
   full-viewport wrapper isn't blocking taps elsewhere).
5. With the timer minimised, open History or Plan Dhor from the Dhor
   card → confirm the modal's sheet covers the pill while open.
6. Close that modal → confirm the pill reappears exactly where it was,
   still showing the correct running/elapsed state (confirming the
   timer itself was never affected, only visually covered).
7. Confirm the pill is still fully tappable itself (Close/Reset/Note
   Time/Maximise, Lap, Pause-Restart) — not accidentally blocked by its
   own new wrapper.

## 65. Mini pill is now genuinely draggable (V3.34.10)

1. Minimise the timer → confirm it appears at the top of the screen
   (not the bottom).
2. Tap a button on the pill quickly (e.g. Lap) → confirm it registers
   normally, no delay, no accidental drag.
3. Press and hold anywhere on the pill (roughly half a second) without
   moving, then drag it to a different part of the screen → confirm it
   follows your finger/pointer smoothly.
4. Release the drag → confirm nothing on the pill was accidentally
   triggered (e.g. it didn't accidentally toggle Pause/Restart just
   because the release happened over that button).
5. Start a press-and-hold, then move your finger away before half a
   second has passed → confirm this does NOT start a drag (should
   cancel cleanly, e.g. treated as if nothing happened).
6. Drag the pill near the very edge of the screen (try all 4 edges) →
   confirm it never goes fully or partially off-screen, always fully
   visible.
7. Drag the pill to a new spot, tap Maximise, then Minimise again →
   confirm it reappears exactly where you last dragged it, not back at
   the default top position.
8. Drag the pill somewhere, then reload the page and minimise again →
   confirm it starts back at the default top position (not remembered
   across a reload).
9. On mobile, drag the pill somewhere near an edge, then rotate the
   device → confirm it's still fully on-screen after rotation, not
   partially cut off by the now-different screen dimensions.

## 66. Drag now starts from a dedicated handle, not press-and-hold (V3.34.11)

1. Minimise the timer → confirm a small move/grip icon appears as the
   leftmost icon in the pill's top row, before Close.
2. Touch down on the handle and drag → confirm the pill follows
   immediately, no delay, and confirm no native browser gesture (text
   selection highlight, a context menu, a "save image" style popup)
   appears on whatever's underneath the pill during the drag.
3. Tap any of the other buttons (Close, Reset, Note Time, Maximise,
   Lap, Pause/Restart) → confirm they still work normally, unaffected
   by the handle's presence.
4. Drag using the handle, release → confirm nothing was accidentally
   triggered by the release.
5. Confirm the on-screen constraint and session-only memory still work
   exactly as before (repeat TESTING.md #65's steps 6-9 with the new
   handle-based trigger instead of press-and-hold).

## 67. Pill-width drag fix, and a new confirmation checkbox on Sabaq/Dhor (V3.34.12)

1. Minimise the timer, drag it using the handle → confirm it keeps its
   proper rounded pill shape throughout the drag, not stretching into a
   full-width band, especially on a phone-width screen.
2. On the Sabaq card, without checking "Confirm selection," tap Save →
   confirm it's blocked with an error message, nothing saves.
3. Check "Confirm selection," tap Save → confirm it saves normally, and
   the checkbox is unchecked again immediately afterward.
4. Repeat steps 2-3 for the Dhor card.
5. Edit an existing Sabaq entry from History, tap Update without
   checking the box → confirm it's blocked the same way new entries
   are. Check it, Update → confirm it saves and the box clears.
6. Repeat step 5 for a Dhor entry (both the edit path and a fresh
   entry should both require and clear the checkbox).
7. Confirm the old "nothing was entered" popup no longer appears
   anywhere on Sabaq or Dhor — the checkbox is the only gate now.
8. Open a fresh Dhor card (not editing) → confirm the checkbox starts
   unchecked, not carried over from a previous session on the card.

## 68. Confirmation checkboxes repositioned higher on both cards (V3.34.13)

1. Open Sabaq → confirm "Confirm selection" now appears directly under
   the date/Sabaq History row, before "Sabaq from," left-aligned with
   the rest of the card's labels (not centered or indented).
2. Open Dhor → confirm "Confirm selection" now appears directly under
   the Quarter/Half/Full switch, before the Juz row, same left
   alignment.
3. Confirm both checkboxes still function exactly as before in their
   new spots — hard-block Save until checked, clear immediately after
   a successful save (repeat TESTING.md #67's steps 2-8).

## 69. Journal landing page: complete rebuild (V3.35.0)

1. Log in → confirm the Journal table shows real, correct data for
   Sabaq (previously always blank/"—" due to the stale field names).
2. Confirm no Feedback column appears.
3. Confirm each cell shows the trimmed shorthand: Sabaq as a plain
   range (no lines/pages), Sabaq Dhor as a plain range (no mistakes),
   Dhor as a segment only (no mistakes/time).
4. Confirm the most recent date is the very first row.
5. Confirm the 10 most recent days show individually, and anything
   older shows as a rolled-up date-range row instead.
6. Tap "Load more" → confirm it extends the rollup rows further back
   without reloading the whole page or losing the expanded 10 days.
7. On desktop (mouse/trackpad) → click a cell with a real entry →
   confirm it opens that entry for editing directly on the detail
   screen, on the correct card.
8. On mobile/touch → press and hold a cell with a real entry (don't
   move your finger) → confirm the same edit behavior. Confirm a quick
   tap does NOT open editing, and confirm no native text-selection
   highlight or context menu appears during the hold.
9. Tap/hold a date cell → confirm it opens the detail screen with
   every card's own date field set to that date.
10. Tap each of the 3 column headers (Sabaq/Sabaq Dhor/Dhor) → confirm
    each one correctly lands on its own card (not always Sabaq) — test
    this specifically on mobile AND tablet widths.
11. On desktop width → confirm column header taps still work sensibly
    (all 4 cards already visible, no scroll needed).
12. Confirm the nav menu no longer shows separate Sabaq/Sabaq
    Dhor/Dhor entries, and instead shows one "Detail" entry with the
    new icon that opens the detail screen.
13. Confirm the Journal header row stays visible and fixed in place
    while the rows scroll underneath it, and looks visibly taller than
    before.
14. Minimise the timer, then navigate to Journal → confirm the pill
    still floats correctly over the new layout, unaffected by the
    rebuild.

## 70. Sabaq Lines/Pages recompute-on-confirm, Journal popup + plain click, card height genuinely fills the screen (V3.35.1)

1. On Sabaq, change the "From" or "To" ayah using the stepper buttons
   (not typing directly) → confirm Lines/Pages does NOT update yet
   (matches the pre-existing behaviour, not a new bug).
2. Check "Confirm selection" → confirm Lines/Pages recalculates
   correctly to match the actual current range.
3. Repeat using the surah picker (chevron) to change either field →
   confirm the same recalculation happens on checking Confirm selection.
4. On Journal, find a date with 2+ entries in one column → confirm the
   "+N" badge is a real, tappable button, separate from the main cell.
5. Tap the badge → confirm a small popup opens listing every entry for
   that date/type. Tap one → confirm it opens that specific entry for
   editing (not just always the most recent one).
6. Tap a normal journal cell (not the badge) → confirm it still opens
   the most recent entry directly for editing, no popup.
7. Tap a date cell → confirm it still opens the detail screen with
   every card's date field set correctly.
8. Confirm none of the above require holding — a normal, quick tap is
   enough everywhere, on both touch and mouse/trackpad.
9. Scroll through the Journal table slowly on a touch device → confirm
   scrolling works smoothly and never accidentally triggers a
   navigation partway through.
10. On mobile, open any of the 4 detail cards → confirm the card fills
    noticeably more of the screen than before, with no large empty gap
    below it.
11. Edit an existing entry (any of the 3 editable cards) → confirm the
    Cancel/Delete/Update controls at the bottom are now near the actual
    bottom of the screen, not stranded partway down with empty space
    beneath them.
12. On desktop width → confirm all 4 cards (Sabaq/Sabaq Dhor/Dhor/
    Timer) are visibly taller than before, filling the available
    height properly.
13. Confirm the Timer card specifically also grew to match — check
    both mobile/tablet and desktop widths.

## 71. Fixed: editing landed on the Timer instead of the card being edited (V3.35.2)

1. From Journal, tap a Sabaq entry to edit it → confirm you land
   directly on the Sabaq card in edit mode, not the Timer.
2. Repeat for Sabaq Dhor and Dhor entries → confirm each lands
   correctly on its own card.
3. From within the detail screen itself, use History's own edit button
   on any of the 3 cards → confirm the same correct behaviour.
4. While in edit mode (any of the 3 cards) → confirm the Timer card is
   not visible at all — swiping/scrolling the rail during editing
   should show nothing but the card actually being edited.
5. Confirm exiting edit mode (Cancel or a successful Update) still
   correctly returns to the right card in the normal rail view,
   Timer included as the 4th card again.

## 72. Hybrid removed, 15-line IndoPak mushaf built (V3.36.0)

1. Open Settings → Hifz Setup → confirm the Mushaf switch shows
   13 line / 15 line Madani / 15 line IndoPak — no Hybrid anywhere.
2. Select 15 line IndoPak → confirm a new "IndoPak Dhor/Sabaq Dhor
   terminology" row appears, defaulting to Quarter/Half.
3. Select 13 line or 15 line Madani → confirm that new row disappears.
4. With 15 line IndoPak + Quarter/Half selected, log a Sabaq entry
   spanning a known multi-page range → confirm Lines/Pages matches
   IndoPak's own data (not Madani's) for that range.
5. Switch to 15 line Madani, log the same range → confirm Lines/Pages
   now differs from step 4 (the two 15-line prints genuinely
   distribute lines differently within a page).
6. With 15 line IndoPak + Maqra/Rub'/Hizb selected, check a Dhor
   entry's Juz' position → confirm it matches what 15 line Madani
   itself would show for the same ayah (same underlying boundaries).
7. Switch back to 15 line IndoPak + Quarter/Half → confirm that same
   Dhor entry's Juz' position now matches what plain 13 line would
   show instead.
8. Save the terminology choice, reload Settings → confirm it's
   remembered correctly (not reset to Quarter/Half every time).
9. Confirm nothing elsewhere in the app (History, Journal, existing
   entries) broke for students on 13 line or 15 line Madani — this
   should be a purely additive change for them.

## 73. Fixed: editing/splitting an older Sabaq entry could rewind real progress (V3.36.1)

1. Log a Sabaq entry normally, then another continuing from it → confirm
   the card still prepopulates correctly from the latest one (normal
   progress still advances as expected).
2. Note the current prepopulated From/To values (the real frontier).
3. Open History, edit an OLDER entry (not the most recent one) → change
   its range slightly and save → confirm the card's prepopulated From/To
   are unchanged from step 2.
4. Create a genuinely new entry for an already-passed, older range
   (simulating a split/backfill) → save it → confirm the card's
   prepopulated From/To are STILL unchanged from step 2 — this is the
   actual bug scenario.
5. Now log a real, new entry that genuinely continues past the frontier
   from step 2 → confirm it correctly advances this time.
6. If a student is on Juz' 30 → repeat steps 3-5 in that context, since
   its backward study order is handled by separate logic — confirm
   both a genuine advance and a non-advancing backfill entry behave
   correctly there too.

## 74. 13-line/IndoPak Juz' boundaries corrected (V3.36.2)

1. On 13-line or IndoPak with Quarter/Half selected, log a Sabaq entry
   ending right at one of the 5 changed points (e.g. 5:82 or 5:83,
   near Juz' 6/7's new boundary) → confirm the Juz' it's now
   attributed to matches the corrected boundary, not the old one.
2. Check Sabaq Dhor's own section list for a student near one of these
   5 points → confirm the current/completed quarter sections reflect
   the corrected Juz' opening point.
3. Confirm nothing changed for any of the other 25 Juz' boundaries —
   this should be invisible for the large majority of students.
4. Confirm 15-line Madani is completely unaffected — this only touches
   the Waterval-sourced boundary data.

## 75. Maqra added to Sabaq Dhor for the 15-line Madani model (V3.36.3)

1. On 15-line Madani, open Sabaq Dhor → confirm it defaults to showing
   Maqra-level rows (up to 8, "Maqra 1" through the current one), not
   Quarter-level.
2. Tap the rollup chevron to merge up → confirm it moves to Quarter
   level (2 Maqras become 1 Quarter row), matching what Quarter already
   showed before this change.
3. Continue merging up → confirm Half, then Full, still work exactly
   as before.
4. Split back down from Full → confirm it steps back down through
   Half → Quarter → Maqra correctly, one level at a time.
5. On 13-line or IndoPak with Quarter/Half selected → confirm the
   rollup chevron only ever shows Quarter/Half/Full — no Maqra option
   appears, and default behavior is completely unchanged from before
   this version.
6. If a student is on Juz' 30 → confirm Maqra's own reverse study
   order (Maqra 1 is the furthest-along one, not the first) matches
   how Quarter already behaves there.
7. Save a Maqra-level Sabaq Dhor entry → confirm it saves and clears
   correctly, same as any other level.
8. Switch a student from Rub'/Hizb to Quarter/Half (or vice versa) →
   confirm the rollup level doesn't carry over incorrectly — no stale
   "Maqra" preference should ever appear while on Quarter/Half.

## Smoke test (quick re-check after a production merge)

Not the full suite above — just enough to confirm the merge didn't break
anything obviously:
1. Login with the test student → succeeds
2. Save one entry → succeeds, reads back correctly
3. Check `attendance` shows `present` for that date

If all three pass, production is healthy. If anything fails, that's the
signal to look closer — not a reason to assume it's fine and move on.

## V3.85.1 — summary header (FRONTEND ONLY — upload, hard-refresh)

Login card shows 3.85.1. The summary page's name, attendance icon and X sit on ONE row, aligned to the table's width; the attendance icon is clearly tappable now.

## V3.85.0 — the batch of four (WORKER FIRST, then frontend; no migration)

Cache name is `hifzhelper-v3.85.0`; the login card should show 3.85.0.

1. **Summary → tap a name**: a full-page summary opens — her name in the header, the PJ journal's shape (recent days, weekly rollups, Load more), maktab entries only. The day rail is back to THREE cards. Tap a date row → that day's cards; tap the attendance icon in the header → her attendance page.
2. **Maktab Settings → General**: rows read label-left like the schematic. Time Zone is one field — tap it, pick the device zone or type one: the chooser CLOSES and the field shows the choice; nothing about the device's zone stays on screen. Save; reload; the zone holds.
3. **Attendance page**: the data sits on a card; the range reads "Choose a custom date range from … to …". With min-students above your logging, the card now SAYS "No maktab days in this period (fewer than N students logged per day)".
4. **Any log card**: the History button now sits at the BOTTOM below Notes, next to a new "Notes history" button — one list of your notes and teacher feedback by date. On the Dhor card, Plan/Add-Juz moved up beside the date.
5. **Privacy spot-check**: a private note never shows in a teacher's Notes history; teachers_only feedback never shows in the student's.

## V3.84.0 — the header-cell search (FRONTEND ONLY — upload, hard-refresh)

Cache name is `hifzhelper-v3.84.0`; the login card should show 3.84.0.

1. **Maktab summary**: no search bar above the table any more. The green "Student" header shows a small search glyph.
2. **Tap "Student"**: it becomes a compact search box in the cell. Type — matches drop down under it; picking one opens her day view on the summary's picked date, and the header goes back to "Student".
3. **Esc or tap anywhere else**: the box closes back to the label.

## V3.83.0 — (k) the merge (WORKER FIRST, then frontend; no migration)

Cache name is `hifzhelper-v3.83.0`; the login card should show 3.83.0.

1. **Her Journal (a student the maktab logs for)**: maktab entries now appear among her own, in date order. Her OWN entries carry the green edge + tint; maktab entries are plain. A day both logged shows BOTH.
2. **Tap a cell whose latest entry is the maktab's**: the entries popup opens — the maktab row is plain with the teacher's name under it, not tappable; her own rows in the popup still open the editor.
3. **History rail on any card (her PJ)**: maktab rows show the teacher's name and have NO edit pencil; her rows keep it.
4. **Dhor card prepop**: after the maktab logs her dhor, her own card's suggested next continues from THAT, not from her older personal entry.
5. **Teacher side unchanged**: the maktab summary, day cards and student summary card look exactly as before (the merge added nothing maktab-side).
6. **Marker choice**: if the edge+tint isn't the one, say so — options B (a small "PERSONAL" chip) and C (coloured text) are one comment-swap away in css/journal-table.css.

## V3.82.1 — hotfix (upload this build; replaces V3.80.0–V3.82.0 uploads)

Cache name is `hifzhelper-v3.82.1`; login card shows 3.82.1. The app loading AT ALL past the login screen is the test — then run the V3.80.0, V3.81.0 and V3.82.0 checklists below against this build.

## V3.82.0 — the student summary card (FRONTEND ONLY — upload, hard-refresh)

Cache name is `hifzhelper-v3.82.0`; the login card should show 3.82.0.

1. **Summary → tap a student's NAME**: the day rail opens on a fourth card — "Summary", her maktab record by date, newest first. Swipe left: Dhor, Sabaq Dhor, Sabaq are all there; four dots now.
2. **Tap her SABAQ cell** instead: the rail opens on the Sabaq card. Sabaq Dhor and Dhor cells likewise. Tapping the row anywhere else: Sabaq, as before.
3. **On the summary card, tap a date row**: the rail jumps to that day's cards (the date pills follow).
4. **Your own PJ day cards**: three cards, three dots — no summary card outside the maktab.
5. **A student's Maktab Journal → tap a day**: she gets the fourth card too, read-only.

## V3.81.0 — the dhor juz-range (FRONTEND ONLY — upload, hard-refresh)

Cache name is `hifzhelper-v3.81.0`; the login card should show 3.81.0.

1. **Dhor card, unit on Full/Juz**: a second select appears after Juz — a dash by default. Other units: it's gone.
2. **Pick Juz 11 "to Juz 14"**, set 40:00 on the timer or duration, 6 mistakes, two tags, a note → Save once. History shows FOUR entries for the date: Juz 11–14, 10:00 each, mistakes 2/2/1/1, the same tags and note on each.
3. **Edit one of the four** — it edits alone; the others are untouched.
4. **The dash** saves exactly as before — one entry.
5. **Maktab mode**: same flow on a student's dhor card writes her four maktab entries.

## V3.80.0 — the attendance page (⚠ MIGRATION 0025 in the D1 console FIRST, then worker, then frontend)

Cache name is `hifzhelper-v3.80.0`; the login card should show 3.80.0. 0025 is two lines (console-safe copy provided).

1. **Set the term**: Maktab Settings → General → Current term from/to → Save.
2. **Summary**: every student now carries the attendance icon (not just haa'idah). Tap one → her attendance page: the %, "present N of M maktab days", the period labelled "(current term)".
3. **Custom period**: change the dates, Apply — the % recalculates, "(custom)" shows, "back to default" returns to the term.
4. **Absent days**: the button names the count; tapping lists the dates. A day the maktab didn't meet never appears.
5. **Haa'idah**: the haidh calendar sits below with everything it had (range marking, the teacher's three-way decision), and her last 3 haidh ranges under it. A non-haa'idah page shows no haidh section.
6. **The student**: her menu shows **Attendance** (every student — the old Haidh item is inside it now). Her own page, her own calendar; no teacher controls.
7. **The old route**: nothing links to a standalone haidh screen any more; if a bookmark lands oddly, hard-refresh.

## V3.79.0 — the settings rail (⚠ MIGRATION 0024 in the D1 console FIRST, then worker, then frontend)

Cache name is `hifzhelper-v3.79.0`; the login card should show 3.79.0. 0024 is one line: `ALTER TABLE maktab_groups ADD COLUMN description TEXT;` (console-safe copy provided).

1. **The rail**: Maktab Settings opens on General; swipe or tap the pills to reach Tajweed and Groups; the close button exits as before. On a wide screen all three cards sit side by side.
2. **Timezone, one tap**: General shows the current zone (or "Not set"). Tap "Use this device's timezone (…)" — the shown value changes but nothing saves until SAVE. Save, reload: it stuck. "clear" + Save returns to Not set. "choose a different zone" → type a few letters → pick → Save.
3. **Tags**: tap into a name, change it, tap away — saved instantly (reopen an entry using that tag: new name). Tap MINOR on a major tag: flips instantly. Tick Retire: struck through, gone from the picker on new entries; untick restores. Add adds instantly, minor by default.
4. **Groups**: same, plus the description field — type, tap away, reload: still there. It appears nowhere else in the app.
5. **A duplicate name** (rename a tag to an existing one): the error shows on that card and the old name comes back.

## V3.78.0 — delivery 3 (⚠ MIGRATION 0022 in the D1 console FIRST, then worker, then frontend; 0023 LATER)

Cache name is `hifzhelper-v3.78.0`; the login card should show 3.78.0.

1. **Old tags survived**: open an old entry that had tajweed tags — the picker shows the same names (now backed by IDs). **Only after this is seen**, run migration 0023 by hand.
2. **Maktab Settings**: the timezone select (pick your zone), the Groups list, the Tajweed tags list. Add a group; add a tag; rename a tag by tapping its name — reopen any entry using it and the new name shows. Retire a tag — it vanishes from the picker on fresh entries but stays on the old entry.
3. **Groups on the summary**: assign two students to a group on their Admin cards. The summary re-orders — grouped students first (alphabetical within), a clear gap between groups, ungrouped last.
4. **Search**: type part of a name above the summary; pick her — the day view opens on the summary's date (set the picker to yesterday first to see the date carry).
5. **Timezone in effect**: with the zone set, the summary's default day and the haidh calendars' "today" follow the maktab's clock on any device (visible if a device's zone differs; otherwise trust the harness).
6. **Student side**: her PJ cards' picker offers the same tags; she cannot see Maktab Settings.

## V3.77.0 — (j) Account separation (DEPLOY THE WORKER FIRST, then frontend, hard-refresh)

Cache name is `hifzhelper-v3.77.0`; the login card should show 3.77.0. No migration; the ADMIN-01 discard was run on 17 Aug.

1. **Summary** (as ADMIN-01): ADMIN-01 no longer appears as a student row. Only real students, alphabetical.
2. **Admin list**: ADMIN-01's row carries an `admin` chip; student rows carry none.
3. **Create a teaching profile**: open a student who teaches (say Umme) → **Create teaching profile** → confirm. Banner names the new id (`<her id>TEACHER`); the list now has "Umme (Teacher)" with a `teacher` chip. Open Umme again: the button is gone, her card notes the teaching id. Open the teaching row: it names whose it is, no button.
4. **Her first teaching login**: from the menu → **Switch account** → the chips (this device knows only the accounts that have signed in here, so the new one is not there yet) → **Use another ID** → type the teaching id → the create-PIN screen. Set a PIN. She lands on the summary; the menu has no PJ items.
5. **Switch account** now shows both her chips, the teaching one tagged `teacher`. Tap the student chip → PIN screen for it (PIN asked every time). Tap × on a chip → gone from this device only.
6. **The teaching account has no journal**: no Summary/Detail/Tadabbur/Settings/Haidh in its menu; the student row is unchanged.
7. **updateLog**: not reachable from the UI (the date pickers only produce valid dates) — worker-tested.

## V3.76.2 — the teacher's decision bar (DEPLOY THE WORKER FIRST, then frontend, hard-refresh)

Cache name is `hifzhelper-v3.76.2`; the login card should show 3.76.2.

1. **Maktab calendar, a range starting within 14 days of a real period** → Confirm. Instead of the red line, the bar under the calendar changes to the message plus three buttons; the selected days stay highlighted.
2. **Adjust dates** → the Cancel / Confirm bar returns, selection still there. Tapping any day while the decision bar is up does the same and starts a fresh selection.
3. **Mark as haidh anyway** → the range is written as haidh (yellow on the summary for those dates).
4. **Mark absent** → the range is written absent; nothing yellow. (Her PJ calendar shows nothing for those days — absent is not painted there.)
5. **A range longer than her ruling allows** → the plain red line, no decision bar; and if you reach it via "haidh anyway" it is still refused.
6. **Her own calendar** (log in as her): the same gap case is the plain red line. No decision bar.

## V3.76.1 — haidh prediction fix (DEPLOY THE WORKER; frontend is the stamp only)

1. **The device case** — Umme, August: with the 5 Sep prediction still there, mark 27–31 Aug. Accepted; on reload the 5 Sep pink square is GONE (it fell inside the 14 days after the range). A prediction further out than 14 days after the range would remain.
2. **Still refused, correctly** — try to mark a range that starts within 14 days after a REAL period: same message as before.
3. **Login card** shows 3.76.1 after the frontend upload and a hard refresh.

## V3.76.0 — Phase 2: the maktab haidh calendar (DEPLOY THE WORKER FIRST, then frontend, hard-refresh)

Cache name is `hifzhelper-v3.76.0`; the login card should show 3.76.0.

1. **Worker first.** Until the worker is deployed, confirming a range from the maktab calendar writes it on the TEACHER's own attendance (the old handler ignored `student_id`). Deploy the worker, then the frontend.
2. **Summary → haidh icon** (a tracking student, any date on the picker) — opens a calendar headed "Haidh — <her name>", on the month of the picked date, showing HER marks. The row tap still opens the day view.
3. **Mark a range** — tap first day, tap last day, "Confirm as haidh" (or "Predict as haidh" if entirely future). Back on the summary the icon shows marked for any date inside the range; her own PJ calendar (log in as her) shows the same days.
4. **Clear one day** — tap a marked day with no pending selection: it clears, and the summary follows.
5. **The refusal** — try a range starting within 14 days of an earlier mark: the calendar's red line shows the worker's message and the selection stays so you can adjust it. This replaces the old "15 days has not passed… cancel to mark absent" confirm — there is no override now.
6. **Context does not leak** — from the maktab calendar press X (Home), then open any PJ screen as a student account: plain "Haidh" heading, her own data.
7. **Student's own calendar** (nav → Haidh) — unchanged: own data, own writes.

## V3.75.0 — Phase 1: what to look at on the device (frontend only, hard-refresh first)

Cache name is `hifzhelper-v3.75.0`; the login card should show 3.75.0.

1. **Admin** — icon and "Admin" together on the left, the X on the SAME row at the right (it was on its own row below, centred).
2. **Tadabbur and Haidh** (student account) — same: the X on the header row, not stranded below. Both were broken since V3.74.2.
3. **Sabaq Dhor card** — a juz with fewer than four complete quarters shows NO Move button at all. At four it appears as "Move Juz N to Dhor". Confirm still fires; cancel does nothing.
4. **Teacher note pill** (Public/Teachers/Private) — visibly shorter, a flat pill not a tall track. It lands at 20px; say if you want another height.
5. **Summary `+1`** — tap it: a small list of that cell's entries opens and the day view does NOT. Tap elsewhere: it closes. Tap the row: the day view opens as before.
6. **Haidh failure** — if marking haidh fails, the alert now ends with the worker's reason (e.g. the role or tracking message) instead of a bare "Could not save".
7. **History rail** (maktab day view) — each entry shows the confirming teacher's name under it. Nothing new on a student's own PJ.
8. **Note box** — sits a clear gap below the section above it.

## V3.68.0 — delivery (i): what the harnesses CANNOT check

381 automated checks cover the pool-merge logic, the routing scan and the
context round-trips. They cannot see a rendered screen or a real deploy.
These are the things to check by hand, in this order.

**Deploy order first, because there is a real window.** The frontend no
longer writes the Dhor pool; the worker now does. Deploy the WORKER FIRST.
If the frontend goes up first, nobody writes the pool at all and it fails
silently — exactly the fault this delivery removes. **Immediately after
deploying, log one Dhor and confirm the pool grew** (the next Dhor prepop
should advance to the following portion). That one action proves the
handover landed.

**1. Hard-refresh first.** `index.html` version strings and the service
worker cache name both went to 3.68.0. If any screen behaves oddly, confirm
you are not on cached JS before treating it as a bug.

**2. Tadabbur history — the highest regression risk in this delivery.**
`renderRecentEntries` lost its client argument, so every caller's arguments
shifted position, and Tadabbur is the only one passing a third
(`showTadabburReadView`). Open Tadabbur → History → **tap a row's content
area**. The read view must open. If the arguments were mis-ordered this is
where it shows.

**3. History rails in the personal journal (regression check).** Open Sabaq,
Sabaq Dhor and Dhor. Each rail must list YOUR entries as before, and the
History button must open the full list. Nothing should have changed —
that is the point.

**4. History rails in the maktab — the headline fix.** As a teacher, open a
student's card. Each rail must show **that student's** entries, not your
own. Before this delivery it showed yours. Check with a student whose
history differs visibly from yours, or the test proves nothing.

**5. The Dhor pool goes to the right person.** As a teacher, log a Dhor for
a student. Then: (a) that student's Dhor prepop advances; (b) **your own**
Dhor prepop and Juz Tracker are unchanged. Before this delivery, logging for
a student grew YOUR pool. (b) is the assertion that matters.

**6. Sabaq auto-move and Sabaq Dhor rollup.** Both write the pool through
the new routed writer. Trigger a sabaq that auto-moves the previous juz to
Dhor, and a Sabaq Dhor move-to-Dhor. Confirm the pool updates — in the PJ
against your own, and in the maktab against the student's.

**7. Removal still works, and stays removed.** In Hifz Setup (or maktab
student setup) remove a juz from the pool. Log a Dhor in a DIFFERENT juz.
The removed juz must stay removed. Removing juz is a legitimate action and
the merge must never resurrect it — the harness asserts this, but confirm it
end to end once.

**8. Juz Tracker in maktab context.** Its profile reads and pool write are
now routed. Worth one look: if it is reachable while a student's day view is
open, it must show that student's pool, not yours. If navigating to it
clears the context and it always runs in PJ mode, note that — the routing
there is then harmless but unexercised, which is worth knowing.

**Not checkable here, by design:** nothing in this delivery touches the
schema, so there is no migration to run and no data shape to verify.
