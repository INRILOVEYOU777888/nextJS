import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession, verifySession } from '@/lib/session';
import { loadCurrentUser } from '@/lib/access';
import { ensureIdentitySchema } from '@/lib/identity-db';

export async function GET(request) {
  const token = request.cookies.get('session')?.value;
  const user = verifySession(token);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  await ensureIdentitySchema();
  const currentUser = await loadCurrentUser(user);
  const response = NextResponse.json({ user: currentUser });
  response.cookies.set(SESSION_COOKIE_NAME, signSession(currentUser), SESSION_COOKIE_OPTIONS);
  return response;
}
