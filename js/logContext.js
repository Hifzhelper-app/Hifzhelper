// ============================================================
// Hifzhelper -- log context (V3.64.0, maktab delivery (e) rework).
//
// WHY THIS EXISTS
// The three log page modules (sabaqPage / sabaqDhorPage / dhorPage) were
// written for exactly one situation: the logged-in student, their own
// tables. The worker infers the student from the auth token, so no
// student id was ever passed and none of those 17 API call sites needed
// to name anyone.
//
// The maktab needs the SAME cards -- same verse pickers, same Lines/
// Pages, same Tajweed, same History, same everything -- pointed at a
// DIFFERENT student and the maktab_* tables. Two earlier attempts
// hand-rebuilt simplified cards and both drifted from the PJ
// immediately (V3.60.0, V3.62.0). Confirmed in chat 2026-08-16: reuse
// the PJ screen instead of copying it, accepting that this edits live
// code, because it is the only version of "copied from the personal
// journal" that stays true when the PJ changes.
//
// HOW
// One context object. PJ mode is the default and is byte-for-byte the
// old behaviour: logClient('sabaq') IS apiSabaq. Maktab mode swaps in
// student-scoped maktab clients, so the page modules never learn who
// they are working on -- they just call logClient(...) and the right
// rows move.
//
// THE HAZARD, stated plainly (see TODO.md): those modules keep
// module-level state (loaded entries, editing ids, position). That
// state is shared by whichever mode is active, so leaving maktab mode
// MUST clear the context and force a re-render, or one student's data
// could paint another's card. clearLogContext() is called on every exit
// path, and the harness asserts a teacher can go maktab -> PJ -> maktab
// without leakage.
// ============================================================

let LOG_CTX = { mode: 'pj', studentId: null, studentName: null, date: null, trackHaidh: false };

function logCtxIsMaktab(){ return LOG_CTX.mode === 'maktab'; }
function logCtxStudentId(){ return LOG_CTX.studentId; }
function logCtxStudentName(){ return LOG_CTX.studentName; }
function logCtxDate(){ return LOG_CTX.date; }
function logCtxTrackHaidh(){ return !!LOG_CTX.trackHaidh; }

function setMaktabLogContext(student, date){
  LOG_CTX = {
    mode: 'maktab',
    studentId: student.id,
    studentName: student.name || student.id,
    date: date || null,
    trackHaidh: !!student.track_haidh,
  };
}
function clearLogContext(){
  LOG_CTX = { mode: 'pj', studentId: null, studentName: null, date: null, trackHaidh: false };
  LOG_CTX_PJ_NOTES = { sabaq: '', sabaqDhor: '', dhor: '' }; // notes are per-student too — must not survive
  LOG_CTX_POOL = [];                                          // ...and so is the pool
}

// Student-scoped maktab clients: same shape as makeLogClient's, but every
// call carries the target student. Decorating here rather than at each
// call site is what keeps the page modules ignorant of the difference.
function makeMaktabLogClient(path){
  return {
    get: (since) => {
      const id = logCtxStudentId();
      return apiFetch(path + '?student_id=' + encodeURIComponent(id) + (since ? '&since=' + encodeURIComponent(since) : ''));
    },
    getForDate: (date) => apiFetch(path + '?student_id=' + encodeURIComponent(logCtxStudentId()) + '&date=' + encodeURIComponent(date)).catch(() => []),
    save: (entry) => apiFetch(path, { method: 'POST', body: JSON.stringify(Object.assign({ student_id: logCtxStudentId() }, entry)) }),
    update: (id, fields) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(Object.assign({ id }, fields)) }),
    remove: (id) => apiFetch(path + '?id=' + encodeURIComponent(id), { method: 'DELETE' }),
  };
}
const maktabSabaqClient = makeMaktabLogClient('/maktab/sabaq');
const maktabSabaqDhorClient = makeMaktabLogClient('/maktab/sabaq-dhor');
const maktabDhorClient = makeMaktabLogClient('/maktab/dhor');

// The one function the page modules call instead of naming a client.
function logClient(type){
  if(logCtxIsMaktab()){
    return { sabaq: maktabSabaqClient, sabaqDhor: maktabSabaqDhorClient, dhor: maktabDhorClient }[type];
  }
  return { sabaq: apiSabaq, sabaqDhor: apiSabaqDhor, dhor: apiDhor }[type];
}

