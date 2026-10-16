// Only reviewed, exact login-ID matches establish ownership. This module
// never fetches Academy during a Hifz request and never changes credentials.
const environments = new Set(['development', 'production', 'test']);
const text = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const active = value => value === 1 || value === true;
const quote = identifier => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error('Unexpected schema identifier');
  return '"' + identifier + '"';
};

export function buildIdentityPlan(hifzProfiles, academyProfiles, environment) {
  if (!environments.has(environment) || !Array.isArray(hifzProfiles) || !Array.isArray(academyProfiles)) throw new Error('Choose valid profile snapshots and environment');
  const academy = new Map();
  const academyIds = new Set();
  for (const row of academyProfiles) {
    if (!text(row.account_id) || !text(row.login_link_id) || academy.has(row.login_link_id) || academyIds.has(row.account_id)) throw new Error('Academy profiles contain missing or duplicate identifiers');
    academy.set(row.login_link_id, row);
    academyIds.add(row.account_id);
  }
  const mappings = [], retainedInactive = [], missing = [];
  const sourceIds = new Set(), loginIds = new Set(), destinationIds = new Set();
  for (const row of hifzProfiles) {
    const loginId = row.login_id ?? row.id;
    if (!text(row.id) || !text(loginId) || sourceIds.has(row.id) || loginIds.has(loginId)) throw new Error('Hifz profiles contain missing or duplicate identifiers');
    sourceIds.add(row.id); loginIds.add(loginId);
    const account = academy.get(loginId);
    if (!account) {
      if (active(row.active)) missing.push(loginId);
      else retainedInactive.push(row.id);
      continue;
    }
    if (active(row.active) && !active(account.active)) throw new Error('An active Hifz profile maps to an inactive Academy account');
    if (destinationIds.has(account.account_id)) throw new Error('Two Hifz profiles map to one Academy user; review their ownership before cutover');
    destinationIds.add(account.account_id);
    mappings.push({ oldStudentId: row.id, loginId, academyUserId: account.account_id, role: row.role, active: Number(active(row.active)) });
  }
  if (missing.length) throw new Error('Active Hifz login IDs missing from Academy: ' + missing.join(', '));
  for (const row of mappings) {
    if (sourceIds.has(row.academyUserId) && row.academyUserId !== row.oldStudentId) throw new Error('An Academy user ID conflicts with an existing Hifz profile');
  }
  return { version: 1, environment, mappings: mappings.sort((a,b) => a.oldStudentId.localeCompare(b.oldStudentId)), retainedInactive: retainedInactive.sort() };
}

