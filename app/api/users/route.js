import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureIdentitySchema } from '@/lib/identity-db';
import { requireDirector } from '@/lib/access';

export async function GET(request) {
  const auth = await requireDirector(request);
  if (auth.response) return auth.response;

  try {
    await ensureIdentitySchema();
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, COALESCE(r.code, 'STUDENT') AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id`
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
