import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureStudioSchema, subscriptionStatus } from '@/lib/studio-db';
import { findStudentForUser, isDirector, loadCurrentUser, requireDirector, requireSession } from '@/lib/access';

export async function GET(request) {
  const sessionUser = requireSession(request);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await loadCurrentUser(sessionUser);

  await ensureStudioSchema();
  const student = isDirector(user) ? null : await findStudentForUser(user);
  if (!isDirector(user) && !student) return NextResponse.json([]);

  const { rows } = await pool.query(
    `SELECT
       s.id,
       s.student_id,
       st.full_name AS student_name,
       st.teacher,
       st.direction,
       s.lessons_total,
       s.lessons_used,
       (s.lessons_total - s.lessons_used) AS lessons_left,
       s.purchased_at,
       s.expires_at,
       s.status
     FROM subscriptions s
     JOIN students st ON st.id = s.student_id
     WHERE ($1::INTEGER IS NULL OR s.student_id = $1)
     ORDER BY s.created_at DESC`,
    [student?.id || null]
  );

  return NextResponse.json(rows.map((row) => ({ ...row, status: subscriptionStatus(row) })));
}

export async function POST(request) {
  const auth = await requireDirector(request);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const studentId = Number(body.studentId);
  const lessonsTotal = Number(body.lessonsTotal);
  if (!studentId || ![4, 8].includes(lessonsTotal)) {
    return NextResponse.json({ error: 'Выберите ученика и тип абонемента на 4 или 8 занятий' }, { status: 400 });
  }

  await ensureStudioSchema();
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (student_id, lessons_total, purchased_at, expires_at)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month')
     RETURNING id, student_id, lessons_total, lessons_used, purchased_at, expires_at, status`,
    [studentId, lessonsTotal]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
