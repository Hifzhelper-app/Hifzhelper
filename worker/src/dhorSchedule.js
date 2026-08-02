import { segmentsPerJuz, unitMarkerCount, segmentRangeForUnitIndex, quarterUnitToJuzQuarter } from '../../shared/data.js';

// Dhor scheduling (V3.9.0 -> pure queue model, confirmed in chat 2026-08-02).
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
//   D. Setup's "Tomorrow's Portion" becomes a one-time queue-start seed
//      (not a standing override) + an active DELETE of every existing
//      plan_type='dhor' row from the live `plans` table.
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
// baseline_mode='surah' isn't supported yet either — mapping arbitrary
// surah selections onto this quarter pool is separate work (Phase 3, the
// Sabaq/Setup rebuild's own phase numbering — unrelated to the A-D phases
// above), not a silent/wrong approximation. Both are flagged via
// computeDefaultDhorEntry's own `reason` rather than failing quietly.

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

// POST /dhor-schedule/ensure — historically topped up a rolling 7-day
// window with DATED future `plans` rows (pre-generated ahead of time).
// Confirmed in chat (2026-08-02): that whole idea was the wrong model --
// a `plans` row shouldn't carry a date for anything not yet done at all.
// computeDefaultDhorEntry (below) now computes the next queue item live,
// from dhor_log, on every call, so there's nothing left here to
// pre-generate or "top up." This is now a harmless no-op, kept (rather
// than deleting the route outright) so its two existing callers --
// dhorPage.js's open-time top-up, and Setup's save handler, which awaits
// this and would show a false "Couldn't save" error if it started
// throwing -- don't need to change in this phase; neither one reads this
// response body today. studentId/startSegment are accepted but unused for
// now: Phase D gives Setup's "Tomorrow's Portion" a real seeding
// mechanism again -- a small, one-time queue-start seed -- not a revival
// of this function's old bulk-generation behaviour.
export async function ensureDhorSchedule(env, studentId, startSegment) {
  return { generated: 0 };
}

export async function handleEnsureDhorSchedule(request, env, auth) {
  let body = {};
  try { body = await request.json(); } catch (e) { /* no body sent — the normal case for routine top-ups */ }
  const startSegment = (body && body.segment_from != null)
    ? { segment_from: body.segment_from, segment_to: body.segment_to }
    : null;
  const result = await ensureDhorSchedule(env, auth.id, startSegment);
  return { data: result };
}

// GET /dhor-schedule/default-entry — what should today's Dhor form show by
// default. Pure queue model (confirmed in chat 2026-08-02), one rule:
//   1. An explicit override for today, if one exists (currently: a real
//      `plans` row with plan_type='dhor', status='planned', target_date =
//      today -- the only way one of these can exist today, since
//      ensureDhorSchedule no longer generates any; Phase D gives Setup's
//      "Tomorrow's Portion" a real seeding mechanism for this again).
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
export async function computeDefaultDhorEntry(env, studentId) {
  const today = todayISO();

  const { results: todaysPlans } = await env.DB.prepare(
    "SELECT * FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND status = 'planned' AND target_date = ? ORDER BY created_at"
  ).bind(studentId, today).all();
  if (todaysPlans.length > 0) return { source: 'today_plan', date: today, plans: todaysPlans };

  const student = await env.DB.prepare(
    'SELECT mushaf, baseline_mode, baseline_selection FROM students WHERE id = ?'
  ).bind(studentId).first();
  if (!student) return { source: 'none', reason: 'Student not found' };
  if (student.baseline_mode !== 'juz') {
    return { source: 'none', reason: "No plan found, and surah-based Hifz Setup history isn't mapped to a Dhor pool yet — enter this session manually" };
  }
  let pool;
  try { pool = JSON.parse(student.baseline_selection || '[]'); } catch (e) { pool = []; }
  pool = [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b);
  if (pool.length === 0) return { source: 'none', reason: "No memorised juz'/quarters recorded yet in Hifz Setup" };

  const ref = student.mushaf === '15line_madani' ? 'uthmani' : 'waterval';
  const lastLog = await env.DB.prepare(
    'SELECT segment_from, segment_to FROM dhor_log WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1'
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