// Dhor's prepop calc lives in the worker and already has a maktab variant
// (V3.60.0's /maktab/dhor-default-entry, computeDefaultDhorEntry with
// { table, includePlans: false }).
function logDhorDefaultEntry(){
  return logCtxIsMaktab() ? apiMaktabDhorDefault(logCtxStudentId()) : apiGetDhorDefaultEntry();
}

// PROFILE (V3.64.1). apiGetProfile() is own-only -- it answers "whose?"
// from the auth token -- so in maktab mode all 8 call sites across the
// three cards were returning the TEACHER's profile, and the student's
// card was using the teacher's mushaf and the teacher's Dhor pool. That
// is a FOURTH input from the wrong person entirely, against the stated
// rule that the PJ feeds the maktab only three things (sabaq_to, haidh,
// notes/tadabbur) and everything else is maktab-set.
//
// Correct source, confirmed in chat: the maktab picks ONE mushaf that
// all its students follow, stored on the admin-only maktab settings
// screen. V3.65.0 (delivery (g)) retires V3.64.1's MAKTAB_MUSHAF_INTERIM
// constant -- exactly the one-line replacement it was written to be --
// and reads the real setting instead. Cached for the session: it changes
// rarely and every card render would otherwise refetch it.
let MAKTAB_SETTINGS_CACHE = null;
async function loadMaktabSettings(force){
  if(MAKTAB_SETTINGS_CACHE && !force) return MAKTAB_SETTINGS_CACHE;
  try{
    MAKTAB_SETTINGS_CACHE = await apiGetMaktabSettings();
  } catch(e){
    // A failed settings read must not break logging: fall back to the
    // migration's own defaults rather than leaving cards unrenderable.
    MAKTAB_SETTINGS_CACHE = { mushaf: '13line', maktab_day_min: 3, absence_flag_days: 30, name: '' };
  }
  return MAKTAB_SETTINGS_CACHE;
}
function maktabSettingsCached(){ return MAKTAB_SETTINGS_CACHE; }
function invalidateMaktabSettings(){ MAKTAB_SETTINGS_CACHE = null; }

// Dhor pool: EMPTY in maktab mode, not the teacher's. The maktab sets
// its own pool via the coming student setup (completed ajzaa marked,
// stored as their quarter units). Empty is the honest state meanwhile --
// "nothing marked as moved to Dhor yet" -- where the teacher's pool
// would have marked the wrong sections as already moved.
async function logProfile(){
  if(logCtxIsMaktab()){
    const settings = await loadMaktabSettings();
    // baseline_selection (the Dhor pool) is maktab-owned and lives in the
    // maktab position blob from (h) onward; until then it is empty here
    // rather than the teacher's.
    // pool comes from the maktab position blob, loaded per student when
    // the day view opens (V3.66.0) — never students.baseline_selection.
    return { mushaf: settings.mushaf, baseline_selection: logCtxPool() };
  }
  return apiGetProfile();
}

// The student's own non-private note for the day being logged -- the
// THIRD and last permitted PJ input. Fetched once per day-view open and
// held here so the shared notes block can show it read-only without
// each card refetching. Keyed by type: a Sabaq note belongs on the Sabaq
// card only.
let LOG_CTX_PJ_NOTES = { sabaq: '', sabaqDhor: '', dhor: '' };
// The maktab Dhor pool for the student currently open. Filled from the
// maktab position blob by (h); empty until then, never the teacher's.
let LOG_CTX_POOL = [];
function setLogCtxPool(pool){ LOG_CTX_POOL = Array.isArray(pool) ? pool.slice() : []; }
function logCtxPool(){ return LOG_CTX_POOL.slice(); }
function setLogCtxPjNotes(notes){ LOG_CTX_PJ_NOTES = Object.assign({ sabaq: '', sabaqDhor: '', dhor: '' }, notes || {}); }
function logCtxPjNote(type){ return logCtxIsMaktab() ? (LOG_CTX_PJ_NOTES[type] || '') : ''; }

// PJ-only concepts, skipped in maktab mode rather than faked:
//  - position: a per-student stored blob the maktab has no table for, and
//    writing it in maktab mode would corrupt the TEACHER's own position
//    (it is keyed off the auth token). Reads return null, writes no-op.
//  - upcoming-plans queue: the maktab has no plans concept at all
//    (migration 0019's header states this).
function logPositionEnabled(){ return !logCtxIsMaktab(); }
function logPlansEnabled(){ return !logCtxIsMaktab(); }
