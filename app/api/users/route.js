import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import pool from '@/lib/db';
import { ensureIdentitySchema } from '@/lib/identity-db';

export async function GET(request) {
  const token = request.cookies.get('session')?.value;
  if (!verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureIdentitySchema();
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, COALESCE(r.code, 'ADMIN') AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id`
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
