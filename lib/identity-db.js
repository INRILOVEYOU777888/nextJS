import { runMigrations } from '@/lib/migrations';

export async function ensureIdentitySchema() {
  await runMigrations();
}

export function mapUser(row) {
  return {
    id: row.id,
    name: row.name || row.username,
    email: row.email,
    role: row.role || 'ADMIN',
  };
}
