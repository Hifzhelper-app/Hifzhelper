import { segmentsPerJuz, unitMarkerCount, segmentRangeForUnitIndex, quarterUnitToJuzQuarter, segmentToQuarterUnits } from '../../shared/data.js';

// Dhor scheduling (V3.9.0 -> pure queue model, confirmed in chat 2026-08-02).
// Current as of V3.38.
//
// The original model here was wrong: `plans` is not a calendar of dated
// commitments -- it's a single ordered QUEUE. No dates are baked into any
// not-yet-done item's identity. "Continue from where it left off" always
// means: look at the last thing actually logged in `dhor_log`, and the
// queue picks up right after it -- nothing else. There's no "missed plan"
// (a backdated catch-up) and no "future plan" (borrowed early); if a
// daily quota is 4 halves and only 2 get done, the other 2 simply stay
// first in the queue, done whenever the student next does Dhor --
// queue-position is what matters, not calendar-position.
//
// Full rebuild, 4 phases (this file covers Phase A only):
//   A. This file -- computeDefaultDhorEntry collapses to one rule
//      (explicit override for today if set, else always next-after-last-
//      logged); ensureDhorSchedule's old job of pre-generating a rolling
//      window of DATED future `plans` rows goes away entirely -- see
//      CHANGELOG.md's V3.25.0 entry for the removed generation loop.
//   B. dhorPage.js's own prepopulation, rewired to consume this directly.
//   C. Plan Dhor's "Dhor Plan" tab -- the whole yesterday/today/next-5-
//      days date-grouping goes away, replaced by a flat "next N in the
//      queue" list.
//   D. Setup's "Tomorrow's Portion" removed entirely (2026-08-03,
//      confirmed in chat: served no purpose once a student could already
//      redirect the queue by saving a different portion via Plan Dhor --
//      not rebuilt as a seed mechanism as originally scoped) + an active
//      DELETE of every existing plan_type='dhor' row from the live
//      `plans` table (executed 2026-08-03).
// Not yet built: B, C, D.
//
// V3.15.0: baseline_selection is still a flat pool of QUARTER-UNIT IDs
// (1-120 — see shared/data.js's quarterUnit* helpers), not whole juz'
// numbers — the finest granularity Dhor's own "Portion per session"
// setting ever uses, so a juz' can be partially eligible (e.g. just one
// half, from Sabaq Dhor's own progressive move-to-Dhor). Still walks the
// pool in plain ascending order (juz' 1→30, quarter 1→4 within each) —
// NOT the branching "juz 30, then 29, then 1-or-28" study order noted
// elsewhere for initial memorisation; that branching order depends on a
// per-student choice this project doesn't store anywhere yet, so this
// generator uses the simpler deterministic order rather than guess.
// 2026-08-07 (V3.38): Surah-based Hifz Setup history removed entirely --
// baseline_mode/the surah option are gone (confirmed in chat), Hifz
// Setup is Juz'-only now, so baseline_selection is unconditionally
// quarter-unit-ID data with nothing left to branch on.

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Builds the full ordered list of session-sized chunks across the
// eligible pool (a flat, sorted list of quarter-unit IDs, 1-120). A
// session groups `quantity` granularity-units of CONSECUTIVE quarter-unit
// IDs — consecutive in the pool, not just numerically possible, so a gap
// (e.g. quarter-units 1-6 eligible but not 7-8, the normal pattern when
// only part of juz' 2 has moved to Dhor) never produces a segment range
// that silently swallows an ineligible quarter. A chunk can come out
// shorter than `quantity` units right at a gap — a minor, harmless
// unevenness, not a bug (same as the old per-juz' version of this).
// V3.24.1 fix: quantity used to multiply INTO the chunk size here
// (quartersPerUnit * quantity), so "Half, quantity 2" produced one
// combined full-juz-sized chunk per session instead of two separate
// half-sized ones -- confirmed wrong in chat. Each chunk is always
// exactly ONE granularity-unit (a plain quarter, a clean half, or a
// full juz) regardless of quantity. `quantity` used to separately
// control how many chunks got consumed per call, in ensureDhorSchedule's
// generation loop -- removed entirely in V3.25.0's pure-queue rewrite,
// since computeDefaultDhorEntry (below, the only remaining caller) only
// ever needs one next chunk at a time.
function buildChunks(quarterPool, ref, granularity) {
  const sortedUnits = [...new Set(quarterPool)].sort((a, b) => a - b);
  const quartersPerUnit = granularity === 'quarter' ? 1 : granularity === 'half' ? 2 : 4;
  const chunks = [];
  let i = 0;
  while (i < sortedUnits.length) {
    // Longest run of consecutive quarter-unit IDs starting at i.
    let runEnd = i;
    while (runEnd + 1 < sortedUnits.length && sortedUnits[runEnd + 1] === sortedUnits[runEnd] + 1) runEnd++;
    let cursor = i;
    while (cursor <= runEnd) {
      const groupEnd = Math.min(cursor + quartersPerUnit - 1, runEnd);
      const first = quarterUnitToJuzQuarter(sortedUnits[cursor]);
      const last = quarterUnitToJuzQuarter(sortedUnits[groupEnd]);
      const startRange = segmentRangeForUnitIndex(first.juz, first.quarterIndex, ref, 'quarter');
      const endRange = segmentRangeForUnitIndex(last.juz, last.quarterIndex, ref, 'quarter');
      chunks.push({ segment_from: startRange.segment_from, segment_to: endRange.segment_to });
      cursor = groupEnd + 1;
    }
    i = runEnd + 1;
  }
  return chunks;
}

