import { json, error } from './utils.js';
import { handleLogin, handleRegister, handleLookup, authenticate } from './auth.js';
import { handleGetSabaq, handleSaveSabaq, handleUpdateSabaq, handleDeleteSabaq } from './sabaqLog.js';
import { handleGetSabaqDhor, handleSaveSabaqDhor, handleUpdateSabaqDhor, handleDeleteSabaqDhor } from './sabaqDhorLog.js';
import { handleGetDhor, handleSaveDhor, handleUpdateDhor, handleDeleteDhor } from './dhorLog.js';
import { handleGetReflections, handleSaveReflection, handleUpdateReflection, handleDeleteReflection } from './reflections.js';
import {
  handleGetMaktabSabaq, handleSaveMaktabSabaq, handleUpdateMaktabSabaq, handleDeleteMaktabSabaq,
  handleGetMaktabSabaqDhor, handleSaveMaktabSabaqDhor, handleUpdateMaktabSabaqDhor, handleDeleteMaktabSabaqDhor,
  handleGetMaktabDhor, handleSaveMaktabDhor, handleUpdateMaktabDhor, handleDeleteMaktabDhor,
  handleMaktabSummary, handleMaktabDhorDefault,
  handleGetMaktabPosition, handleSaveMaktabPosition,
} from './maktabLog.js';
import { handleGetMaktabSettings, handleSaveMaktabSettings } from './maktabSettings.js';
import { handleMaktabAttendance, handleAttendancePage, handleMaktabWeek } from './maktabAttendance.js';
import { handleGetTerms, handleCreateTerm, handleUpdateTerm, handleDeleteTerm, handleGetCalendar, handleCreateCalendarEntry, handleUpdateCalendarEntry, handleDeleteCalendarEntry, handleGetProposal, handleConfirmList } from './maktabCalendar.js';   // V3.87.0/V3.88.0
import { handleGetPlans } from './plans.js';
import { handleGetAttendance, handleSetAttendance, handleMarkHaidhRange, handlePredictHaidh, handleDeleteAttendance } from './attendance.js';
import { handleGetPosition, handleSavePosition } from './position.js';
import { handleGetProfile, handleSaveProfile } from './profile.js';
import { handleGetDhorDefaultEntry, handleGetUpcomingDhorQueue } from './dhorSchedule.js';
import { handleListUsers, handleCreateTeachingProfile, handleResetPin, handleChangeRole, handleRegisterStudent, handleUpdateUser, handleDeleteUser } from './admin.js';
import { handleGetTajweedTags, handleCreateTajweedTag, handleUpdateTajweedTag, handleGetMaktabGroups, handleCreateMaktabGroup, handleUpdateMaktabGroup } from './lists.js';   // V3.78.0

