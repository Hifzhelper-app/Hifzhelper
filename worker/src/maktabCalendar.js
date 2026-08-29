// ============================================================
// maktabCalendar.js — V3.87.0: the MAKTAB CALENDAR (user spec,
// 2026-08-28, recorded in TODO).
//
// INFORMATION ONLY: nothing here touches the attendance derivation —
// the ONE exception the user named is TERMS, which live here and DRIVE
// the attendance default period ("terms will be used to drive
// attendance"): the default window is the term containing today
// (termContainingToday below, consumed by maktabAttendance.js).
//
// Reads are open to every authenticated user (students see the
// calendar READ-ONLY); every mutation is teacher+.
//
// Islamic significant days ship as PRE-LOADED predictions — the
// Jamiatul Ulama (KZN, South Africa) 2025–2030 Most Likely dates from
// the user's PDF — and stay ADJUSTABLE, since actual moon sightings
// overrule any prediction. Public holidays are SOUTH AFRICA's, DATES
// ONLY (label NULL, the user's call), generated per year: the ten
// fixed days, Good Friday + Family Day from the Easter computus, and
// the statutory rule that a holiday falling on a SUNDAY makes the
// FOLLOWING MONDAY a public holiday.
// ============================================================

import { isTeacherOrAbove, isValidDate } from './utils.js';

// The user's PDF, transcribed: Most Likely dates, 2025–2030.
export const ISLAMIC_PREDICTIONS = [
  ['Laylatul-Bara\'ah (Eve)', '2025-02-13'], ['First Taraweeh', '2025-03-01'], ['First Fast', '2025-03-02'],
  ['Eid-ul-Fitr', '2025-03-31'], ['Eid-ul-Adha', '2025-06-07'], ['New Islamic Year', '2025-06-27'], ['\'Aashuraa', '2025-07-06'],
  ['Laylatul-Bara\'ah (Eve)', '2026-02-03'], ['First Taraweeh', '2026-02-18'], ['First Fast', '2026-02-19'],
  ['Eid-ul-Fitr', '2026-03-21'], ['Eid-ul-Adha', '2026-05-28'], ['New Islamic Year', '2026-06-17'], ['\'Aashuraa', '2026-06-26'],
  ['Laylatul-Bara\'ah (Eve)', '2027-01-23'], ['First Taraweeh', '2027-02-08'], ['First Fast', '2027-02-09'],
  ['Eid-ul-Fitr', '2027-03-10'], ['Eid-ul-Adha', '2027-05-17'], ['New Islamic Year', '2027-06-07'], ['\'Aashuraa', '2027-06-16'],
  ['Laylatul-Bara\'ah (Eve)', '2028-01-12'], ['First Taraweeh', '2028-01-28'], ['First Fast', '2028-01-29'],
  ['Eid-ul-Fitr', '2028-02-28'], ['Eid-ul-Adha', '2028-05-06'], ['New Islamic Year', '2028-05-26'], ['\'Aashuraa', '2028-06-04'],
  ['First Taraweeh', '2029-01-16'], ['First Fast', '2029-01-17'], ['Eid-ul-Fitr', '2029-02-16'],
  ['Eid-ul-Adha', '2029-04-25'], ['New Islamic Year', '2029-05-16'], ['\'Aashuraa', '2029-05-25'], ['Laylatul-Bara\'ah (Eve)', '2029-12-20'],
  ['First Taraweeh', '2030-01-05'], ['First Fast', '2030-01-06'], ['Eid-ul-Fitr', '2030-02-05'],
  ['Eid-ul-Adha', '2030-04-14'], ['New Islamic Year', '2030-05-05'], ['\'Aashuraa', '2030-05-14'], ['Laylatul-Bara\'ah (Eve)', '2030-12-10'],
];

// Anonymous Gregorian computus — Easter Sunday for a year.
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

// SA public holidays for a year: dates only. Sunday → the following
// Monday is ALSO a public holiday (user: "if a ph falls on a sunday the
// fllg monday is a public holiday").
export function southAfricanHolidays(year) {
  const fixed = ['01-01', '03-21', '04-27', '05-01', '06-16', '08-09', '09-24', '12-16', '12-25', '12-26']
    .map(md => `${year}-${md}`);
  const easter = easterSunday(year);
  const dates = new Set([...fixed, iso(plusDays(easter, -2)) /* Good Friday */, iso(plusDays(easter, 1)) /* Family Day */]);
  for (const d of [...dates]) {
    if (new Date(d + 'T00:00:00Z').getUTCDay() === 0) dates.add(iso(plusDays(new Date(d + 'T00:00:00Z'), 1)));
  }
  return [...dates].sort();
}

