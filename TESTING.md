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

## 2. Entries

Requires `Authorization: Bearer <token>` from a successful login above.

| Test | Request | Expect |
|---|---|---|
| Save an entry | `POST /entries` `{"date":"2026-07-18","sabaq_surah":67,"sabaq_ayah_from":1,"sabaq_ayah_to":5,"sabaq_lines":10}` | `200 {"saved": true}` (defaults to `entry_number: 1`) |
| Read it back | `GET /entries` | array containing that entry, fields matching what was sent |
| Update same day, same entry_number | POST again with the same `date`, different `sabaq_lines` | `200`, then GET shows the *updated* value, not a second row |
| Second entry, same day | `POST /entries` `{"date":"2026-07-18","entry_number":2,"sabaq_surah":68,"sabaq_ayah_from":1,"sabaq_ayah_to":3}` | `200`; GET now shows **two** rows for that date, `entry_number` 1 and 2 |
| Invalid entry_number | `POST /entries` `{"date":"2026-07-18","entry_number":3,...}` | `400 entry_number must be 1 or 2` |
| Delete one entry_number only | `DELETE /entries?date=2026-07-18&entry_number=2` | `200`; GET still shows `entry_number: 1` for that date — deleting entry 2 must never remove entry 1 |
| Delete remaining entry | `DELETE /entries?date=2026-07-18&entry_number=1` (or omit `entry_number`, defaults to 1) | `200`; GET shows no rows for that date |
| No token | any of the above, with the `Authorization` header removed | `401 Not authenticated` |

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

## Smoke test (quick re-check after a production merge)

Not the full suite above — just enough to confirm the merge didn't break
anything obviously:
1. Login with the test student → succeeds
2. Save one entry → succeeds, reads back correctly
3. Check `attendance` shows `present` for that date

If all three pass, production is healthy. If anything fails, that's the
signal to look closer — not a reason to assume it's fine and move on.