function findChunkIndexForSegment(chunks, segment_from, segment_to) {
  if (segment_from == null) return -1;
  // Exact match first (the normal case — this generator's own past output).
  const exact = chunks.findIndex(c => c.segment_from === segment_from && c.segment_to === segment_to);
  if (exact >= 0) return exact;
  // Otherwise, the chunk this range's END falls within or just past —
  // covers a hand-logged entry that doesn't line up exactly with the
  // current granularity/quantity settings (e.g. the student changed them,
  // or logged something manually with a different span).
  let best = -1;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].segment_from <= segment_to) best = i;
  }
  return best;
}

// GET /dhor-schedule/default-entry — what should today's Dhor form show by
// default. Pure queue model (confirmed in chat 2026-08-02), one rule:
//   1. An explicit override for today, if one exists (a real `plans` row
//      with plan_type='dhor', status='planned', target_date = today --
//      currently dormant in practice: Setup's "Tomorrow's Portion", the
//      one thing that used to populate this, was removed entirely
//      2026-08-03 rather than rebuilt, and nothing else creates a
//      same-day dhor-type plan row today. The check itself stays, since
//      a row created directly via POST /plans would still be honoured).
//   2. Otherwise, ALWAYS the segment that follows the last logged entry --
//      walking the eligible pool forward at THAT ENTRY'S OWN granularity
//      (not the account's configured Setup granularity/quantity -- this
//      is about matching what the student actually just did, not
//      projecting a schedule). No plan and no history at all -> genuinely
//      blank; there's nothing sensible to continue from yet.
// This collapses what used to be 5 branches (today's plan -> missed ->
// future -> continue-from-last -> blank) to one: the "missed" and
// "future" branches only ever existed because plans used to be
// pre-generated with dates attached, which is no longer true. Reuses
// buildChunks/findChunkIndexForSegment (this file, above) rather than
// duplicating the gap-aware chunking logic a second time.
// V3.60.0 (maktab delivery (e2)): gained opts so the maktab day view can
// reuse this exact calc against ITS OWN history ("copy the PJ logic",
// confirmed in chat) -- { table: 'maktab_dhor_log', includePlans: false }
// (the maktab has no plans concept). PJ callers pass nothing and are
// byte-for-byte unchanged in behaviour. Only the two reads below are
// parameterised; the queue/upcoming functions further down stay PJ-only.
export async function computeDefaultDhorEntry(env, studentId, opts = {}) {
  const table = opts.table || 'dhor_log';
  const includePlans = opts.includePlans !== false;
  const today = todayISO();

  if (includePlans) {
    const { results: todaysPlans } = await env.DB.prepare(
      "SELECT * FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND status = 'planned' AND target_date = ? ORDER BY created_at"
    ).bind(studentId, today).all();
    if (todaysPlans.length > 0) return { source: 'today_plan', date: today, plans: todaysPlans };
  }

  // V3.66.0 (delivery (h)): in maktab mode the pool and the mushaf come
  // from the MAKTAB, not the student's own row. Found 2026-08-16 while
  // tracing Dhor prepop for the user: these two reads are the same
  // fourth-input bug as the 8 frontend apiGetProfile() calls fixed in
  // V3.64.1, but server-side, so logProfile() never touched them —
  // maktab Dhor prepop was rotating through the student's PJ pool in her
  // PJ mushaf. The maktab pool lives in maktab_position's blob; the
  // mushaf is the one maktab setting.
  let poolSource, mushaf;
  if (opts.table === 'maktab_dhor_log') {
    const settings = await env.DB.prepare('SELECT mushaf FROM maktab_settings WHERE id = 1').first();
    mushaf = (settings && settings.mushaf) || '13line';
    const posRow = await env.DB.prepare('SELECT position_json FROM maktab_position WHERE student_id = ?')
      .bind(studentId).first();
    let blob = null;
    try { blob = posRow && posRow.position_json ? JSON.parse(posRow.position_json) : null; } catch (e) { blob = null; }
    poolSource = (blob && Array.isArray(blob.baselineSelection)) ? blob.baselineSelection : [];
  } else {
    const student = await env.DB.prepare(
      'SELECT mushaf, baseline_selection FROM students WHERE id = ?'
    ).bind(studentId).first();
    if (!student) return { source: 'none', reason: 'Student not found' };
    mushaf = student.mushaf;
    try { poolSource = JSON.parse(student.baseline_selection || '[]'); } catch (e) { poolSource = []; }
  }
  let pool = poolSource;
  pool = [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b);
  if (pool.length === 0) return { source: 'none', reason: "No memorised juz'/quarters recorded yet in Hifz Setup" };

  const ref = mushaf === '15line_madani' ? 'uthmani' : 'waterval';
  // V3.83.0 (k): the PJ's "continue from last" now spans the MERGED
  // journal — her last dhor wherever she recited it, PJ or maktab (the
  // recorded build interpretation: prepop/frontier/tracker consume the
  // merged journal; ownership limits editing, not counting). The maktab
  // variant stays maktab-only — the maktab gains nothing from PJ.
  const lastLog = table === 'dhor_log'
    ? await env.DB.prepare(
        `SELECT segment_from, segment_to FROM (
           SELECT segment_from, segment_to, date, created_at FROM dhor_log WHERE student_id = ?1
           UNION ALL
           SELECT segment_from, segment_to, date, created_at FROM maktab_dhor_log WHERE student_id = ?1
         ) ORDER BY date DESC, created_at DESC LIMIT 1`
      ).bind(studentId).first()
    : await env.DB.prepare(
        `SELECT segment_from, segment_to FROM ${table} WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1`
      ).bind(studentId).first();

  if (lastLog) {
    const perJuz = segmentsPerJuz(ref);
    const span = lastLog.segment_to - lastLog.segment_from + 1;
    const granularity = span === perJuz ? 'full' : span === perJuz / 2 ? 'half' : 'quarter';
    const chunks = buildChunks(pool, ref, granularity);
    if (chunks.length === 0) return { source: 'none', reason: 'Could not build a next segment from the current pool' };
    const idx = findChunkIndexForSegment(chunks, lastLog.segment_from, lastLog.segment_to);
    const nextIdx = (idx >= 0 ? idx + 1 : 0) % chunks.length;
    const chunk = chunks[nextIdx];
    return { source: 'continue_last', date: today, segment_from: chunk.segment_from, segment_to: chunk.segment_to, ref, plan_id: null };
  }

  // No plan and no history at all: genuinely blank, not a default segment
  // (V3.24.0 correction, unchanged by this rebuild) -- a brand-new
  // student with nothing logged in dhor_log yet realistically isn't
  // doing Dhor at all. Once their first entry is ever saved (from Plan
  // Dhor or the manual picker), the branch above takes over normally
  // from then on.
  return { source: 'none', reason: 'No Dhor history yet -- enter this session manually' };
}

