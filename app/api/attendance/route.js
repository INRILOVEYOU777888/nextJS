import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureStudioSchema } from '@/lib/studio-db';
import { requireDirector } from '@/lib/access';

export async function POST(request) {
  const auth = await requireDirector(request);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const lessonId = Number(body.lessonId);
  const status = body.status;
  if (!lessonId || !['VISITED', 'MISSED'].includes(status)) {
    return NextResponse.json({ error: 'Выберите занятие и статус посещения' }, { status: 400 });
  }

  await ensureStudioSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lessonResult = await client.query(
      `SELECT id, subscription_id, status
       FROM lessons
       WHERE id = $1
       FOR UPDATE`,
      [lessonId]
    );
    const lesson = lessonResult.rows[0];
    if (!lesson) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Занятие не найдено' }, { status: 404 });
    }
    if (lesson.status !== 'SCHEDULED') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Занятие уже отмечено' }, { status: 409 });
    }

    if (lesson.subscription_id) {
      const subscriptionResult = await client.query(
        `SELECT lessons_total, lessons_used
         FROM subscriptions
         WHERE id = $1
         FOR UPDATE`,
        [lesson.subscription_id]
      );
      const subscription = subscriptionResult.rows[0];
      if (!subscription || Number(subscription.lessons_used) >= Number(subscription.lessons_total)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'В абонементе закончились занятия' }, { status: 409 });
      }

      await client.query(
        `UPDATE subscriptions
         SET lessons_used = lessons_used + 1,
             status = CASE WHEN lessons_used + 1 >= lessons_total THEN 'FINISHED' ELSE status END
         WHERE id = $1`,
        [lesson.subscription_id]
      );
    }

    await client.query(
      `INSERT INTO attendance (lesson_id, subscription_id, student_id, status, passed_at)
       SELECT id, subscription_id, student_id, $2, NOW()
       FROM lessons
       WHERE id = $1`,
      [lessonId, status]
    );

    const { rows } = await client.query(
      `UPDATE lessons
       SET status = $2, completed_at = NOW()
       WHERE id = $1
       RETURNING id, student_id, subscription_id, teacher, room, starts_at, ends_at, status, completed_at`,
      [lessonId, status]
    );

    await client.query('COMMIT');
    return NextResponse.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[/api/attendance]', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  } finally {
    client.release();
  }
}
