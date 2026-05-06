import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

async function readMigrations() {
  const migrationsDir = path.join(projectRoot, 'db', 'migrations');
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

async function runMigrations() {
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
        console.log(`Skipped ${migration.id}`);
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
        console.log(`Applied ${migration.id}`);
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

try {
  await runMigrations();
  console.log('Database migrations are up to date.');
} finally {
  await pool.end();
}
