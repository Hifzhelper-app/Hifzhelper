/* Hifzhelper build 4.2.6 | js/api.js */
// ============================================================
// Hifzhelper — API client (V3)
// Plain classic script (not an ES module) for the same file:// portability
// reason as shared/data.js. Loaded before every other JS file.
// ============================================================

// V3.97.1 (user — "fix the seam"): the API base picks itself by where
// the app is served. A dev-hosted frontend (any hostname containing
// "-dev", or localhost) talks to the DEV worker; everything else talks
// to production — so one identical codebase serves both streams and a
// dev page can never quietly write into real maktab data. For ad-hoc
// work, localStorage 'hh_api_base' overrides both (set it in the
// browser console; remove the key to return to automatic).
const API_BASE = (() => {
  try {
    const override = localStorage.getItem('hh_api_base');
    if (override) return override;
    const h = location.hostname;
    if (h.includes('-dev') || h === 'localhost' || h === '127.0.0.1') {
      return 'https://hifzhelper-api-dev.hifzhelper-app.workers.dev';
    }
  } catch (e) { /* no location/storage (harness) — production default */ }
  return 'https://hifzhelper-api.hifzhelper-app.workers.dev';
})();

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

// V3.77.0 (j): the accounts that have SIGNED IN on this device — id, name,
// role. Never a PIN, never a token: the switcher pre-fills the id and asks
// for the PIN every time (maktab devices get shared). Device-local, no
// endpoint, nothing links the accounts in the data. "Forget" removes one.
const KNOWN_ACCOUNTS_KEY = 'hh_known_accounts';
function getKnownAccounts(){
  try{
    const list = JSON.parse(localStorage.getItem(KNOWN_ACCOUNTS_KEY) || '[]');
    return Array.isArray(list) ? list.filter(a => a && typeof a.id === 'string' && a.id) : [];
  } catch(e){ return []; }
}
function rememberKnownAccount(account){
  if(!account || !account.id) return;
  const entry = { id: String(account.id), name: String(account.name || account.id), role: String(account.role || 'student') };
  const list = getKnownAccounts().filter(a => a.id !== entry.id);
  list.unshift(entry);   // most recent first
  try{ localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 12))); } catch(e){ /* switcher degrades to the plain ID screen */ }
}
function forgetKnownAccount(id){
  try{ localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(getKnownAccounts().filter(a => a.id !== id))); } catch(e){ /* nothing else to clear */ }
}
// The dropdown's "Switch account" reloads into the switcher; this flag is
// how the login router knows. sessionStorage: it must not survive the tab.
const SWITCH_FLAG_KEY = 'hh_switch_accounts';
function requestAccountSwitch(){ try{ sessionStorage.setItem(SWITCH_FLAG_KEY, '1'); } catch(e){} }
function consumeAccountSwitchRequest(){
  try{ const v = sessionStorage.getItem(SWITCH_FLAG_KEY); sessionStorage.removeItem(SWITCH_FLAG_KEY); return v === '1'; } catch(e){ return false; }
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
    const err = new Error((body && body.error) || `Request failed (${response.status})`);
    if(body && body.code) err.code = body.code;   // V3.76.2: which rule refused, when the worker says
    throw err;
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
// create/update/remove removed 2026-08-03 (confirmed in chat): zero
// callers anywhere in the app -- Dhor's own plan features go through
// baseline_selection/the queue model instead, and Sabaq/Sabaq Dhor have
// no planning UI at all. Backing handlers (worker/src/plans.js) and
// their routes removed alongside this.
const apiPlans = {
  get: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch('/plans' + qs);
  },
  getForDate: (date) => apiFetch('/plans?date=' + encodeURIComponent(date))
};

// ---------- dhor schedule ----------
// ensureDhorSchedule/apiEnsureDhorSchedule removed entirely 2026-08-03:
// Phase A (2026-08-02) had already made the backend side a no-op, kept
// alive only so its 2 then-existing callers didn't need to change yet.
// Phase B removed the first (dhorPage.js's open-time top-up); removing
// Tomorrow's Portion from Setup removed the second and last one
// (settingsScreen.js's save handler) -- nothing calls this any more.
function apiGetDhorDefaultEntry(){
  return apiFetch('/dhor-schedule/default-entry');
}
// Phase C (2026-08-03): fallbackUnit is the Dhor card's own live Amount/
// Unit switch value -- only actually used server-side for the "no Setup
// configured yet" case, but always passed since the frontend has no way
// to know in advance which case it'll turn out to be.
function apiGetUpcomingDhorQueue(fallbackUnit){
  return apiFetch('/dhor-schedule/upcoming?fallback_unit=' + encodeURIComponent(fallbackUnit));
}

