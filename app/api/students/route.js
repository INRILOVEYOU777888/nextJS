import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/session';
import { ensureStudioSchema } from '@/lib/studio-db';

function requireUser(request) {
  return verifySession(request.cookies.get('session')?.value);
}

export async function GET(request) {
  if (!requireUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureStudioSchema();
  const { rows } = await pool.query(
    `SELECT id, full_name, phone, direction, teacher, comment, created_at
     FROM students
     ORDER BY created_at DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(request) {
  if (!requireUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const { fullName, phone, direction, teacher, comment } = body;
  if (!fullName || !direction || !teacher) {
    return NextResponse.json({ error: 'ФИО, направление и преподаватель обязательны' }, { status: 400 });
  }

  await ensureStudioSchema();
  const { rows } = await pool.query(
    `WITH direction_row AS (
       INSERT INTO directions (name)
       VALUES ($3)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id
     ),
     teacher_row AS (
       INSERT INTO teachers (full_name)
       VALUES ($4)
       ON CONFLICT (full_name) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id
     )
     INSERT INTO students (full_name, phone, direction, direction_id, teacher, teacher_id, comment)
     SELECT $1, $2, $3, direction_row.id, $4, teacher_row.id, $5
     FROM direction_row, teacher_row
     RETURNING id, full_name, phone, direction, teacher, comment, created_at`,
    [fullName.trim(), phone?.trim() || null, direction.trim(), teacher.trim(), comment?.trim() || null]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
