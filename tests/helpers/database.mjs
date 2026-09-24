import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

// Replay the application migrations, including constraints, instead of copying
// partial table definitions which silently drift as handlers evolve.
export function createDatabase() {
  const db = new DatabaseSync(':memory:');
  // Historical table-rebuild migrations require FK checks off during replay.
  db.exec('PRAGMA foreign_keys = OFF');
  const dir = new URL('../../worker/migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  db.exec('DELETE FROM students; PRAGMA foreign_keys = ON');
  return db;
}

export function d1Database(db) {
  const statement = (sql, args = []) => ({
    _sql: sql, _args: args,
    bind(...values) { return statement(sql, values); },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async run() {
      const result = db.prepare(sql).run(...args);
      return { meta: { last_row_id: Number(result.lastInsertRowid), changes: result.changes } };
    },
  });
  return {
    prepare: statement,
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        db.exec('COMMIT');
        return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

export function seedStudent(db, id, fields = {}) {
  const values = { id, name: id, role: 'student', created_date: '2026-01-01', ...fields };
  const keys = Object.keys(values);
  db.prepare(`INSERT INTO students (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values));
}

export function seedLog(db, studentId, date, type = 'sabaq') {
  if (!['sabaq', 'sabaq_dhor', 'dhor'].includes(type)) throw new Error('Invalid fixture log type');
  db.prepare(`INSERT INTO maktab_${type}_log (student_id,date,entered_by,teacher_id,teacher_name,created_at) VALUES (?,?,?,?,?,?)`)
    .run(studentId, date, 'T', 'T', 'Teacher', date + 'T12:00:00Z');
}