// ---------- attendance ----------
function apiGetAttendance(month){
  const qs = month ? '?month=' + encodeURIComponent(month) : '';
  return apiFetch('/attendance' + qs);
}
// V3.40.2: apiSetAttendance removed -- its only caller (the Haidh
// calendar's single-day mark path) was replaced by apiMarkHaidhRange
// below. Backend handleSetAttendance/its route left untouched -- that's
// the separately PARKED "attendance" decision (see TODO.md), not
// something this change resolves.
// V3.40.2: the calendar's tap-first/tap-last range-select.
function apiMarkHaidhRange(startDate, endDate){
  return apiFetch('/attendance/mark-range', { method: 'POST', body: JSON.stringify({ startDate, endDate }) });
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
// V3.78.0 (delivery 3): the two admin-managed lists.
function apiGetTajweedTags(){ return apiFetch('/tajweed-tags'); }
function apiCreateTajweedTag(name, major){ return apiFetch('/tajweed-tags', { method: 'POST', body: JSON.stringify({ name, major: !!major }) }); }
function apiUpdateTajweedTag(id, fields){ return apiFetch('/tajweed-tags/update', { method: 'POST', body: JSON.stringify(Object.assign({ id }, fields)) }); }
function apiGetMaktabGroups(){ return apiFetch('/maktab-groups'); }
function apiCreateMaktabGroup(name){ return apiFetch('/maktab-groups', { method: 'POST', body: JSON.stringify({ name }) }); }
function apiUpdateMaktabGroup(id, fields){ return apiFetch('/maktab-groups/update', { method: 'POST', body: JSON.stringify(Object.assign({ id }, fields)) }); }
function apiAdminCreateTeachingProfile(id){ return apiFetch('/admin/create-teaching-profile', { method: 'POST', body: JSON.stringify({ id }) }); }   // V3.77.0 (j)
function apiAdminRegisterStudent(name, whatsapp_number, force){ return apiFetch('/admin/register-student', { method: 'POST', body: JSON.stringify({ name, whatsapp_number, force: !!force }) }); }
function apiAdminUpdateUser(id, fields){ return apiFetch('/admin/update-user', { method: 'POST', body: JSON.stringify(Object.assign({ id }, fields)) }); }
function apiAdminDeleteUser(id){ return apiFetch('/admin/users?id=' + encodeURIComponent(id), { method: 'DELETE' }); }

// ---------- maktab (V3.59.0, delivery (e1) — read paths only; write fns
// arrive with (e2)'s day view) ----------
function apiMaktabSummary(date){
  return apiFetch('/maktab/summary?date=' + encodeURIComponent(date));
}
// student_id optional: omitted = own logs (the student Maktab Journal);
// passed = a teacher reading a specific student ((e2) day view reuse).
function apiGetMaktabSabaq(studentId, since){   // since: V3.85.0, the summary page's window
  const q = [];
  if(studentId) q.push('student_id=' + encodeURIComponent(studentId));
  if(since) q.push('since=' + encodeURIComponent(since));
  return apiFetch('/maktab/sabaq' + (q.length ? '?' + q.join('&') : ''));
}
function apiGetMaktabSabaqDhor(studentId, since){   // since: V3.85.0, the summary page's window
  const q = [];
  if(studentId) q.push('student_id=' + encodeURIComponent(studentId));
  if(since) q.push('since=' + encodeURIComponent(since));
  return apiFetch('/maktab/sabaq-dhor' + (q.length ? '?' + q.join('&') : ''));
}
function apiGetMaktabDhor(studentId, since){   // since: V3.85.0, the summary page's window
  const q = [];
  if(studentId) q.push('student_id=' + encodeURIComponent(studentId));
  if(since) q.push('since=' + encodeURIComponent(since));
  return apiFetch('/maktab/dhor' + (q.length ? '?' + q.join('&') : ''));
}

// ---------- maktab write path + prepop fetches (V3.60.0, delivery (e2)) ----------
// V3.68.0 (delivery (i)): apiMaktabSabaq / apiMaktabSabaqDhor /
// apiMaktabDhor DELETED. Zero call sites since the V3.64.0 day-view
// rewrite moved to logContext's student-scoped clients, and they were the
// makeLogClient (token-deciding) form of the very endpoints
// makeMaktabLogClient student-scopes -- the wrong-row footgun under
// inviting names. verify_routing.mjs could never guard them: it scans
// call SITES and they had none, so deleting them is the only guard.
function apiMaktabDhorDefault(studentId){
  return apiFetch('/maktab/dhor-default-entry?student_id=' + encodeURIComponent(studentId));
}
// Teacher-side reads of a STUDENT's PJ for prepop: the PJ endpoints have
// allowed teacher+ reads with ?student_id= all along (applyPrivacy nulls
// anything private before it leaves the worker), so these are just the
// param'd variants the PJ's own clients never needed.
function apiGetPJLogsFor(path, studentId){
  return apiFetch(path + '?student_id=' + encodeURIComponent(studentId));
}
function apiGetAttendanceFor(studentId){
  return apiFetch('/attendance?student_id=' + encodeURIComponent(studentId));
}
// Re-activates the parked POST /attendance (route + handler have been live
// and teacher-gated since V3.40.2 removed the old caller) for teacher
// haidh entry — confirmed in chat, delivery (e2).
function apiClearAttendanceFor(studentId, date){
  return apiFetch('/attendance?student_id=' + encodeURIComponent(studentId) + '&date=' + encodeURIComponent(date), { method: 'DELETE' });
}
function apiSetAttendanceFor(studentId, date, status){
  return apiFetch('/attendance', { method: 'POST', body: JSON.stringify({ student_id: studentId, date, status }) });
}
// V3.76.0 (Phase 2): the range write for a named student — the maktab's
// haidh calendar marks a range as the student's own does. Teacher-gated in
// the worker; a student's own id passes, anyone else's is ignored.
// V3.76.2: opts = { overrideGap: true } (teacher decides to mark haidh
// despite the gap) or { status: 'absent' } (teacher marks the range absent
// instead). Both teacher-gated in the worker; a student's flag is ignored.
// V3.80.0: the attendance page. Own vs For, like every student-scoped pair.
function apiGetAttendancePage(from, to){
  const qs = (from && to) ? `?from=${from}&to=${to}` : '';
  return apiFetch('/attendance/page' + qs);
}
function apiGetAttendancePageFor(studentId, from, to){
  const parts = [`student_id=${encodeURIComponent(studentId)}`];
  if(from && to){ parts.push(`from=${from}`, `to=${to}`); }
  return apiFetch('/attendance/page?' + parts.join('&'));
}
function apiMarkHaidhRangeFor(studentId, startDate, endDate, opts){
  const body = { student_id: studentId, startDate, endDate };
  if(opts && opts.overrideGap) body.override_gap = true;
  if(opts && opts.status) body.status = opts.status;
  return apiFetch('/attendance/mark-range', { method: 'POST', body: JSON.stringify(body) });
}

// ---------- derived maktab attendance (V3.67.0, delivery (f)) ----------
function apiGetMaktabAttendance(date){
  return apiFetch('/maktab/attendance?date=' + encodeURIComponent(date));
}

// ---------- maktab position (V3.66.0, delivery (h)) ----------
// The maktab's own position blob per student — teacher-gated both ways.
function apiGetMaktabPosition(studentId){
  return apiFetch('/maktab/position?student_id=' + encodeURIComponent(studentId));
}
function apiSaveMaktabPosition(studentId, position_json, last_dhor_json){
  return apiFetch('/maktab/position', { method: 'POST', body: JSON.stringify({ student_id: studentId, position_json, last_dhor_json: last_dhor_json ?? null }) });
}

// ---------- maktab settings (V3.65.0, delivery (g)) ----------
// Read is teacher+ (cards need the mushaf); write is admin-only, enforced
// server-side by requireAdmin — the screen is admin-only too.
function apiGetMaktabSettings(){ return apiFetch('/maktab/settings'); }
function apiSaveMaktabSettings(fields){
  return apiFetch('/maktab/settings', { method: 'POST', body: JSON.stringify(fields) });
}

// V3.87.0: the maktab calendar — terms drive attendance; entries info-only
function apiGetMaktabTerms(){ return apiFetch('/maktab/terms'); }
function apiCreateMaktabTerm(body){ return apiFetch('/maktab/terms', { method: 'POST', body: JSON.stringify(body) }); }
function apiUpdateMaktabTerm(id, body){ return apiFetch('/maktab/terms/' + id, { method: 'PUT', body: JSON.stringify(body) }); }
function apiDeleteMaktabTerm(id){ return apiFetch('/maktab/terms/' + id, { method: 'DELETE' }); }
// V3.98.0: the maktab Attendance screen — one week of columns
function apiGetMaktabWeek(monday){ return apiFetch('/maktab/attendance-week?monday=' + monday); }

function apiGetMaktabCalendar(year){ return apiFetch('/maktab/calendar' + (year ? '?year=' + year : '')); }
function apiCreateMaktabCalEntry(body){ return apiFetch('/maktab/calendar', { method: 'POST', body: JSON.stringify(body) }); }
function apiUpdateMaktabCalEntry(id, body){ return apiFetch('/maktab/calendar/' + id, { method: 'PUT', body: JSON.stringify(body) }); }
function apiDeleteMaktabCalEntry(id){ return apiFetch('/maktab/calendar/' + id, { method: 'DELETE' }); }
// V3.88.0: the staged propose → edit → confirm flow (replaced the loaders)
function apiGetHolidayProposal(year){ return apiFetch('/maktab/calendar/holiday-proposal?year=' + year); }
function apiGetIslamicProposal(year){ return apiFetch('/maktab/calendar/islamic-proposal?year=' + year); }
function apiConfirmCalList(year, type, entries){ return apiFetch('/maktab/calendar/confirm', { method: 'POST', body: JSON.stringify({ year, type, entries }) }); }
