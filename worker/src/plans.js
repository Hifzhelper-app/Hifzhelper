// Plans are simpler than the four logs — no duplicate detection, no
// comment/feedback layer, no privacy (a plan is just an intention, made by
// the student or a teacher for them). Kept as its own small module rather
// than squeezed through logHelpers.js, since its shape genuinely differs
// (status/completed_log_id have no equivalent in the logs).
//
// create/update/delete removed 2026-08-03 (confirmed in chat): zero
// callers anywhere in the app once checked directly -- Dhor's own plan
// features go through baseline_selection/the queue model instead, and
// Sabaq/Sabaq Dhor have no planning UI at all. GET stays: it's what
// journal.js's own upcoming-plans view (the one real caller) uses. The
// validateBody/isValidDate/isInRange helpers those 3 handlers needed are
// removed with them -- nothing else in this file used them.

// GET /plans?date=X (plans for one specific day — the primary use case:
// "what's planned for today, to show as the default Dhor input") or
// ?since=X (a range, for a planning/calendar view) or neither (all plans).
export async function handleGetPlans(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };

  const date = url.searchParams.get('date');
  const since = url.searchParams.get('since');
  let query = 'SELECT * FROM plans WHERE student_id = ?';
  const params = [studentId];
  if (date) { query += ' AND target_date = ?'; params.push(date); }
  else if (since) { query += ' AND target_date >= ?'; params.push(since); }
  query += ' ORDER BY target_date, created_at';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return { data: results };
}
