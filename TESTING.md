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

## Smoke test (quick re-check after a production merge)

Not the full suite above — just enough to confirm the merge didn't break
anything obviously:
1. Login with the test student → succeeds
2. Save one entry → succeeds, reads back correctly
3. Check `attendance` shows `present` for that date

If all three pass, production is healthy. If anything fails, that's the
signal to look closer — not a reason to assume it's fine and move on.
