import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureStudioSchema } from '@/lib/studio-db';
import { findStudentForUser, isDirector, loadCurrentUser, requireDirector, requireSession } from '@/lib/access';

const ORDER_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']);

function mapOrder(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    lessonsTotal: row.lessons_total,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request) {
  const sessionUser = requireSession(request);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureStudioSchema();
  const user = await loadCurrentUser(sessionUser);
  const student = isDirector(user) ? null : await findStudentForUser(user);
  if (!isDirector(user) && !student) return NextResponse.json([]);

  const { rows } = await pool.query(
    `SELECT id, student_id, customer_name, customer_email, lessons_total, status, created_at, updated_at
     FROM order_requests
     WHERE ($1::INTEGER IS NULL OR student_id = $1)
     ORDER BY created_at DESC`,
    [student?.id || null]
  );

  return NextResponse.json(rows.map(mapOrder));
}

export async function POST(request) {
  const sessionUser = requireSession(request);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const lessonsTotal = Number(body.lessonsTotal);
  if (![4, 8].includes(lessonsTotal)) {
    return NextResponse.json({ error: 'Выберите абонемент на 4 или 8 занятий' }, { status: 400 });
  }

  await ensureStudioSchema();
  const user = await loadCurrentUser(sessionUser);
  if (isDirector(user)) {
    return NextResponse.json({ error: 'Директор не создаёт ученические заявки' }, { status: 403 });
  }

  const student = await findStudentForUser(user);
  if (!student) {
    return NextResponse.json({ error: 'Карточка ученика не найдена' }, { status: 409 });
  }

  const { rows } = await pool.query(
    `INSERT INTO order_requests (user_id, student_id, customer_name, customer_email, lessons_total)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, student_id, customer_name, customer_email, lessons_total, status, created_at, updated_at`,
    [user.id, student.id, student.full_name, user.email || null, lessonsTotal]
  );

  return NextResponse.json(mapOrder(rows[0]), { status: 201 });
}

export async function PATCH(request) {
  const auth = await requireDirector(request);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const id = Number(body.id);
  const status = String(body.status || '').toUpperCase();
  if (!id || !ORDER_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Выберите заявку и корректный статус' }, { status: 400 });
  }

  await ensureStudioSchema();
  const { rows } = await pool.query(
    `UPDATE order_requests
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, student_id, customer_name, customer_email, lessons_total, status, created_at, updated_at`,
    [id, status]
  );

  if (!rows[0]) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  return NextResponse.json(mapOrder(rows[0]));
}
