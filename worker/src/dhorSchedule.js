import { segmentsPerJuz, unitMarkerCount, segmentRangeForUnitIndex, quarterUnitToJuzQuarter } from '../../shared/data.js';

// Dhor rolling schedule (V3.9.0) — Setup rows 9-11.
//
// Generation is on-demand, not a background job (confirmed in chat): called
// from the frontend whenever it's a good moment to top the window up
// (dhorPage.js on open, and right after Setup saves the schedule
// settings) — never a Cron Trigger. A 7-day window is cheap enough to
// recompute on every call that a scheduled job would be solving a problem
// that doesn't exist yet.
//
// V3.15.0: baseline_selection is now a flat pool of QUARTER-UNIT IDs
// (1-120 — see shared/data.js's quarterUnit* helpers), not whole juz'
// numbers — the finest granularity Dhor's own "Portion per session"
// setting ever uses, so a juz' can now be partially eligible (e.g. just
// one half, from Sabaq Dhor's own progressive move-to-Dhor). Still walks
// the pool in plain ascending order (juz' 1→30, quarter 1→4 within each) —
// NOT the branching "juz 30, then 29, then 1-or-28" study order noted
// elsewhere for initial memorisation. That branching order depends on a
// per-student choice this project doesn't store anywhere yet; rather than
// guess at it silently, this generator uses the simpler deterministic
// order and says so here. baseline_mode='surah' isn't supported yet
// either — mapping arbitrary surah selections onto this quarter pool is a
// separate piece of work (Phase 3), not a silent/wrong approximation.
// Both are flagged in ensureDhorSchedule's `reason` rather than failing
// quietly.

