import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signSession, SESSION_COOKIE_OPTIONS } from '@/lib/session';
import { verifyCaptchaToken } from '@/lib/captcha';
import { ensureIdentitySchema, mapUser } from '@/lib/identity-db';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const { email, password, captchaToken } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
  }

  if (!(await verifyCaptchaToken(captchaToken))) {
    return NextResponse.json({ error: 'Подтвердите, что вы не робот' }, { status: 400 });
  }

  try {
    await ensureIdentitySchema();

    const { rows } = await pool.query(
      `SELECT u.id, u.username AS name, u.email, u.password_hash, r.code AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    const userData = mapUser(user);
    const response = NextResponse.json({ user: userData });
    response.cookies.set('session', signSession(userData), SESSION_COOKIE_OPTIONS);
    return response;
  } catch (err) {
    console.error('[/api/auth/login]', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
