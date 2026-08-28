// ============================================================
// Hifzhelper — tajweed tags + maktab groups (V3.78.0, delivery 3).
//
// Two instances of ONE shape, built together on purpose (the 2026-08-26
// observation that made this delivery cheaper): an admin-managed list of
// named rows, referenced elsewhere by ID, where
//   - renaming propagates everywhere (references hold the id, not the name),
//   - RETIRE replaces delete (a retired row stops being offered for new
//     use, but anything already pointing at it keeps a name forever).
// Tags are referenced by the six log tables' tajweed_tag_ids CSV; groups
// by students.group_id.
//
// Gates, matching maktab settings' asymmetry: READ teacher+ (every card's
// picker needs the tag names; the summary needs group names) — plus tags
// are readable by STUDENTS too, since the PJ cards carry the same picker.
// WRITE admin only.
// ============================================================

function requireAdmin(auth) {
  if (!auth || auth.role !== 'admin') return { error: 'Not authorized', status: 403 };
  return null;
}

function normName(v) { return typeof v === 'string' ? v.trim() : ''; }

// ---------- tajweed tags ----------

// GET /tajweed-tags — ANY authenticated account (students' PJ cards use the
// picker). Returns every row, retired included: an old entry referencing a
// retired tag still needs its name.
export async function handleGetTajweedTags(request, env, auth) {
  if (!auth) return { error: 'Not authenticated', status: 401 };
  const { results } = await env.DB.prepare(
    'SELECT id, name, major, retired FROM tajweed_tags ORDER BY retired, name'
  ).all();
  return { data: results };
}

// POST /tajweed-tags — admin. body: { name, major? }
export async function handleCreateTajweedTag(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const name = normName(body && body.name);
  if (!name) return { error: 'name is required', status: 400 };
  if (name.length > 40) return { error: 'name must be 40 characters or fewer', status: 400 };
  const existing = await env.DB.prepare('SELECT id FROM tajweed_tags WHERE name = ?').bind(name).first();
  if (existing) return { error: `A tag named "${name}" already exists`, status: 409 };
  const r = await env.DB.prepare('INSERT INTO tajweed_tags (name, major) VALUES (?, ?)').bind(name, body.major ? 1 : 0).run();
  return { data: { id: r.meta.last_row_id, name, major: body.major ? 1 : 0, retired: 0 } };
}

// POST /tajweed-tags/update — admin. body: { id, name?, major?, retired? }
// Rename propagates by construction; retired flips both ways (a retired
// tag can come back).
export async function handleUpdateTajweedTag(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const id = Number(body && body.id);
  if (!Number.isInteger(id)) return { error: 'id is required', status: 400 };
  const row = await env.DB.prepare('SELECT id FROM tajweed_tags WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  const sets = [], values = [];
  if (body.name !== undefined) {
    const name = normName(body.name);
    if (!name) return { error: 'name cannot be empty', status: 400 };
    if (name.length > 40) return { error: 'name must be 40 characters or fewer', status: 400 };
    const clash = await env.DB.prepare('SELECT id FROM tajweed_tags WHERE name = ? AND id != ?').bind(name, id).first();
    if (clash) return { error: `A tag named "${name}" already exists`, status: 409 };
    sets.push('name = ?'); values.push(name);
  }
  if (body.major !== undefined) { sets.push('major = ?'); values.push(body.major ? 1 : 0); }
  if (body.retired !== undefined) { sets.push('retired = ?'); values.push(body.retired ? 1 : 0); }
  if (!sets.length) return { error: 'No valid fields to update', status: 400 };
  values.push(id);
  await env.DB.prepare(`UPDATE tajweed_tags SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return { data: { saved: true } };
}

// ---------- maktab groups ----------

// GET /maktab-groups — teacher+ (the admin card and the settings screen;
// the summary itself gets group names joined into its own payload).
export async function handleGetMaktabGroups(request, env, auth) {
  if (!auth || (auth.role !== 'teacher' && auth.role !== 'admin')) return { error: 'Not authorized', status: 403 };
  const { results } = await env.DB.prepare(
    'SELECT id, name, description, retired FROM maktab_groups ORDER BY retired, name'   // description: V3.79.0, info-only
  ).all();
  return { data: results };
}

// POST /maktab-groups — admin. body: { name }
export async function handleCreateMaktabGroup(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const name = normName(body && body.name);
  if (!name) return { error: 'name is required', status: 400 };
  if (name.length > 40) return { error: 'name must be 40 characters or fewer', status: 400 };
  const existing = await env.DB.prepare('SELECT id FROM maktab_groups WHERE name = ?').bind(name).first();
  if (existing) return { error: `A group named "${name}" already exists`, status: 409 };
  const r = await env.DB.prepare('INSERT INTO maktab_groups (name) VALUES (?)').bind(name).run();
  return { data: { id: r.meta.last_row_id, name, retired: 0 } };
}

// POST /maktab-groups/update — admin. body: { id, name?, retired? }
export async function handleUpdateMaktabGroup(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const id = Number(body && body.id);
  if (!Number.isInteger(id)) return { error: 'id is required', status: 400 };
  const row = await env.DB.prepare('SELECT id FROM maktab_groups WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  const sets = [], values = [];
  if (body.name !== undefined) {
    const name = normName(body.name);
    if (!name) return { error: 'name cannot be empty', status: 400 };
    if (name.length > 40) return { error: 'name must be 40 characters or fewer', status: 400 };
    const clash = await env.DB.prepare('SELECT id FROM maktab_groups WHERE name = ? AND id != ?').bind(name, id).first();
    if (clash) return { error: `A group named "${name}" already exists`, status: 409 };
    sets.push('name = ?'); values.push(name);
  }
  // V3.79.0: the info-only description. Empty clears to NULL.
  if (body.description !== undefined) {
    if (body.description === null || body.description === '') { sets.push('description = NULL'); }
    else {
      if (typeof body.description !== 'string') return { error: 'description must be text', status: 400 };
      const d = body.description.trim();
      if (d.length > 200) return { error: 'description must be 200 characters or fewer', status: 400 };
      sets.push('description = ?'); values.push(d);
    }
  }
  if (body.retired !== undefined) { sets.push('retired = ?'); values.push(body.retired ? 1 : 0); }
  if (!sets.length) return { error: 'No valid fields to update', status: 400 };
  values.push(id);
  await env.DB.prepare(`UPDATE maktab_groups SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return { data: { saved: true } };
}
