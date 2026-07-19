// ============================================================
// Hifzhelper — API client
// Plain classic script (not an ES module) for the same file:// portability
// reason as data.js — see the comment there. Loaded before app.js.
// ============================================================

// Point this at whichever Worker you're testing against. Dev for now —
// change to the production URL once the frontend is actually being deployed
// for real maktab use, not just testing.
const API_BASE = 'https://hifzhelper-api-dev.hifzhelper-app.workers.dev';

const TOKEN_KEY = 'hh_token';
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

// Every call surfaces real errors rather than returning something that looks
// like empty/default data (CONVENTIONS.md principle 3) — callers must expect
// this to throw and handle it (a try/catch + a visible message to the user),
// not assume it always resolves.
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
  const result = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ id, pin })
  });
  setToken(result.token);
  return result; // { token, name, role, firstLogin }
}

function apiGetEntries(params = {}){
  const qs = new URLSearchParams(params).toString();
  return apiFetch('/entries' + (qs ? '?' + qs : ''));
}
function apiSaveEntry(entry){
  return apiFetch('/entries', { method: 'POST', body: JSON.stringify(entry) });
}
function apiDeleteEntry(date){
  return apiFetch('/entries?date=' + encodeURIComponent(date), { method: 'DELETE' });
}

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
  return apiFetch('/attendance/predict', {
    method: 'POST',
    body: JSON.stringify({ cycleLength, periodLength, lastStart })
  });
}

function apiGetPosition(){
  return apiFetch('/position');
}
function apiSavePosition(position_json, last_dhor_json){
  return apiFetch('/position', { method: 'POST', body: JSON.stringify({ position_json, last_dhor_json }) });
}
