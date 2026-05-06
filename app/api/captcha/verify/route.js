import { NextResponse } from 'next/server';
import { verifyCaptchaToken } from '@/lib/captcha';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
  }

  const success = await verifyCaptchaToken(body.captchaToken);
  return NextResponse.json({ success });
}
