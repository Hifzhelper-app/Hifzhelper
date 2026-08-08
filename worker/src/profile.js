import { haidhOfficialMaxDuration, haidhMinCycleFrequency } from '../../shared/haidhRules.js';

// GET /profile — the logged-in student's own profile. No student_id override
// for teachers here (yet) — this is a Phase 1, self-service endpoint.
// Current as of V3.39.
export async function handleGetProfile(request, env, auth) {
  const row = await env.DB.prepare(
    'SELECT id, name, role, gender, track_haidh, setup_complete, journal_name, mushaf, ' +
    'baseline_selection, target_mistakes_per_juz, target_minutes_per_juz, target_frequency_days, ' +
    'dhor_granularity, dhor_quantity, dhor_frequency, dhor_days_of_week, ' +
    'haidh_cycle_length, haidh_period_length, haidh_next_expected, haidh_ruling ' +
    'FROM students WHERE id = ?'
  ).bind(auth.id).first();
  if (!row) return { error: 'Student not found', status: 404 };
  // baseline_selection and dhor_days_of_week are stored as JSON strings —
  // parse them back to real arrays for the client rather than making every
  // caller do it.
  if (row.baseline_selection != null) {
    try { row.baseline_selection = JSON.parse(row.baseline_selection); }
    catch (e) { row.baseline_selection = null; }
  }
  if (row.dhor_days_of_week != null) {
    try { row.dhor_days_of_week = JSON.parse(row.dhor_days_of_week); }
    catch (e) { row.dhor_days_of_week = null; }
  }
  return { data: row };
}

// V3.36, confirmed in chat: Hybrid removed entirely -- traced and
// confirmed it never actually did anything distinct from 13line (its ref
// logic fell through to the same 'waterval' branch 13line uses).
// Replaced with 15line_indopak, using its own verified page/line dataset,
// not Madina's.
const VALID_MUSHAF = ['13line', '15line_madani', '15line_indopak'];
const VALID_DHOR_GRANULARITY = ['juz', 'half', 'quarter'];
const VALID_DHOR_FREQUENCY = ['daily', 'twice'];
const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const VALID_HAIDH_RULING = ['hanafi', 'shafii'];

