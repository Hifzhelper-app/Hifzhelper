import { segmentsPerJuz, unitMarkerCount } from '../../shared/data.js';

// Dhor rolling schedule (V3.9.0) — Setup rows 9-11.
//
// Generation is on-demand, not a background job (confirmed in chat): called
// from the frontend whenever it's a good moment to top the window up
// (dhorPage.js on open, and right after Setup saves the schedule
// settings) — never a Cron Trigger. A 7-day window is cheap enough to
// recompute on every call that a scheduled job would be solving a problem
// that doesn't exist yet.
//
// SCOPE NOTE: dhor_granularity/quantity walk the student's memorised juz'
// pool in plain ascending numeric order (1→30, filtered to whatever
// baseline_mode='juz' recorded) — NOT the branching "juz 30, then 29, then
// 1-or-28, then the rest ascending" study order noted elsewhere for
// initial memorisation. That branching order depends on a per-student
// choice this project doesn't store anywhere yet; rather than guess at it
// silently, this generator uses the simpler deterministic order and says
// so here. baseline_mode='surah' isn't supported yet either, for a similar
// reason — mapping arbitrary surah selections onto juz' coverage needs
// real ayah-boundary math that's a separate piece of work, not a
// silent/wrong approximation. Both are flagged in ensureDhorSchedule's
// `reason` rather than failing quietly.

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
// memorised pool. Each chunk stays entirely within ONE juz' — never spans
// two, even when they're numerically adjacent in the pool — so a pool
// with gaps (e.g. juz' 30, 29, 1 memorised but not 2-28, the normal
// early-stage pattern) never produces a segment range that silently
// swallows unmemorised juz' in between. This means a chunk can come out
// shorter than `quantity` units right at a juz' boundary — a minor,
// harmless unevenness, not a bug.
function buildChunks(pool, ref, granularity, quantity) {
  const perJuz = segmentsPerJuz(ref);
  const sessionSize = unitMarkerCount(ref, granularity) * quantity;
  const chunks = [];
  for (const juz of pool) {
    const juzStart = (juz - 1) * perJuz + 1;
    const juzEnd = juz * perJuz;
    let cursor = juzStart;
    while (cursor <= juzEnd) {
      const end = Math.min(cursor + sessionSize - 1, juzEnd);
      chunks.push({ segment_from: cursor, segment_to: end });
      cursor = end + 1;
    }
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
export async function ensureDhorSchedule(env, studentId) {
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
  pool = [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 30))].sort((a, b) => a - b);
  if (pool.length === 0) return { generated: 0, reason: "No memorised juz' recorded yet in Hifz Setup" };

  let daysOfWeek;
  try { daysOfWeek = JSON.parse(student.dhor_days_of_week); } catch (e) { daysOfWeek = []; }
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return { generated: 0, reason: 'No days of week selected for the Dhor schedule' };
  }

  const ref = student.mushaf === '15line_madani' ? 'uthmani' : 'waterval';
  const chunks = buildChunks(pool, ref, student.dhor_granularity, student.dhor_quantity);
  if (chunks.length === 0) return { generated: 0, reason: 'Could not build a schedule from the current settings' };

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
  let nextChunkIndex = (Math.max(logIndex, planIndex) + 1) % chunks.length;

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
  const result = await ensureDhorSchedule(env, auth.id);
  return { data: result };
}
