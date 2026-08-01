// ============================================================
// Hifzhelper — API client (V3)
// Plain classic script (not an ES module) for the same file:// portability
// reason as shared/data.js. Loaded before every other JS file.
// ============================================================

const API_BASE = 'https://hifzhelper-api.hifzhelper-app.workers.dev';

const TOKEN_KEY = 'hh_token';
const REMEMBERED_ID_KEY = 'hh_login_id';
// sessionStorage, not localStorage — clears automatically the moment the
// tab/app actually closes, so reopening always requires signing in again.
// Confirmed in chat (V3.4.1): the journal contents is valuable enough that
// this is worth the tradeoff over a longer-lived persistent session.
function getToken(){ return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t){ sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ sessionStorage.removeItem(TOKEN_KEY); }

// The account ID is safe to remember separately from the authenticated
// session: it is already the non-secret part of each student's personal URL.
// Keeping only this value lets an installed app ask for the PIN alone after
// it relaunches at / or /index.html, while the token still dies with the app
// and the PIN is never stored anywhere. Storage access can be unavailable in
// a restricted browser context, so these helpers leave the normal ID+PIN
// fallback usable rather than turning that browser limitation into a failed
// login.
function getRememberedLoginId(){
  try{ return (localStorage.getItem(REMEMBERED_ID_KEY) || '').trim() || null; }
  catch(e){ return null; }
}
function rememberLoginId(id){
  const value = (id || '').trim();
  if(!value) return;
  try{ localStorage.setItem(REMEMBERED_ID_KEY, value); } catch(e){ /* fallback login remains available */ }
}
function forgetRememberedLoginId(){
  try{ localStorage.removeItem(REMEMBERED_ID_KEY); } catch(e){ /* nothing else to clear */ }
}

// One shared interpretation of the current URL for auth.js and app.js.
// Existing home-screen installs may continue opening /index.html even after
// the manifest changes to /, so both forms deliberately mean "no ID in the
// path". A real personal path always takes priority over the remembered ID.
function getPathLoginId(pathname = location.pathname){
  const raw = String(pathname || '').replace(/^\/+|\/+$/g, '');
  if(!raw) return null;
  let decoded;
  try{ decoded = decodeURIComponent(raw).trim(); } catch(e){ return null; }
  if(!decoded || decoded.toLowerCase() === 'index.html' || decoded.includes('/')) return null;
  return decoded;
}
function getEffectiveLoginId(pathname = location.pathname){
  return getPathLoginId(pathname) || getRememberedLoginId();
}

function replaceUrlWithLoginId(id){
  const value = (id || '').trim();
  if(!value) return;
  history.replaceState(null, '', '/' + encodeURIComponent(value));
}

// Every call surfaces real errors rather than returning something that
// looks like empty/default data — callers must expect this to throw.
async function apiFetch(path, options = {}){
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if(token) headers['Authorization'] = 'Bearer ' + token;

  let response;
  try{
    response = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  } catch(e){
    throw new Error('Network error — check your connection.');
  }

  let body;
  try{ body = await response.json(); } catch(e){ body = null; }

  if(!response.ok){
    if(response.status === 401){ clearToken(); }
    throw new Error((body && body.error) || `Request failed (${response.status})`);
  }
  return body;
}

async function apiLogin(id, pin){
  const result = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ id, pin }) });
  setToken(result.token);
  // Save the ID only after the server accepts the ID+PIN pair. Merely opening
  // somebody else's personal link must never replace this device's account.
  rememberLoginId(id);
  return result;
}

// Public self-registration — no token needed. force=true bypasses the
// backend's name+whatsapp duplicate check (V3.4, item 1).
function apiRegister(name, whatsapp_number, force){
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, whatsapp_number, force: !!force }) });
}

// Public, no token — given a unique ID from the URL path, returns just the
// name and whether a PIN has been set yet, so the login screen can be
// personalized before any PIN is entered (V3.4, items 3/6/7/10).
function apiLookup(id){
  return apiFetch('/auth/lookup?id=' + encodeURIComponent(id));
}