export async function handleGetDhorDefaultEntry(request, env, auth) {
  const result = await computeDefaultDhorEntry(env, auth.id);
  return { data: result };
}

// GET /dhor-schedule/upcoming?fallback_unit=quarter|half|full — Phase C:
// Plan Dhor's "Dhor Plan" tab. Confirmed in chat 2026-08-03: this replaces
// V3.24.1's whole yesterday/today/next-5-days date-grouped view (dead
// since Phase A stopped generating dated rows and Phase D purged what
// existed) with a flat set of upcoming QUEUE batches -- "day 0" is
// today's batch (shown individually on the frontend), "day 1" onward is
// "the rest of the week" (rolled up on the frontend). No dates are
// computed or returned anywhere here, deliberately -- consistent with
// the whole pure-queue model, this is queue-position, not calendar-
// position; the frontend's "day N" is just this array's index.
//
// Batch size (how many items per day) and granularity:
//   - Setup configured (dhor_granularity/quantity/frequency all set):
//     granularity = dhor_granularity; count/day = dhor_quantity *
//     (dhor_frequency === 'twice' ? 2 : 1) -- e.g. 2 halves twice a day
//     = 4 half-sized items/day, confirmed via that exact example in chat.
//   - Not configured: granularity = fallback_unit (the Dhor card's own
//     live Amount/Unit switch state, confirmed in chat as the source --
//     defaults to 'quarter' here only if the frontend somehow omits it,
//     as a safety net, since the card itself now defaults to Half);
//     count/day = 1.
//
// Number of day-groups returned: dhor_days_of_week's own length if
// configured (its cardinality, not specific weekdays -- there's no
// calendar involved here at all), else 7 (today + 6, confirmed in chat
// for the not-configured case specifically). This is Claude's own
// extrapolation for the CONFIGURED case, not something spelled out
// verbatim in chat -- flagging it here rather than silently assuming,
// since honoring dhor_days_of_week's cardinality without reintroducing
// actual calendar dates was the least-bad reading available.
//
// Starting position: same anchor computeDefaultDhorEntry's continue_last
// branch uses (the chunk after the last logged entry, at THAT entry's
// own implied granularity -- reused via findChunkIndexForSegment's
// gap-tolerant matching, not re-derived a second way) when dhor_log has
// anything; otherwise the very first chunk in the pool, ascending --
// confirmed in chat for the no-history case, extended here to also cover
// "has Setup configured, but hasn't logged anything yet" on the same
// reasoning, since chat didn't address that specific combination and
// this was the natural generalisation of what WAS said.
export async function computeUpcomingDhorQueue(env, studentId, fallbackUnit) {
  const student = await env.DB.prepare(
    'SELECT mushaf, baseline_selection, dhor_granularity, dhor_quantity, dhor_frequency, dhor_days_of_week FROM students WHERE id = ?'
  ).bind(studentId).first();
  if (!student) return { hasPool: false, days: [] };
  let pool;
  try { pool = JSON.parse(student.baseline_selection || '[]'); } catch (e) { pool = []; }
  pool = [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b);
  if (pool.length === 0) return { hasPool: false, days: [] };

  const ref = student.mushaf === '15line_madani' ? 'uthmani' : 'waterval';
  const setupConfigured = !!(student.dhor_granularity && student.dhor_quantity && student.dhor_frequency);
  const granularity = setupConfigured ? student.dhor_granularity : (fallbackUnit || 'quarter');
  const perDay = setupConfigured
    ? student.dhor_quantity * (student.dhor_frequency === 'twice' ? 2 : 1)
    : 1;

  let daysOfWeek = [];
  try { daysOfWeek = JSON.parse(student.dhor_days_of_week || '[]'); } catch (e) { daysOfWeek = []; }
  const totalDays = Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek.length : 7;

  const chunks = buildChunks(pool, ref, granularity);
  if (chunks.length === 0) return { hasPool: true, days: [] };

  const lastLog = await env.DB.prepare(
    'SELECT segment_from, segment_to FROM dhor_log WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1'
  ).bind(studentId).first();
  let startIdx = 0;
  if (lastLog) {
    const idx = findChunkIndexForSegment(chunks, lastLog.segment_from, lastLog.segment_to);
    startIdx = (idx >= 0 ? idx + 1 : 0) % chunks.length;
  }

  const days = [];
  let cursor = startIdx;
  for (let d = 0; d < totalDays; d++) {
    const items = [];
    for (let i = 0; i < perDay; i++) {
      const chunk = chunks[cursor % chunks.length];
      items.push({ segment_from: chunk.segment_from, segment_to: chunk.segment_to, ref });
      cursor++;
    }
    days.push({ day: d, items });
  }
  return { hasPool: true, days };
}

