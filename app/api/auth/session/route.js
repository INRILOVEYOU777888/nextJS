import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export async function GET(request) {
  const token = request.cookies.get('session')?.value;
  const user = verifySession(token);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
