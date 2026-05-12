import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session';
import { ensureIdentitySchema, mapUser } from '@/lib/identity-db';
import { roleForName } from '@/lib/access';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectTo = (path) => new URL(path, request.url).toString();

  if (error || !code) {
    return NextResponse.redirect(redirectTo('/login?error=google_denied'));
  }

  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: requiredEnv('GOOGLE_CLIENT_ID'),
        client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
        redirect_uri: requiredEnv('GOOGLE_REDIRECT_URI'),
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('[google callback] token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(redirectTo('/login?error=google_token'));
    }

    tokens = await tokenRes.json();
  } catch (err) {
    console.error('[google callback] token exchange error:', err);
    return NextResponse.redirect(redirectTo('/login?error=google_token'));
  }

  let googleUser;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      console.error('[google callback] userinfo failed:', await userRes.text());
      return NextResponse.redirect(redirectTo('/login?error=google_userinfo'));
    }

    googleUser = await userRes.json();
  } catch (err) {
    console.error('[google callback] userinfo error:', err);
    return NextResponse.redirect(redirectTo('/login?error=google_userinfo'));
  }

  const { sub: googleId, email, name } = googleUser;

  if (!email) {
    return NextResponse.redirect(redirectTo('/login?error=google_no_email'));
  }

  let user;
  try {
    await ensureIdentitySchema();

    // noinspection SqlResolve
    const { rows: existing } = await pool.query(
      // language=PostgreSQL
      `SELECT u.id, u.username AS name, u.email, r.code AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.google_id = $1 OR u.email = $2
       LIMIT 1`,
      [googleId, email.toLowerCase()]
    );

    if (existing.length > 0) {
      user = existing[0];
      // noinspection SqlResolve
      await pool.query(
        // language=PostgreSQL
        'UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL',
        [
          googleId,
          user.id,
        ]
      );
    } else {
      const username = name?.trim() || email.split('@')[0];
      const role = roleForName(username);
      // noinspection SqlResolve
      const { rows: created } = await pool.query(
        // language=PostgreSQL
        `INSERT INTO users (username, email, google_id, role_id)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4))
         RETURNING id, username AS name, email, $4 AS role`,
        [username, email.toLowerCase(), googleId, role]
      );
      user = created[0];
    }
  } catch (err) {
    console.error('[google callback] db error:', err);
    return NextResponse.redirect(redirectTo('/login?error=db'));
  }

  const userData = mapUser(user);
  const response = NextResponse.redirect(redirectTo('/dashboard'));
  response.cookies.set(SESSION_COOKIE_NAME, signSession(userData), SESSION_COOKIE_OPTIONS);
  return response;
}