// ---------- terms ----------
export async function handleGetTerms(request, env, auth) {
  if (!auth) return { error: 'Not authenticated', status: 401 };
  const r = await env.DB.prepare('SELECT * FROM maktab_terms ORDER BY term_from').bind().all();
  return { data: r.results };
}

export async function handleCreateTerm(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const b = await request.json();
  const name = String(b.name || '').trim();
  if (!name || name.length > 40) return { error: 'A term needs a name (max 40 chars)', status: 400 };
  if (!isValidDate(b.term_from) || !isValidDate(b.term_to)) return { error: 'Term dates must be YYYY-MM-DD', status: 400 };
  if (b.term_from > b.term_to) return { error: 'The term cannot end before it starts', status: 400 };
  const r = await env.DB.prepare('INSERT INTO maktab_terms (name, term_from, term_to) VALUES (?, ?, ?)')
    .bind(name, b.term_from, b.term_to).run();
  return { data: { id: r.meta.last_row_id } };
}

export async function handleUpdateTerm(request, env, auth, id) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const b = await request.json();
  const cur = await env.DB.prepare('SELECT * FROM maktab_terms WHERE id = ?').bind(id).first();
  if (!cur) return { error: 'Term not found', status: 404 };
  const name = b.name !== undefined ? String(b.name).trim() : cur.name;
  const from = b.term_from !== undefined ? b.term_from : cur.term_from;
  const to = b.term_to !== undefined ? b.term_to : cur.term_to;
  if (!name || name.length > 40) return { error: 'A term needs a name (max 40 chars)', status: 400 };
  if (!isValidDate(from) || !isValidDate(to) || from > to) return { error: 'Term dates must be YYYY-MM-DD, start before end', status: 400 };
  await env.DB.prepare('UPDATE maktab_terms SET name = ?, term_from = ?, term_to = ? WHERE id = ?').bind(name, from, to, id).run();
  return { data: { ok: true } };
}

export async function handleDeleteTerm(request, env, auth, id) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  await env.DB.prepare('DELETE FROM maktab_terms WHERE id = ?').bind(id).run();
  return { data: { ok: true } };
}

// The attendance default period: the term containing today.
export async function termContainingToday(env, today) {
  return await env.DB.prepare(
    'SELECT * FROM maktab_terms WHERE term_from <= ?1 AND term_to >= ?1 ORDER BY term_from DESC LIMIT 1'
  ).bind(today).first();
}

// ---------- calendar entries ----------
export async function handleGetCalendar(request, env, auth) {
  if (!auth) return { error: 'Not authenticated', status: 401 };
  const url = new URL(request.url);
  const year = url.searchParams.get('year');
  if (year && !/^\d{4}$/.test(year)) return { error: 'year must be YYYY', status: 400 };
  const r = year
    ? await env.DB.prepare("SELECT * FROM maktab_calendar WHERE date_from <= ?1 AND date_to >= ?2 ORDER BY date_from")
        .bind(`${year}-12-31`, `${year}-01-01`).all()
    : await env.DB.prepare('SELECT * FROM maktab_calendar ORDER BY date_from').bind().all();
  return { data: r.results };
}

export async function handleCreateCalendarEntry(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const b = await request.json();
  const type = b.type;
  if (type !== 'islamic' && type !== 'holiday') return { error: "type must be 'islamic' or 'holiday'", status: 400 };
  const from = b.date_from, to = b.date_to || b.date_from;
  if (!isValidDate(from) || !isValidDate(to) || from > to) return { error: 'Dates must be YYYY-MM-DD, start before end', status: 400 };
  const label = b.label ? String(b.label).trim().slice(0, 60) : null;   // holidays: dates only (label NULL)
  const r = await env.DB.prepare("INSERT INTO maktab_calendar (date_from, date_to, label, type, source) VALUES (?, ?, ?, ?, 'manual')")
    .bind(from, to, label, type).run();
  return { data: { id: r.meta.last_row_id } };
}

