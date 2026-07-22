import { json, error } from './utils.js';
import { handleLogin, authenticate } from './auth.js';
import { handleGetEntries, handleSaveEntry, handleDeleteEntry } from './entries.js';
import { handleGetAttendance, handleSetAttendance, handlePredictHaidh, handleDeleteAttendance } from './attendance.js';
import { handleGetPosition, handleSavePosition } from './position.js';
import { handleGetProfile, handleSaveProfile } from './profile.js';

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
          'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
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

      if (path === '/entries' && request.method === 'GET') return respond(await handleGetEntries(request, env, auth));
      if (path === '/entries' && request.method === 'POST') return respond(await handleSaveEntry(request, env, auth));
      if (path === '/entries' && request.method === 'DELETE') return respond(await handleDeleteEntry(request, env, auth));

      if (path === '/attendance' && request.method === 'GET') return respond(await handleGetAttendance(request, env, auth));
      if (path === '/attendance' && request.method === 'POST') return respond(await handleSetAttendance(request, env, auth));
      if (path === '/attendance' && request.method === 'DELETE') return respond(await handleDeleteAttendance(request, env, auth));
      if (path === '/attendance/predict' && request.method === 'POST') return respond(await handlePredictHaidh(request, env, auth));

      if (path === '/position' && request.method === 'GET') return respond(await handleGetPosition(request, env, auth));
      if (path === '/position' && request.method === 'POST') return respond(await handleSavePosition(request, env, auth));

      if (path === '/profile' && request.method === 'GET') return respond(await handleGetProfile(request, env, auth));
      if (path === '/profile' && request.method === 'POST') return respond(await handleSaveProfile(request, env, auth));

      return error('Not found', 404);
    } catch (err) {
      // Never let an unexpected error look like a normal empty response —
      // surface it. (CONVENTIONS.md principle 3.)
      console.error('Unhandled error:', err);
      return error('Internal error', 500);
    }
  }
};
