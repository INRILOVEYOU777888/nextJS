import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/session';
import { ensureStudioSchema } from '@/lib/studio-db';

function requireUser(request) {
  return verifySession(request.cookies.get('session')?.value);
}

function isExpiredDate(date) {
  const expiresAt = new Date(date);
  const today = new Date();
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiresAt < today;
}

export async function GET(request) {
  if (!requireUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureStudioSchema();
  const { rows } = await pool.query(
    `SELECT
       l.id,
       l.student_id,
       st.full_name AS student_name,
       l.subscription_id,
       l.teacher,
       l.room,
       l.starts_at,
       l.ends_at,
       l.status,
       l.completed_at,
       a.status AS attendance_status,
       a.passed_at
     FROM lessons l
     JOIN students st ON st.id = l.student_id
     LEFT JOIN attendance a ON a.lesson_id = l.id
     ORDER BY l.starts_at ASC`
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

  const studentId = Number(body.studentId);
  const subscriptionId = Number(body.subscriptionId);
  const { teacher, room, startsAt } = body;
  if (!studentId || !subscriptionId || !teacher || !room || !startsAt) {
    return NextResponse.json({ error: 'Ученик, активный абонемент, преподаватель, кабинет и дата обязательны' }, { status: 400 });
  }

  const starts = new Date(startsAt);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);

  await ensureStudioSchema();
  try {
    const { rows: subscriptions } = await pool.query(
      `SELECT id, lessons_total, lessons_used, expires_at, status
       FROM subscriptions
       WHERE id = $1 AND student_id = $2`,
      [subscriptionId, studentId]
    );
    const subscription = subscriptions[0];
    if (!subscription || Number(subscription.lessons_used) >= Number(subscription.lessons_total)) {
      return NextResponse.json({ error: 'У ученика нет доступных занятий по выбранному абонементу' }, { status: 409 });
    }
    if (subscription.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Выбранный абонемент не активен' }, { status: 409 });
    }
    if (isExpiredDate(subscription.expires_at)) {
      return NextResponse.json({ error: 'Срок действия абонемента истёк' }, { status: 409 });
    }

    const { rows } = await pool.query(
      `WITH teacher_row AS (
         INSERT INTO teachers (full_name)
         VALUES ($3)
         ON CONFLICT (full_name) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id
       ),
       room_row AS (
         INSERT INTO rooms (name)
         VALUES ($4)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id
       )
       INSERT INTO lessons (student_id, subscription_id, teacher, teacher_id, room, room_id, starts_at, ends_at)
       SELECT $1, $2, $3, teacher_row.id, $4, room_row.id, $5, $6
       FROM teacher_row, room_row
       RETURNING id, student_id, subscription_id, teacher, room, starts_at, ends_at, status`,
      [studentId, subscriptionId, teacher.trim(), room.trim(), starts, ends]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Кабинет уже занят в выбранное время' }, { status: 409 });
    }
    throw err;
  }
}
