export async function verifyCaptchaToken(token) {
  if (!token) return false;

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error('[captcha] RECAPTCHA_SECRET_KEY is not configured');
    return false;
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    return Boolean(data.success);
  } catch (error) {
    console.error('[captcha] verification failed', error);
    return false;
  }
}
