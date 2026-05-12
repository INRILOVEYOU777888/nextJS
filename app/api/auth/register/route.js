import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { verifyCaptchaToken } from '@/lib/captcha';
import { ensureIdentitySchema, mapUser } from '@/lib/identity-db';
import { roleForName } from '@/lib/access';

function isDatabaseError(error) {
  return error instanceof Error && 'code' in error;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const { name, email, password, captchaToken } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Имя, email и пароль обязательны' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Пароль должен быть не менее 8 символов' }, { status: 400 });
  }

  if (!(await verifyCaptchaToken(captchaToken))) {
    return NextResponse.json({ error: 'Подтвердите, что вы не робот' }, { status: 400 });
  }

  try {
    await ensureIdentitySchema();

    const password_hash = await bcrypt.hash(password, 10);
    const role = roleForName(name);

    // noinspection SqlResolve
    const { rows } = await pool.query(
      // language=PostgreSQL
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4))
       RETURNING id, username AS name, email, $4 AS role`,
      [name.trim(), email.toLowerCase().trim(), password_hash, role]
    );

    return NextResponse.json({ user: mapUser(rows[0]) }, { status: 201 });
  } catch (err) {
    if (isDatabaseError(err) && err.code === '23505') {
      // unique_violation — email уже занят
      return NextResponse.json({ error: 'Этот email уже зарегистрирован' }, { status: 409 });
    }
    console.error('[/api/auth/register]', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
