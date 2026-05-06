import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import pool from './db';

let migrationPromise;

async function readMigrations() {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (file) => {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      return {
        id: file,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
        sql,
      };
    })
  );
}

export async function runMigrations() {
  if (!migrationPromise) {
    migrationPromise = runMigrationsOnce().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  return migrationPromise;
}

async function runMigrationsOnce() {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [2026050401]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrations = await readMigrations();

    for (const migration of migrations) {
      const { rows } = await client.query(
        'SELECT checksum FROM schema_migrations WHERE id = $1',
        [migration.id]
      );
      const applied = rows[0];

      if (applied) {
        if (applied.checksum !== migration.checksum) {
          throw new Error(`Migration ${migration.id} was changed after it had been applied`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
          [migration.id, migration.checksum]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [2026050401]).catch(() => {});
    client.release();
  }
}