export async function handleGetUpcomingDhorQueue(request, env, auth) {
  const url = new URL(request.url);
  const fallbackUnit = url.searchParams.get('fallback_unit');
  const result = await computeUpcomingDhorQueue(env, auth.id, fallbackUnit);
  return { data: result };
}


// ============================================================
// mergeDhorUnitsIntoPool (V3.68.0, delivery (i))
//
// The Dhor pool grows as part of the SAME request that writes the log
// row, replacing the client-side merge that used to follow the save as a
// second, fire-and-forget call. Two properties follow by construction
// rather than by discipline:
//   - there is no second request left to fail silently (the old one did
//     not await and swallowed its error, so a log could commit while the
//     pool quietly did not grow);
//   - the pool written is always the pool of the student the row was
//     written for, so the maktab wrong-row case is not "routed
//     correctly" -- it is unroutable.
//
// REMOVAL STAYS FREE. This only ever ADDS the units just logged.
// Clearing juz from the pool (Hifz Setup, the juz tracker, maktab
// student setup) is a legitimate action and is untouched here --
// re-logging a removed juz simply adds it back, which is the existing
// "logging adds to the pool" rule, not a fight with the user.
// ============================================================
function mergedPool(current, units) {
  const clean = (Array.isArray(current) ? current : [])
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 120);
  const set = new Set(clean);
  let added = false;
  for (const u of units) if (!set.has(u)) { set.add(u); added = true; }
  return added ? [...set].sort((a, b) => a - b) : null;   // null = nothing to write
}

