// ============================================================
// Hifzhelper -- maktab settings (V3.65.0, maktab delivery (g)).
// One row, four settings, for THIS maktab (see migration 0020).
//
// The gate is deliberately ASYMMETRIC, confirmed in chat 2026-08-16:
//   READ  -> teacher+  : every teacher's Sabaq Dhor card must know the
//                        maktab mushaf to render portions at all, so the
//                        read cannot be admin-only.
//   WRITE -> admin ONLY: requireAdmin, the same gate registration and
//                        pin-reset use. NOT isTeacherOrAbove -- this is
//                        exactly the case that helper must not govern.
// The screen itself is admin-only too (js/auth.js nav gating), so a
// teacher never sees the settings; their cards just read the mushaf.
// ============================================================

import { isTeacherOrAbove } from './utils.js';

// V3.74.0: 15line_indopak added. shared/data.js already knew this value
// (its script ref maps it to 'indopak'); only this whitelist did not, so
// choosing it would have failed with a 400 while the UI happily offered it.
const MUSHAFS = ['13line', '15line_madani', '15line_indopak'];

// The row always exists (migration 0020 inserts it), so there is no
// "not configured yet" branch anywhere. If it is somehow missing --
// migration not run -- say so plainly rather than inventing defaults
// that would silently disagree with the DB.
export async function handleGetMaktabSettings(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const row = await env.DB.prepare(
    'SELECT mushaf, maktab_day_min, absence_flag_days, name, timezone FROM maktab_settings WHERE id = 1'
  ).first();
  if (!row) return { error: 'Maktab settings row is missing — run migration 0020', status: 500 };
  return { data: row };
}

export async function handleSaveMaktabSettings(request, env, auth) {
  if (!auth || auth.role !== 'admin') return { error: 'Not authorized', status: 403 };
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object', status: 400 };

  const updates = [];
  const values = [];
  if (body.mushaf !== undefined) {
    if (!MUSHAFS.includes(body.mushaf)) return { error: `mushaf must be one of: ${MUSHAFS.join(', ')}`, status: 400 };
    updates.push('mushaf = ?'); values.push(body.mushaf);
  }
  for (const [field, label] of [['maktab_day_min', 'maktab_day_min'], ['absence_flag_days', 'absence_flag_days']]) {
    if (body[field] === undefined) continue;
    const n = Number(body[field]);
    if (!Number.isInteger(n) || n < 1) return { error: `${label} must be a whole number of 1 or more`, status: 400 };
    updates.push(`${field} = ?`); values.push(n);
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return { error: 'name must be text', status: 400 };
    const trimmed = body.name.trim();
    if (trimmed.length > 60) return { error: 'name must be 60 characters or fewer', status: 400 };
    updates.push('name = ?'); values.push(trimmed);
  }
  // V3.78.0: the maktab timezone — fifth setting, decided 2026-08-17;
  // everyone sees maktab time (user, 2026-08-27). An IANA zone name,
  // validated by actually constructing a formatter with it; empty clears
  // back to "not set" (device/UTC behaviour).
  if (body.timezone !== undefined) {
    if (body.timezone === null || body.timezone === '') {
      updates.push('timezone = NULL');
    } else {
      if (typeof body.timezone !== 'string') return { error: 'timezone must be text', status: 400 };
      try { new Intl.DateTimeFormat('en-CA', { timeZone: body.timezone }); }
      catch (e) { return { error: `Unknown timezone: ${body.timezone}`, status: 400 }; }
      updates.push('timezone = ?'); values.push(body.timezone);
    }
  }
  if (updates.length === 0) return { error: 'No valid fields to update', status: 400 };

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  await env.DB.prepare(`UPDATE maktab_settings SET ${updates.join(', ')} WHERE id = 1`).bind(...values).run();

  const row = await env.DB.prepare(
    'SELECT mushaf, maktab_day_min, absence_flag_days, name, timezone FROM maktab_settings WHERE id = 1'
  ).first();
  return { data: row };
}

// Shared reader for other worker modules ((f)'s derived attendance needs
// both numbers, (h)'s prepop needs the mushaf) -- one place that knows
// the row's shape, rather than each module writing its own SELECT.
export async function readMaktabSettings(env) {
  const row = await env.DB.prepare(
    'SELECT mushaf, maktab_day_min, absence_flag_days, name, timezone FROM maktab_settings WHERE id = 1'
  ).first();
  return row || { mushaf: '13line', maktab_day_min: 3, absence_flag_days: 30, name: '' };
}