// Every handler returns { data } or { error, status } — this file's only job
// is routing + turning that plain object into a real Response, and making
// sure nothing throws past this point without becoming a real error response
// (CONVENTIONS.md principle 3: no silent fallbacks).
function respond(result) {
  if (result.error) return error(result.error, result.status || 400, result.code);   // V3.76.2: code passes through
  return json(result.data);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'   // PUT: V3.88.2 — the term/calendar editors are the app's first PUTs; its absence made the browser block them at preflight (the user's "network error")
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public routes — no auth required.
      if (path === '/auth/login' && request.method === 'POST') {
        return respond(await handleLogin(request, env));
      }
      if (path === '/auth/register' && request.method === 'POST') {
        return respond(await handleRegister(request, env));
      }
      if (path === '/auth/lookup' && request.method === 'GET') {
        return respond(await handleLookup(request, env));
      }

      // Everything past this point requires a valid token.
      const auth = await authenticate(request, env);
      if (!auth) return error('Not authenticated', 401);

      // V2: four independent logs, replacing the old single /entries route.
      // GET/POST list+create; PATCH adds/updates a comment on an existing
      // row (reflections has no comment concept, so no PATCH there);
      // DELETE removes by id (no more date+entry_number — V2 has no caps,
      // every row has its own real primary key).
      if (path === '/sabaq' && request.method === 'GET') return respond(await handleGetSabaq(request, env, auth));
      if (path === '/sabaq' && request.method === 'POST') return respond(await handleSaveSabaq(request, env, auth));
      if (path === '/sabaq' && request.method === 'PATCH') return respond(await handleUpdateSabaq(request, env, auth));
      if (path === '/sabaq' && request.method === 'DELETE') return respond(await handleDeleteSabaq(request, env, auth));

      if (path === '/sabaq-dhor' && request.method === 'GET') return respond(await handleGetSabaqDhor(request, env, auth));
      if (path === '/sabaq-dhor' && request.method === 'POST') return respond(await handleSaveSabaqDhor(request, env, auth));
      if (path === '/sabaq-dhor' && request.method === 'PATCH') return respond(await handleUpdateSabaqDhor(request, env, auth));
      if (path === '/sabaq-dhor' && request.method === 'DELETE') return respond(await handleDeleteSabaqDhor(request, env, auth));

      if (path === '/dhor' && request.method === 'GET') return respond(await handleGetDhor(request, env, auth));
      if (path === '/dhor' && request.method === 'POST') return respond(await handleSaveDhor(request, env, auth));
      if (path === '/dhor' && request.method === 'PATCH') return respond(await handleUpdateDhor(request, env, auth));
      if (path === '/dhor' && request.method === 'DELETE') return respond(await handleDeleteDhor(request, env, auth));

      if (path === '/reflections' && request.method === 'GET') return respond(await handleGetReflections(request, env, auth));
      if (path === '/reflections' && request.method === 'POST') return respond(await handleSaveReflection(request, env, auth));
      if (path === '/reflections' && request.method === 'PATCH') return respond(await handleUpdateReflection(request, env, auth));
      if (path === '/reflections' && request.method === 'DELETE') return respond(await handleDeleteReflection(request, env, auth));

      // Maktab logs (V3.58.0, maktab delivery (d)) — teacher-confirmed
      // records, independent of the PJ routes above. Requires migration
      // 0019 to have been run; see worker/src/maktabLog.js.
      if (path === '/maktab/settings' && request.method === 'GET') return respond(await handleGetMaktabSettings(request, env, auth));
      if (path === '/maktab/settings' && request.method === 'POST') return respond(await handleSaveMaktabSettings(request, env, auth));
      if (path === '/maktab/position' && request.method === 'GET') return respond(await handleGetMaktabPosition(request, env, auth));
      if (path === '/maktab/position' && request.method === 'POST') return respond(await handleSaveMaktabPosition(request, env, auth));
      if (path === '/maktab/attendance' && request.method === 'GET') return respond(await handleMaktabAttendance(request, env, auth));
      if (path === '/maktab/summary' && request.method === 'GET') return respond(await handleMaktabSummary(request, env, auth));
      if (path === '/maktab/dhor-default-entry' && request.method === 'GET') return respond(await handleMaktabDhorDefault(request, env, auth));
      // V3.87.0: the maktab calendar — terms drive attendance; entries are info-only
      // V3.98.0: the maktab Attendance screen — one week of columns
      if (path === '/maktab/attendance-week' && request.method === 'GET') return respond(await handleMaktabWeek(request, env, auth));
      if (path === '/maktab/terms' && request.method === 'GET') return respond(await handleGetTerms(request, env, auth));
      if (path === '/maktab/terms' && request.method === 'POST') return respond(await handleCreateTerm(request, env, auth));
      {
        const m = path.match(/^\/maktab\/terms\/(\d+)$/);
        if (m && request.method === 'PUT') return respond(await handleUpdateTerm(request, env, auth, parseInt(m[1])));
        if (m && request.method === 'DELETE') return respond(await handleDeleteTerm(request, env, auth, parseInt(m[1])));
      }
      if (path === '/maktab/calendar' && request.method === 'GET') return respond(await handleGetCalendar(request, env, auth));
      if (path === '/maktab/calendar' && request.method === 'POST') return respond(await handleCreateCalendarEntry(request, env, auth));
      // V3.88.0: the staged propose → edit → confirm flow (replaced the loaders)
      if (path === '/maktab/calendar/holiday-proposal' && request.method === 'GET') return respond(await handleGetProposal(request, env, auth, 'holiday'));
      if (path === '/maktab/calendar/islamic-proposal' && request.method === 'GET') return respond(await handleGetProposal(request, env, auth, 'islamic'));
      if (path === '/maktab/calendar/confirm' && request.method === 'POST') return respond(await handleConfirmList(request, env, auth));
      {
        const m = path.match(/^\/maktab\/calendar\/(\d+)$/);
        if (m && request.method === 'PUT') return respond(await handleUpdateCalendarEntry(request, env, auth, parseInt(m[1])));
        if (m && request.method === 'DELETE') return respond(await handleDeleteCalendarEntry(request, env, auth, parseInt(m[1])));
      }
      if (path === '/maktab/sabaq' && request.method === 'GET') return respond(await handleGetMaktabSabaq(request, env, auth));
      if (path === '/maktab/sabaq' && request.method === 'POST') return respond(await handleSaveMaktabSabaq(request, env, auth));
      if (path === '/maktab/sabaq' && request.method === 'PATCH') return respond(await handleUpdateMaktabSabaq(request, env, auth));
      if (path === '/maktab/sabaq' && request.method === 'DELETE') return respond(await handleDeleteMaktabSabaq(request, env, auth));

      if (path === '/maktab/sabaq-dhor' && request.method === 'GET') return respond(await handleGetMaktabSabaqDhor(request, env, auth));
      if (path === '/maktab/sabaq-dhor' && request.method === 'POST') return respond(await handleSaveMaktabSabaqDhor(request, env, auth));
      if (path === '/maktab/sabaq-dhor' && request.method === 'PATCH') return respond(await handleUpdateMaktabSabaqDhor(request, env, auth));
      if (path === '/maktab/sabaq-dhor' && request.method === 'DELETE') return respond(await handleDeleteMaktabSabaqDhor(request, env, auth));

      if (path === '/maktab/dhor' && request.method === 'GET') return respond(await handleGetMaktabDhor(request, env, auth));
      if (path === '/maktab/dhor' && request.method === 'POST') return respond(await handleSaveMaktabDhor(request, env, auth));
      if (path === '/maktab/dhor' && request.method === 'PATCH') return respond(await handleUpdateMaktabDhor(request, env, auth));
      if (path === '/maktab/dhor' && request.method === 'DELETE') return respond(await handleDeleteMaktabDhor(request, env, auth));

      if (path === '/plans' && request.method === 'GET') return respond(await handleGetPlans(request, env, auth));

      if (path === '/attendance' && request.method === 'GET') return respond(await handleGetAttendance(request, env, auth));
      if (path === '/attendance' && request.method === 'POST') return respond(await handleSetAttendance(request, env, auth));
      if (path === '/attendance/page' && request.method === 'GET') return respond(await handleAttendancePage(request, env, auth));   // V3.80.0
      if (path === '/attendance/mark-range' && request.method === 'POST') return respond(await handleMarkHaidhRange(request, env, auth));
      if (path === '/attendance' && request.method === 'DELETE') return respond(await handleDeleteAttendance(request, env, auth));
      if (path === '/attendance/predict' && request.method === 'POST') return respond(await handlePredictHaidh(request, env, auth));

      if (path === '/position' && request.method === 'GET') return respond(await handleGetPosition(request, env, auth));
      if (path === '/position' && request.method === 'POST') return respond(await handleSavePosition(request, env, auth));

      if (path === '/profile' && request.method === 'GET') return respond(await handleGetProfile(request, env, auth));
      if (path === '/profile' && request.method === 'POST') return respond(await handleSaveProfile(request, env, auth));

      if (path === '/dhor-schedule/default-entry' && request.method === 'GET') return respond(await handleGetDhorDefaultEntry(request, env, auth));
      if (path === '/dhor-schedule/upcoming' && request.method === 'GET') return respond(await handleGetUpcomingDhorQueue(request, env, auth));

      // V3.78.0 (delivery 3): the two admin-managed lists.
      if (path === '/tajweed-tags' && request.method === 'GET') return respond(await handleGetTajweedTags(request, env, auth));
      if (path === '/tajweed-tags' && request.method === 'POST') return respond(await handleCreateTajweedTag(request, env, auth));
      if (path === '/tajweed-tags/update' && request.method === 'POST') return respond(await handleUpdateTajweedTag(request, env, auth));
      if (path === '/maktab-groups' && request.method === 'GET') return respond(await handleGetMaktabGroups(request, env, auth));
      if (path === '/maktab-groups' && request.method === 'POST') return respond(await handleCreateMaktabGroup(request, env, auth));
      if (path === '/maktab-groups/update' && request.method === 'POST') return respond(await handleUpdateMaktabGroup(request, env, auth));
      if (path === '/admin/users' && request.method === 'GET') return respond(await handleListUsers(request, env, auth));
      if (path === '/admin/reset-pin' && request.method === 'POST') return respond(await handleResetPin(request, env, auth));
      if (path === '/admin/change-role' && request.method === 'POST') return respond(await handleChangeRole(request, env, auth));
      if (path === '/admin/register-student' && request.method === 'POST') return respond(await handleRegisterStudent(request, env, auth));
      if (path === '/admin/create-teaching-profile' && request.method === 'POST') return respond(await handleCreateTeachingProfile(request, env, auth));   // V3.77.0 (j)
      if (path === '/admin/update-user' && request.method === 'POST') return respond(await handleUpdateUser(request, env, auth));
      if (path === '/admin/users' && request.method === 'DELETE') return respond(await handleDeleteUser(request, env, auth));

      return error('Not found', 404);
    } catch (err) {
      // Never let an unexpected error look like a normal empty response —
      // surface it. (CONVENTIONS.md principle 3.)
      console.error('Unhandled error:', err);
      return error('Internal error', 500);
    }
  }
};