export async function applyIdentityPlan(db, plan, environment) {
  if (plan?.version !== 1 || !environments.has(environment) || plan.environment !== environment || !Array.isArray(plan.mappings) || !plan.mappings.length) throw new Error('Identity plan/environment mismatch');
  const source = new Set(), aliases = new Set(), destination = new Set();
  for (const row of plan.mappings) {
    if (![row.oldStudentId,row.loginId,row.academyUserId].every(text) || !['student','teacher','admin'].includes(row.role) || ![0,1].includes(row.active)
      || source.has(row.oldStudentId) || aliases.has(row.loginId) || destination.has(row.academyUserId)) throw new Error('Invalid or duplicate mapping');
    source.add(row.oldStudentId); aliases.add(row.loginId); destination.add(row.academyUserId);
  }
  const mappingJSON = JSON.stringify(plan.mappings);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(environment + '\n' + mappingJSON));
  const migrationId = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  const receipt = await db.prepare('SELECT migration_id FROM academy_identity_migrations WHERE migration_id = ?').bind(migrationId).first();
  if (receipt) return { alreadyApplied: true, migrationId, profiles: plan.mappings.length };

  // Discover every declared owner/actor reference, including comments and
  // feedback. A new journal table is covered without another hardcoded list.
  // D1 owns _cf_* metadata tables and refuses PRAGMA inspection on them.
  const { results: tables } = await db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'").all();
  const references = [];
  for (const table of tables) {
    const { results: keys } = await db.prepare('PRAGMA foreign_key_list(' + quote(table.name) + ')').all();
    for (const key of keys) {
      if (key.table === 'students' && key.to === 'id') references.push({ table: table.name, column: key.from });
    }
  }
  if (!references.some(ref => ref.table === 'sabaq_log' && ref.column === 'student_id')) throw new Error('Expected journal ownership constraint is missing');
  const guard = crypto.randomUUID();
  const statements = [db.prepare('PRAGMA defer_foreign_keys = ON')];
  // Refuse stale plans, new active profiles, or target-key collisions before
  // changing any row. CHECK failure rolls back this entire D1 batch.
  statements.push(db.prepare(`
    INSERT INTO academy_identity_guards(guard_id,accepted)
    SELECT ?, NOT EXISTS (
      SELECT 1 FROM json_each(?) m LEFT JOIN students s
        ON s.id = json_extract(m.value,'$.oldStudentId')
      WHERE s.id IS NULL OR s.login_id <> json_extract(m.value,'$.loginId')
        OR s.role <> json_extract(m.value,'$.role') OR s.active <> json_extract(m.value,'$.active')
    ) AND NOT EXISTS (
      SELECT 1 FROM students s WHERE s.active = 1 AND s.id NOT IN
        (SELECT json_extract(value,'$.oldStudentId') FROM json_each(?))
    ) AND NOT EXISTS (
      SELECT 1 FROM json_each(?) m JOIN students s ON s.id = json_extract(m.value,'$.academyUserId')
      WHERE s.id <> json_extract(m.value,'$.oldStudentId')
    )`).bind(guard,mappingJSON,mappingJSON,mappingJSON));
  statements.push(db.prepare(`
    UPDATE students SET id = (
      SELECT json_extract(value,'$.academyUserId') FROM json_each(?)
      WHERE json_extract(value,'$.oldStudentId') = students.id
    ), academy_managed = 1
    WHERE id IN (SELECT json_extract(value,'$.oldStudentId') FROM json_each(?))`).bind(mappingJSON,mappingJSON));
  const byTable = new Map();
  for (const ref of references) {
    if (!byTable.has(ref.table)) byTable.set(ref.table,new Set());
    byTable.get(ref.table).add(ref.column);
  }
  // Update all owner/actor columns of a table together: fewer scanned rows,
  // fewer writes, and enough headroom for the Free plan's 50-query limit.
  for (const [tableName, fieldSet] of byTable) {
    const table = quote(tableName), columns = [...fieldSet].map(quote);
    const assignments = columns.map(column => `${column} = COALESCE((
      SELECT json_extract(value,'$.academyUserId') FROM json_each(?)
      WHERE json_extract(value,'$.oldStudentId') = ${table}.${column}
    ), ${table}.${column})`);
    const filters = columns.map(column => `${column} IN (SELECT json_extract(value,'$.oldStudentId') FROM json_each(?))`);
    statements.push(db.prepare('UPDATE ' + table + ' SET ' + assignments.join(', ') + ' WHERE ' + filters.join(' OR '))
      .bind(...columns.map(() => mappingJSON),...columns.map(() => mappingJSON)));
  }
  statements.push(db.prepare('INSERT INTO academy_identity_migrations(migration_id,applied_at,environment,mapping_json) VALUES(?,?,?,?)')
    .bind(migrationId,new Date().toISOString(),environment,mappingJSON));
  statements.push(db.prepare('DELETE FROM academy_identity_guards WHERE guard_id = ?').bind(guard));
  const statementCount = 2 + tables.length + statements.length;
  if (statementCount > 50) throw new Error('Migration exceeds the Free-plan query budget; review the schema before cutover');
  // Do not turn FK deferral off early: constraints must be checked by the
  // transaction commit, including any reference missed by schema validation.
  await db.batch(statements);
  return { alreadyApplied: false, migrationId, profiles: plan.mappings.length, referenceColumns: references.length, statementCount };
}