const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // Date.getDay() index → students.dhor_days_of_week value
const WINDOW_DAYS = 7;

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function dateToUTCWeekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
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
function buildChunks(quarterPool, ref, granularity, quantity) {
  const sortedUnits = [...new Set(quarterPool)].sort((a, b) => a - b);
  const quartersPerUnit = granularity === 'quarter' ? 1 : granularity === 'half' ? 2 : 4;
  const sessionSize = quartersPerUnit * quantity; // how many consecutive quarter-units make one session
  const chunks = [];
  let i = 0;
  while (i < sortedUnits.length) {
    // Longest run of consecutive quarter-unit IDs starting at i.
    let runEnd = i;
    while (runEnd + 1 < sortedUnits.length && sortedUnits[runEnd + 1] === sortedUnits[runEnd] + 1) runEnd++;
    let cursor = i;
    while (cursor <= runEnd) {
      const groupEnd = Math.min(cursor + sessionSize - 1, runEnd);
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

// POST /dhor-schedule/ensure — tops up the rolling window. Idempotent:
// safe to call as often as the frontend likes, only ever inserts the rows
// actually missing. Returns { generated: N } on success, or
// { generated: 0, reason: '...' } when nothing CAN be generated yet (not
// configured, no juz'-based baseline, etc.) — a normal, expected state for
// many students, not an error, so this is a 200 either way; a genuine
// failure (DB error) still surfaces as one per the usual error path.
//
// startSegment (V3.11.0, optional): { segment_from, segment_to } — the
// Dhor Plan's new "Tomorrow's portion" field lets a student explicitly
// pick where the rotation should start (Setup's own save handler passes
// this through only when the student actually chose something there).
// When given, it's used as this call's anchor directly (no auto-detect,
// no +1 — the chosen segment IS the first one used); every other call to
// this function (dhorPage.js's routine top-ups, or a Setup save where
// nothing was picked) omits it and keeps the existing auto-detect
// behaviour, so this never resets an already-progressing rotation.
export async function ensureDhorSchedule(env, studentId, startSegment) {
  const student = await env.DB.prepare(
    'SELECT mushaf, baseline_mode, baseline_selection, dhor_granularity, dhor_quantity, ' +
    'dhor_frequency, dhor_days_of_week FROM students WHERE id = ?'
  ).bind(studentId).first();
  if (!student) return { generated: 0, reason: 'Student not found' };

  if (!student.dhor_granularity || !student.dhor_quantity || !student.dhor_frequency || !student.dhor_days_of_week) {
    return { generated: 0, reason: 'Dhor schedule not configured yet' };
  }
  if (!student.mushaf) {
    return { generated: 0, reason: 'Mushaf preference not set yet (Hifz Setup)' };
  }
  if (student.baseline_mode !== 'juz') {
    return { generated: 0, reason: "Dhor schedule generation currently needs a juz'-based Hifz Setup history (surah-based baselines aren't mapped to juz' coverage yet)" };
  }
  let pool;
  try { pool = JSON.parse(student.baseline_selection || '[]'); } catch (e) { pool = []; }
  pool = [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b);
  if (pool.length === 0) return { generated: 0, reason: "No memorised juz'/quarters recorded yet in Hifz Setup" };

  let daysOfWeek;
  try { daysOfWeek = JSON.parse(student.dhor_days_of_week); } catch (e) { daysOfWeek = []; }
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return { generated: 0, reason: 'No days of week selected for the Dhor schedule' };
  }

  // V3.10.0: Hybrid mushaf falls through to 'waterval' here too — Hybrid
  // always uses 13-line quarter/half/juz' rules (confirmed in chat), same
  // as a plain 13-line account, so no special case is needed beyond the
  // existing default.
  const ref = student.mushaf === '15line_madani' ? 'uthmani' : 'waterval';
  const chunks = buildChunks(pool, ref, student.dhor_granularity, student.dhor_quantity);
  if (chunks.length === 0) return { generated: 0, reason: 'Could not build a schedule from the current settings' };

  let nextChunkIndex;
  if (startSegment && startSegment.segment_from != null) {
    const idx = findChunkIndexForSegment(chunks, startSegment.segment_from, startSegment.segment_to);
    nextChunkIndex = idx >= 0 ? idx : 0;
  } else {
    // Anchor: whichever is FURTHER along in the chunk sequence — the last
    // actually-logged dhor entry, or the last plan row that already exists —
    // wins. Logged reality overrides a stale unfulfilled plan (the student
    // did more, or different, than was planned); an existing future plan
    // that's already ahead of the log is left alone rather than
    // double-assigned a chunk it was already given on a previous call.
    const lastLog = await env.DB.prepare(
      'SELECT segment_from, segment_to FROM dhor_log WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1'
    ).bind(studentId).first();
    const lastPlan = await env.DB.prepare(
      "SELECT segment_from, segment_to FROM plans WHERE student_id = ? AND plan_type = 'dhor' ORDER BY target_date DESC, created_at DESC LIMIT 1"
    ).bind(studentId).first();
    const logIndex = lastLog ? findChunkIndexForSegment(chunks, lastLog.segment_from, lastLog.segment_to) : -1;
    const planIndex = lastPlan ? findChunkIndexForSegment(chunks, lastPlan.segment_from, lastPlan.segment_to) : -1;
    nextChunkIndex = (Math.max(logIndex, planIndex) + 1) % chunks.length;
  }

  const sessionsPerActiveDay = student.dhor_frequency === 'twice' ? 2 : 1;
  const today = todayISO();
  let generated = 0;
  let calendarDaysCovered = 0;
  let offset = 1; // start tomorrow

  while (calendarDaysCovered < WINDOW_DAYS) {
    const date = addDays(today, offset);
    offset++;
    const weekday = DAY_ABBR[dateToUTCWeekday(date)];
    const isActiveDay = daysOfWeek.includes(weekday);

    if (isActiveDay) {
      const attendance = await env.DB.prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?')
        .bind(studentId, date).first();
      const isHaidh = attendance && (attendance.status === 'haidh' || attendance.status === 'predicted-haidh');
      if (isHaidh) {
        // No dhor on a haidh day — the plan shifts out rather than losing
        // the session: this date doesn't count toward the 7, and the loop
        // simply continues to the next calendar date.
        continue;
      }
      const { count } = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND target_date = ?"
      ).bind(studentId, date).first();
      const needed = sessionsPerActiveDay - count;
      for (let i = 0; i < needed; i++) {
        const chunk = chunks[nextChunkIndex];
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO plans (student_id, entered_by, plan_type, target_date, segment_from, segment_to, ref, status, created_at)
           VALUES (?, ?, 'dhor', ?, ?, ?, ?, 'planned', ?)`
        ).bind(studentId, studentId, date, chunk.segment_from, chunk.segment_to, ref, now).run();
        nextChunkIndex = (nextChunkIndex + 1) % chunks.length;
        generated++;
      }
    }
    calendarDaysCovered++;
  }

  return { generated };
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

// GET /dhor-schedule/default-entry (Phase A of the Dhor detail rebuild,
// confirmed in chat 2026-08-01) — what should today's Dhor form show by
// default, in priority order:
//   1. today's plan(s), if any (multiple → caller still shows its own
//      picker, same as before; this just reports them)
//   2. no entry for today → the most recently MISSED plan (target_date
//      in the past, still 'planned') — returned WITH that plan's own
//      date, a deliberate backdated catch-up, not today's date
//   3. no missed entries → the closest upcoming plan
//   4. no plan at all, but real Dhor history exists → the segment that
//      follows the last logged entry, walking the eligible pool forward,
//      at THAT ENTRY'S OWN granularity (not the account's configured
//      Setup granularity/quantity — deliberately different from
//      ensureDhorSchedule's own anchor logic just above, which anchors
//      new auto-generated PLAN rows to the account's configured
//      settings; this is about matching what the student actually just
//      did, for a single manual fallback, not projecting the schedule)
//   5. no plan and no history → the very first eligible segment,
//      quarter granularity
// Reuses buildChunks/findChunkIndexForSegment (this file, above) rather
// than duplicating the gap-aware chunking logic a second time.
export async function computeDefaultDhorEntry(env, studentId) {
  const today = todayISO();

  const { results: todaysPlans } = await env.DB.prepare(
    "SELECT * FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND status = 'planned' AND target_date = ? ORDER BY created_at"
  ).bind(studentId, today).all();
  if (todaysPlans.length > 0) return { source: 'today_plan', date: today, plans: todaysPlans };

  const missed = await env.DB.prepare(
    "SELECT * FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND status = 'planned' AND target_date < ? ORDER BY target_date DESC LIMIT 1"
  ).bind(studentId, today).first();
  if (missed) {
    return { source: 'missed_plan', date: missed.target_date, segment_from: missed.segment_from, segment_to: missed.segment_to, ref: missed.ref, plan_id: missed.id };
  }

  const future = await env.DB.prepare(
    "SELECT * FROM plans WHERE student_id = ? AND plan_type = 'dhor' AND status = 'planned' AND target_date > ? ORDER BY target_date ASC LIMIT 1"
  ).bind(studentId, today).first();
  if (future) {
    return { source: 'future_plan', date: today, segment_from: future.segment_from, segment_to: future.segment_to, ref: future.ref, plan_id: future.id };
  }

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
    const chunks = buildChunks(pool, ref, granularity, 1);
    if (chunks.length === 0) return { source: 'none', reason: 'Could not build a next segment from the current pool' };
    const idx = findChunkIndexForSegment(chunks, lastLog.segment_from, lastLog.segment_to);
    const nextIdx = (idx >= 0 ? idx + 1 : 0) % chunks.length;
    const chunk = chunks[nextIdx];
    return { source: 'continue_last', date: today, segment_from: chunk.segment_from, segment_to: chunk.segment_to, ref, plan_id: null };
  }

  const chunks = buildChunks(pool, ref, 'quarter', 1);
  if (chunks.length === 0) return { source: 'none', reason: 'Could not build a starting segment from the current pool' };
  return { source: 'first_segment', date: today, segment_from: chunks[0].segment_from, segment_to: chunks[0].segment_to, ref, plan_id: null };
}

export async function handleGetDhorDefaultEntry(request, env, auth) {
  const result = await computeDefaultDhorEntry(env, auth.id);
  return { data: result };
}
