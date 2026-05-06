import { runMigrations } from '@/lib/migrations';

export async function ensureStudioSchema() {
  await runMigrations();
}

export function subscriptionStatus(row) {
  if (!row) return 'UNKNOWN';
  const expiresAt = new Date(row.expires_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number(row.lessons_used) >= Number(row.lessons_total)) return 'FINISHED';
  if (expiresAt < today) return 'EXPIRED';
  return row.status || 'ACTIVE';
}