export async function mergeDhorUnitsIntoPool(env, studentId, segment_from, segment_to, ref, opts = {}) {
  // The log row is ALREADY COMMITTED by the time this runs. A pool merge
  // that throws would turn a successful save into a 500 and invite the
  // client to retry it -- duplicate rows to fix a derived convenience.
  // So the whole thing is best-effort. This is NOT the silent
  // .catch(() => {}) it replaces: that one sat between two requests and
  // lost real failures to the network, whereas anything reaching here is
  // a schema or DB fault, reported to the worker log where it is visible.
  try {
    await mergePoolInner(env, studentId, segment_from, segment_to, ref, opts);
  } catch (e) {
    console.error('mergeDhorUnitsIntoPool failed (log row saved, pool not grown):', studentId, e && e.message);
  }
}

async function mergePoolInner(env, studentId, segment_from, segment_to, ref, opts) {
  if (segment_from == null || segment_to == null) return;
  let units;
  // A segment that will not decompose must never fail the save -- the log
  // row is the record; the pool is a derived convenience on top of it.
  try { units = segmentToQuarterUnits(segment_from, segment_to, ref || 'waterval'); }
  catch (e) { return; }
  if (!Array.isArray(units) || !units.length) return;

  if (opts.maktab) {
    const row = await env.DB.prepare('SELECT position_json FROM maktab_position WHERE student_id = ?')
      .bind(studentId).first();
    let blob = {};
    try { blob = row && row.position_json ? (JSON.parse(row.position_json) || {}) : {}; } catch (e) { blob = {}; }
    const merged = mergedPool(blob.baselineSelection, units);
    if (merged === null) return;
    blob.baselineSelection = merged;
    // Mirrors handleSaveMaktabPosition's own upsert, COALESCE included, so
    // a pool merge never clobbers last_dhor_json.
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO maktab_position (student_id, position_json, last_dhor_json, updated_at) VALUES (?, ?, NULL, ?)
       ON CONFLICT(student_id) DO UPDATE SET
         position_json = COALESCE(excluded.position_json, maktab_position.position_json),
         last_dhor_json = COALESCE(excluded.last_dhor_json, maktab_position.last_dhor_json),
         updated_at = excluded.updated_at`
    ).bind(studentId, JSON.stringify(blob), now).run();
    return;
  }

  const row = await env.DB.prepare('SELECT baseline_selection FROM students WHERE id = ?')
    .bind(studentId).first();
  let current = [];
  try { current = JSON.parse((row && row.baseline_selection) || '[]'); } catch (e) { current = []; }
  const merged = mergedPool(current, units);
  if (merged === null) return;
  await env.DB.prepare('UPDATE students SET baseline_selection = ? WHERE id = ?')
    .bind(JSON.stringify(merged), studentId).run();
}
