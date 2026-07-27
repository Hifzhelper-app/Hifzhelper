# Apps Script to Google Sheets Migration Ledger

Last verified: 2026-07-20  
Production milestone: V97.1.3

This ledger records backend ownership at the operation level. A feature can have
direct Google Sheets reads while its writes remain on Apps Script.

## Status definitions

- **DIRECT**: the Worker calls the Google Sheets API and owns the operation.
- **APPS SCRIPT**: the Worker still calls an action in `code.gs`.
- **LEGACY ROLLBACK**: the direct route is live, but the matching `code.gs`
  implementation and `doPost` action are deliberately retained for rollback.
- **DIRECT ONLY**: the operation was introduced on the direct Worker path and
  has no `code.gs` implementation.

## Current production ownership

| Area | Operation / Apps Script action | Development | Production | `code.gs` status |
|---|---|---:|---:|---|
| Resources | `getStudentResources` | DIRECT | DIRECT | LEGACY ROLLBACK |
| Timetable | `getTimetable` | DIRECT | DIRECT | LEGACY ROLLBACK |
| Timetable | `updateTimetableZoomLink` | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Weekly Planner | health, teachers, get and save | DIRECT ONLY | DIRECT ONLY | Not present |
| Authentication | student/admin lookup, login, PIN setup and reset | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Attendance | `submitAbsentStudents`, `getStudentsForAttendance`, `getAttendanceReport` | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Progress | student-task reads, status updates, verification and reports | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Student management | duplicate check, register, update, search and assignment options | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Curriculum | subject, task and curriculum-resource management | APPS SCRIPT | APPS SCRIPT | ACTIVE |
| Task assignment | assignment and population actions | APPS SCRIPT | APPS SCRIPT | ACTIVE |

## Migrated operations

### Resources read

- Worker implementation: `backend/src/routes/resources.js`
- Router feature: `resources`
- Routing variable: `M4L_BACKEND_RESOURCES=google-sheets`
- Legacy rollback action: `getStudentResources`
- Production verification: direct Google Sheets response returned HTTP 200 with
  `X-M4L-Backend: google-sheets`.

### Timetable read

- Worker implementation: `backend/src/routes/timetable.js`
- Router feature: `timetable-read`
- Routing variable: `M4L_BACKEND_TIMETABLE_READ=google-sheets`
- Legacy rollback action: `getTimetable`
- Production verification: V97.1.3 returned HTTP 200 with
  `X-M4L-Backend: google-sheets` and
  `X-M4L-Backend-Source: M4L_BACKEND_TIMETABLE_READ`.
- `updateTimetableZoomLink` is a separate write operation and remains on Apps
  Script.

### Weekly Planner

- Worker implementation: `backend/src/routes/weekly-planner.js`
- Router feature: `weekly-planner`
- Backend: direct Google Sheets only
- No Apps Script action was migrated because Weekly Planner was implemented on
  the direct path.

## Change history

### 2026-07-20 — V97.1.3

- Activated direct timetable reads in production.
- Kept timetable Zoom-link writes on Apps Script.
- Verified production routing, Apps Script connectivity, Resources, timetable
  reads and Weekly Planner with five HTTP 200 checks.

### 2026-07-20 — V97.1.2

- Made Wrangler the source of truth for environment-specific plaintext
  configuration.
- Restored explicit production/development Apps Script URLs and spreadsheet IDs.
- Kept encrypted service-account, PIN and session values in Cloudflare secrets.

### 2026-07-19 — V97

- Activated direct Resources reads.
- Retained `getStudentResources` in `code.gs` as the rollback implementation.

### Existing direct ownership

- Weekly Planner reads and writes use the direct Google Sheets client.
- Weekly Planner has no Apps Script fallback.

## Required migration procedure

For every future operation:

1. Record reads and writes separately in this ledger.
2. Add and test the direct Worker implementation.
3. Keep the Apps Script action active while development uses the routing flag.
4. Verify the direct route in development.
5. Activate and verify the production routing flag.
6. Mark the Apps Script action **LEGACY ROLLBACK** only after production passes.
7. Remove the `doPost` action and its implementation together only after the
   rollback path is explicitly retired.
## V97.1.8.6 — Weekly Planner Drive configuration
- Kept Weekly Planner records on the direct Google Sheets API.
- Kept only the Google Drive PNG submission in Apps Script.
- Moved the Drive folder ID, label and URL to the global configuration constants.
- Drive save responses return destination label and URL to the frontend.