// POST /profile — a student sets up (or later edits) their own name/gender/
// haidh preference/journal name/mushaf choice/history baseline/default
// targets/Dhor schedule/Haidh prediction settings, and marks setup as
// complete. Every field is optional on each call (partial updates allowed)
// except that completing setup requires name to be present at least once.
//
// V3.8.0: independent Setup sections all save through this same endpoint —
// each just sends the subset of fields it owns, and any of them may set
// setup_complete:true (saving any one section is enough to mark setup
// complete, not just one specific one). V3.9.0 adds the Dhor schedule and
// Haidh prediction sections on the same basis.
export async function handleSaveProfile(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  if (body.gender != null && !['M', 'F'].includes(body.gender)) {
    return { error: 'gender must be M or F', status: 400 };
  }
  if (body.track_haidh != null && ![0, 1, true, false].includes(body.track_haidh)) {
    return { error: 'track_haidh must be boolean', status: 400 };
  }
  if (body.haidh_ruling != null && !VALID_HAIDH_RULING.includes(body.haidh_ruling)) {
    return { error: `haidh_ruling must be one of: ${VALID_HAIDH_RULING.join(', ')}`, status: 400 };
  }
  if (body.mushaf != null && !VALID_MUSHAF.includes(body.mushaf)) {
    return { error: `mushaf must be one of: ${VALID_MUSHAF.join(', ')}`, status: 400 };
  }
  if (body.baseline_selection != null) {
    if (!Array.isArray(body.baseline_selection) || !body.baseline_selection.every(n => Number.isInteger(n))) {
      return { error: 'baseline_selection must be an array of integers', status: 400 };
    }
  }
  for (const key of ['target_mistakes_per_juz', 'target_minutes_per_juz', 'target_frequency_days']) {
    if (body[key] != null && (!Number.isInteger(body[key]) || body[key] < 0)) {
      return { error: `${key} must be a non-negative integer`, status: 400 };
    }
  }
  if (body.dhor_granularity != null && !VALID_DHOR_GRANULARITY.includes(body.dhor_granularity)) {
    return { error: `dhor_granularity must be one of: ${VALID_DHOR_GRANULARITY.join(', ')}`, status: 400 };
  }
  if (body.dhor_quantity != null && (!Number.isInteger(body.dhor_quantity) || body.dhor_quantity < 1)) {
    return { error: 'dhor_quantity must be a positive integer', status: 400 };
  }
  if (body.dhor_frequency != null && !VALID_DHOR_FREQUENCY.includes(body.dhor_frequency)) {
    return { error: `dhor_frequency must be one of: ${VALID_DHOR_FREQUENCY.join(', ')}`, status: 400 };
  }
  if (body.dhor_days_of_week != null) {
    if (!Array.isArray(body.dhor_days_of_week) || !body.dhor_days_of_week.every(d => VALID_DAYS.includes(d))) {
      return { error: `dhor_days_of_week must be an array from: ${VALID_DAYS.join(', ')}`, status: 400 };
    }
  }
  if (body.haidh_cycle_length != null && (!Number.isInteger(body.haidh_cycle_length) || body.haidh_cycle_length < 1)) {
    return { error: 'haidh_cycle_length must be a positive integer', status: 400 };
  }
  if (body.haidh_period_length != null && (!Number.isInteger(body.haidh_period_length) || body.haidh_period_length < 1)) {
    return { error: 'haidh_period_length must be a positive integer', status: 400 };
  }
  if (body.haidh_next_expected != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.haidh_next_expected)) {
    return { error: 'haidh_next_expected must be YYYY-MM-DD', status: 400 };
  }

  const current = await env.DB.prepare(
    'SELECT name, gender, track_haidh, journal_name, mushaf, ' +
    'baseline_selection, ' +
    'target_mistakes_per_juz, target_minutes_per_juz, target_frequency_days, ' +
    'dhor_granularity, dhor_quantity, dhor_frequency, dhor_days_of_week, ' +
    'haidh_cycle_length, haidh_period_length, haidh_next_expected, haidh_ruling FROM students WHERE id = ?'
  ).bind(auth.id).first();
  if (!current) return { error: 'Student not found', status: 404 };

  const name = body.name != null ? body.name : current.name;
  const gender = body.gender != null ? body.gender : current.gender;
  const trackHaidh = body.track_haidh != null ? (body.track_haidh ? 1 : 0) : current.track_haidh;
  const journalName = body.journal_name != null ? body.journal_name : current.journal_name;
  const mushaf = body.mushaf != null ? body.mushaf : current.mushaf;
  const baselineSelection = body.baseline_selection != null
    ? JSON.stringify(body.baseline_selection)
    : current.baseline_selection;
  const targetMistakes = body.target_mistakes_per_juz != null ? body.target_mistakes_per_juz : current.target_mistakes_per_juz;
  const targetMinutes = body.target_minutes_per_juz != null ? body.target_minutes_per_juz : current.target_minutes_per_juz;
  const targetFrequency = body.target_frequency_days != null ? body.target_frequency_days : current.target_frequency_days;
  const dhorGranularity = body.dhor_granularity != null ? body.dhor_granularity : current.dhor_granularity;
  const dhorQuantity = body.dhor_quantity != null ? body.dhor_quantity : current.dhor_quantity;
  const dhorFrequency = body.dhor_frequency != null ? body.dhor_frequency : current.dhor_frequency;
  const dhorDaysOfWeek = body.dhor_days_of_week != null
    ? JSON.stringify(body.dhor_days_of_week)
    : current.dhor_days_of_week;
  const haidhCycleLength = body.haidh_cycle_length != null ? body.haidh_cycle_length : current.haidh_cycle_length;
  const haidhPeriodLength = body.haidh_period_length != null ? body.haidh_period_length : current.haidh_period_length;
  const haidhNextExpected = body.haidh_next_expected != null ? body.haidh_next_expected : current.haidh_next_expected;
  const haidhRuling = body.haidh_ruling != null ? body.haidh_ruling : (current.haidh_ruling || 'hanafi');
  const setupComplete = body.setup_complete ? 1 : 0;

  // V3.39: cross-field sense check — a duration and a frequency can each
  // pass their own standalone "positive integer" check above and still
  // be an invalid COMBINATION (e.g. a 10-day duration with a 23-day
  // frequency leaves only a 13-day gap, short of the required 15).
  // Checked against the EFFECTIVE values (this request's new value, or
  // else whatever's already stored) since Setup sections save
  // independently and either field alone might be the one changing.
  if (haidhPeriodLength != null && haidhPeriodLength > haidhOfficialMaxDuration(haidhRuling)) {
    return { error: `Duration cannot exceed ${haidhOfficialMaxDuration(haidhRuling)} days for the selected ruling`, status: 400 };
  }
  if (haidhCycleLength != null && haidhPeriodLength != null) {
    const minFrequency = haidhMinCycleFrequency(haidhPeriodLength);
    if (haidhCycleLength < minFrequency) {
      return { error: `Haidh cycle frequency must be at least ${minFrequency} days for a ${haidhPeriodLength}-day duration`, status: 400 };
    }
  }

  await env.DB.prepare(
    'UPDATE students SET name = ?, gender = ?, track_haidh = ?, journal_name = ?, mushaf = ?, ' +
    'baseline_selection = ?, target_mistakes_per_juz = ?, target_minutes_per_juz = ?, ' +
    'target_frequency_days = ?, dhor_granularity = ?, dhor_quantity = ?, dhor_frequency = ?, ' +
    'dhor_days_of_week = ?, haidh_cycle_length = ?, haidh_period_length = ?, haidh_next_expected = ?, haidh_ruling = ?, ' +
    'setup_complete = CASE WHEN ? = 1 THEN 1 ELSE setup_complete END WHERE id = ?'
  ).bind(
    name, gender, trackHaidh, journalName, mushaf,
    baselineSelection, targetMistakes, targetMinutes, targetFrequency,
    dhorGranularity, dhorQuantity, dhorFrequency, dhorDaysOfWeek,
    haidhCycleLength, haidhPeriodLength, haidhNextExpected, haidhRuling,
    setupComplete, auth.id
  ).run();

  return { data: { saved: true } };
}
