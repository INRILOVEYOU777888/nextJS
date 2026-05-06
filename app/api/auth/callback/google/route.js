import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { signSession, SESSION_COOKIE_OPTIONS } from '@/lib/session';
import { ensureIdentitySchema, mapUser } from '@/lib/identity-db';
import { roleForName } from '@/lib/access';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/login?error=google_denied', request.url));
  }

  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[google callback] token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(new URL('/login?error=google_token', request.url));
    }

    tokens = await tokenRes.json();
  } catch (err) {
    console.error('[google callback] token exchange error:', err);
    return NextResponse.redirect(new URL('/login?error=google_token', request.url));
  }

  let googleUser;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      console.error('[google callback] userinfo failed:', await userRes.text());
      return NextResponse.redirect(new URL('/login?error=google_userinfo', request.url));
    }

    googleUser = await userRes.json();
  } catch (err) {
    console.error('[google callback] userinfo error:', err);
    return NextResponse.redirect(new URL('/login?error=google_userinfo', request.url));
  }

  const { sub: googleId, email, name } = googleUser;

  if (!email) {
    return NextResponse.redirect(new URL('/login?error=google_no_email', request.url));
  }

  let user;
  try {
    await ensureIdentitySchema();

    const { rows: existing } = await pool.query(
      `SELECT u.id, u.username AS name, u.email, r.code AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.google_id = $1 OR u.email = $2
       LIMIT 1`,
      [googleId, email.toLowerCase()]
    );

    if (existing.length > 0) {
      user = existing[0];
      await pool.query('UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL', [
        googleId,
        user.id,
      ]);
    } else {
      const username = name?.trim() || email.split('@')[0];
      const role = roleForName(username);
      const { rows: created } = await pool.query(
        `INSERT INTO users (username, email, google_id, role_id)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4))
         RETURNING id, username AS name, email, $4 AS role`,
        [username, email.toLowerCase(), googleId, role]
      );
      user = created[0];
    }
  } catch (err) {
    console.error('[google callback] db error:', err);
    return NextResponse.redirect(new URL('/login?error=db', request.url));
  }

  const userData = mapUser(user);
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('session', signSession(userData), SESSION_COOKIE_OPTIONS);
  return response;
}
