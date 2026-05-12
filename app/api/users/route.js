import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureIdentitySchema } from '@/lib/identity-db';
import { requireDirector } from '@/lib/access';

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
}

export async function GET(request) {
  const auth = await requireDirector(request);
  if (auth.response) return auth.response;

  try {
    await ensureIdentitySchema();
    // noinspection SqlResolve
    const { rows } = await pool.query(
      // language=PostgreSQL
      `SELECT u.id, u.username, u.email, COALESCE(r.code, 'STUDENT') AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id`
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