// ---------- the four independent logs ----------
// Each follows the same shape: get(since), save(entry), update(id, fields), remove(id)
function makeLogClient(path){
  return {
    get: (since) => apiFetch(path + (since ? '?since=' + encodeURIComponent(since) : '')),
    getForDate: (date) => apiFetch(path + '?date=' + encodeURIComponent(date)).catch(() => []),
    save: (entry) => apiFetch(path, { method: 'POST', body: JSON.stringify(entry) }),
    update: (id, fields) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(Object.assign({ id }, fields)) }),
    remove: (id) => apiFetch(path + '?id=' + encodeURIComponent(id), { method: 'DELETE' })
  };
}
const apiSabaq = makeLogClient('/sabaq');
const apiSabaqDhor = makeLogClient('/sabaq-dhor');
const apiDhor = makeLogClient('/dhor');
const apiReflections = makeLogClient('/reflections');

// ---------- plans ----------
const apiPlans = {
  get: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch('/plans' + qs);
  },
  getForDate: (date) => apiFetch('/plans?date=' + encodeURIComponent(date)),
  create: (plan) => apiFetch('/plans', { method: 'POST', body: JSON.stringify(plan) }),
  update: (id, fields) => apiFetch('/plans', { method: 'PATCH', body: JSON.stringify(Object.assign({ id }, fields)) }),
  remove: (id) => apiFetch('/plans?id=' + encodeURIComponent(id), { method: 'DELETE' })
};

// ---------- dhor schedule (V3.9.0) ----------
// Tops up the rolling window — see worker/src/dhorSchedule.js. Returns
// { generated } normally, or { generated: 0, reason } when nothing can be
// generated yet (schedule not configured, no juz' baseline, etc.) — not
// an error, just "nothing to do", so callers don't need a catch just for
// that case (though one is still wise for genuine network/auth failures).
// startSegment (V3.11.0, optional): { segment_from, segment_to } — passed
// through only when the student explicitly picked a "Tomorrow's portion"
// starting point in Setup; omitted on every routine call (dhorPage.js's
// own top-up, or a Setup save where nothing was picked).
function apiEnsureDhorSchedule(startSegment){
  return apiFetch('/dhor-schedule/ensure', {
    method: 'POST',
    body: startSegment ? JSON.stringify(startSegment) : undefined
  });
}
function apiGetDhorDefaultEntry(){
  return apiFetch('/dhor-schedule/default-entry');
}

// ---------- attendance ----------
function apiGetAttendance(month){
  const qs = month ? '?month=' + encodeURIComponent(month) : '';
  return apiFetch('/attendance' + qs);
}
function apiSetAttendance(date, status){
  return apiFetch('/attendance', { method: 'POST', body: JSON.stringify({ date, status }) });
}
function apiDeleteAttendance(date){
  return apiFetch('/attendance?date=' + encodeURIComponent(date), { method: 'DELETE' });
}
function apiPredictHaidh(cycleLength, periodLength, lastStart){
  return apiFetch('/attendance/predict', { method: 'POST', body: JSON.stringify({ cycleLength, periodLength, lastStart }) });
}

// ---------- position ----------
function apiGetPosition(){ return apiFetch('/position'); }
function apiSavePosition(position_json, last_dhor_json){
  return apiFetch('/position', { method: 'POST', body: JSON.stringify({ position_json, last_dhor_json }) });
}

// ---------- profile ----------
function apiGetProfile(){ return apiFetch('/profile'); }
function apiSaveProfile(profile){ return apiFetch('/profile', { method: 'POST', body: JSON.stringify(profile) }); }

// ---------- admin ----------
function apiAdminListUsers(){ return apiFetch('/admin/users'); }
function apiAdminResetPin(id){ return apiFetch('/admin/reset-pin', { method: 'POST', body: JSON.stringify({ id }) }); }
function apiAdminChangeRole(id, role){ return apiFetch('/admin/change-role', { method: 'POST', body: JSON.stringify({ id, role }) }); }
function apiAdminRegisterStudent(name, whatsapp_number, force){ return apiFetch('/admin/register-student', { method: 'POST', body: JSON.stringify({ name, whatsapp_number, force: !!force }) }); }
function apiAdminUpdateUser(id, fields){ return apiFetch('/admin/update-user', { method: 'POST', body: JSON.stringify(Object.assign({ id }, fields)) }); }
function apiAdminDeleteUser(id){ return apiFetch('/admin/users?id=' + encodeURIComponent(id), { method: 'DELETE' }); }
