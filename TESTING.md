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

## Smoke test (quick re-check after a production merge)

Not the full suite above — just enough to confirm the merge didn't break
anything obviously:
1. Login with the test student → succeeds
2. Save one entry → succeeds, reads back correctly
3. Check `attendance` shows `present` for that date

If all three pass, production is healthy. If anything fails, that's the
signal to look closer — not a reason to assume it's fine and move on.
