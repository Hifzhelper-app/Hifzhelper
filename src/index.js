import { json, error } from './utils.js';
import { handleLogin, authenticate } from './auth.js';
import { handleGetSabaq, handleSaveSabaq, handleUpdateSabaq, handleDeleteSabaq } from './sabaqLog.js';
import { handleGetSabaqDhor, handleSaveSabaqDhor, handleUpdateSabaqDhor, handleDeleteSabaqDhor } from './sabaqDhorLog.js';
import { handleGetDhor, handleSaveDhor, handleUpdateDhor, handleDeleteDhor } from './dhorLog.js';
import { handleGetReflections, handleSaveReflection, handleUpdateReflection, handleDeleteReflection } from './reflections.js';
import { handleGetPlans, handleCreatePlan, handleUpdatePlan, handleDeletePlan } from './plans.js';
import { handleGetAttendance, handleSetAttendance, handlePredictHaidh, handleDeleteAttendance } from './attendance.js';
import { handleGetPosition, handleSavePosition } from './position.js';
import { handleGetProfile, handleSaveProfile } from './profile.js';
import { handleListUsers, handleResetPin, handleChangeRole, handleRegisterStudent } from './admin.js';

// Every handler returns { data } or { error, status } — this file's only job
// is routing + turning that plain object into a real Response, and making
// sure nothing throws past this point without becoming a real error response
// (CONVENTIONS.md principle 3: no silent fallbacks).
function respond(result) {
  if (result.error) return error(result.error, result.status || 400);
  return json(result.data);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public route — no auth required.
      if (path === '/auth/login' && request.method === 'POST') {
        return respond(await handleLogin(request, env));
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

      if (path === '/plans' && request.method === 'GET') return respond(await handleGetPlans(request, env, auth));
      if (path === '/plans' && request.method === 'POST') return respond(await handleCreatePlan(request, env, auth));
      if (path === '/plans' && request.method === 'PATCH') return respond(await handleUpdatePlan(request, env, auth));
      if (path === '/plans' && request.method === 'DELETE') return respond(await handleDeletePlan(request, env, auth));

      if (path === '/attendance' && request.method === 'GET') return respond(await handleGetAttendance(request, env, auth));
      if (path === '/attendance' && request.method === 'POST') return respond(await handleSetAttendance(request, env, auth));
      if (path === '/attendance' && request.method === 'DELETE') return respond(await handleDeleteAttendance(request, env, auth));
      if (path === '/attendance/predict' && request.method === 'POST') return respond(await handlePredictHaidh(request, env, auth));

      if (path === '/position' && request.method === 'GET') return respond(await handleGetPosition(request, env, auth));
      if (path === '/position' && request.method === 'POST') return respond(await handleSavePosition(request, env, auth));

      if (path === '/profile' && request.method === 'GET') return respond(await handleGetProfile(request, env, auth));
      if (path === '/profile' && request.method === 'POST') return respond(await handleSaveProfile(request, env, auth));

      if (path === '/admin/users' && request.method === 'GET') return respond(await handleListUsers(request, env, auth));
      if (path === '/admin/reset-pin' && request.method === 'POST') return respond(await handleResetPin(request, env, auth));
      if (path === '/admin/change-role' && request.method === 'POST') return respond(await handleChangeRole(request, env, auth));
      if (path === '/admin/register-student' && request.method === 'POST') return respond(await handleRegisterStudent(request, env, auth));

      return error('Not found', 404);
    } catch (err) {
      // Never let an unexpected error look like a normal empty response —
      // surface it. (CONVENTIONS.md principle 3.)
      console.error('Unhandled error:', err);
      return error('Internal error', 500);
    }
  }
};
