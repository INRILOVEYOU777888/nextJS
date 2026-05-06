'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RecaptchaField from '@/components/RecaptchaField';
import styles from '../page.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка входа');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Вход в систему</h1>
          <p>Введите свои данные для входа</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor='email'>Email</label>
            <input
              id='email'
              type='email'
              placeholder='you@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete='email'
            />
          </div>

          <div className={styles.field}>
            <label htmlFor='password'>Пароль</label>
            <input
              id='password'
              type='password'
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete='current-password'
            />
          </div>

          <RecaptchaField onVerify={setCaptchaToken} />

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type='submit' disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <p>
          Или <a href='/api/auth/google'>войти через Google</a>
        </p>
        <p className={styles.footer}>
          Нет аккаунта? <a href='/register'>Зарегистрироваться</a>
        </p>
      </div>
    </div>
  );
}