export async function handleUpdateCalendarEntry(request, env, auth, id) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const b = await request.json();
  const cur = await env.DB.prepare('SELECT * FROM maktab_calendar WHERE id = ?').bind(id).first();
  if (!cur) return { error: 'Entry not found', status: 404 };
  const from = b.date_from !== undefined ? b.date_from : cur.date_from;
  const to = b.date_to !== undefined ? b.date_to : cur.date_to;
  const label = b.label !== undefined ? (b.label ? String(b.label).trim().slice(0, 60) : null) : cur.label;
  if (!isValidDate(from) || !isValidDate(to) || from > to) return { error: 'Dates must be YYYY-MM-DD, start before end', status: 400 };
  await env.DB.prepare('UPDATE maktab_calendar SET date_from = ?, date_to = ?, label = ? WHERE id = ?').bind(from, to, label, id).run();
  return { data: { ok: true } };
}

export async function handleDeleteCalendarEntry(request, env, auth, id) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  await env.DB.prepare('DELETE FROM maktab_calendar WHERE id = ?').bind(id).run();
  return { data: { ok: true } };
}

// ============================================================
// V3.88.0: the PROPOSE → EDIT → CONFIRM workflow (user, 2026-08-29)
// replaced the V3.87.0 blind loaders. A proposal is COMPUTED and
// returned, never inserted; the settings popup lets the maktab edit,
// delete, add; Confirm REGENERATES that type+year — the confirmed
// list becomes the truth. This also closes the V3.87.0 duplicate bug
// properly (with migration 0027's unique index as the backstop) and
// the adjusted-prediction re-insert hole: a proposal row is dropped
// when that label (islamic) or any holiday set (holiday) already
// exists for the year, whatever date it has moved to.
// ============================================================

// The proposal: what the maktab COULD add for this year, merged view —
// current rows first (id'd), then proposal rows not already covered.
export async function handleGetProposal(request, env, auth, type) {
  if (!auth) return { error: 'Not authenticated', status: 401 };
  const url = new URL(request.url);
  const year = url.searchParams.get('year');
  if (!/^\d{4}$/.test(year || '')) return { error: 'year must be YYYY', status: 400 };
  const current = (await env.DB.prepare(
    "SELECT * FROM maktab_calendar WHERE type = ?1 AND date_from >= ?2 AND date_from <= ?3 ORDER BY date_from"
  ).bind(type, `${year}-01-01`, `${year}-12-31`).all()).results;
  let proposed = [];
  if (type === 'holiday') {
    // any holidays already saved for the year → the proposal is only the
    // missing generated dates; a fresh year proposes the full set
    const have = new Set(current.map(r => r.date_from));
    proposed = southAfricanHolidays(parseInt(year)).filter(d => !have.has(d))
      .map(d => ({ date_from: d, date_to: d, label: null }));
  } else {
    // islamic: dedupe by LABEL within the year — an adjusted date stays
    // adjusted and its day is never re-proposed (the V3.87.0 hole)
    const have = new Set(current.map(r => r.label));
    proposed = ISLAMIC_PREDICTIONS.filter(([label, d]) => d.startsWith(year) && !have.has(label))
      .map(([label, d]) => ({ date_from: d, date_to: d, label }));
  }
  return { data: { year, type, current, proposed } };
}

// Confirm: the submitted list BECOMES that type+year. Delete-then-insert
// keeps it simple and duplicate-proof (0027's unique index backstops;
// OR IGNORE swallows same-list repeats).
export async function handleConfirmList(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const b = await request.json();
  const type = b.type;
  if (type !== 'islamic' && type !== 'holiday') return { error: "type must be 'islamic' or 'holiday'", status: 400 };
  if (!/^\d{4}$/.test(String(b.year || ''))) return { error: 'year must be YYYY', status: 400 };
  const rows = Array.isArray(b.entries) ? b.entries : [];
  for (const r of rows) {
    if (!isValidDate(r.date_from) || !String(r.date_from).startsWith(String(b.year))) {
      return { error: `Every date must be a valid YYYY-MM-DD inside ${b.year}`, status: 400 };
    }
    if (type === 'islamic' && !(r.label && String(r.label).trim())) {
      return { error: 'Every significant day needs a name', status: 400 };
    }
  }
  await env.DB.prepare(
    "DELETE FROM maktab_calendar WHERE type = ?1 AND date_from >= ?2 AND date_from <= ?3"
  ).bind(type, `${b.year}-01-01`, `${b.year}-12-31`).run();
  let added = 0;
  for (const r of rows) {
    const label = type === 'holiday' ? null : String(r.label).trim().slice(0, 60);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO maktab_calendar (date_from, date_to, label, type, source) VALUES (?, ?, ?, ?, 'confirmed')"
    ).bind(r.date_from, r.date_from, label, type).run();
    added++;
  }
  return { data: { ok: true, year: b.year, type, count: added } };
}
