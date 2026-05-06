'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import RecaptchaField from '@/components/RecaptchaField';
import styles from '../page.module.scss';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, captchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      router.push('/login');
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
          <h1>Регистрация</h1>
          <p>Создайте аккаунт, чтобы продолжить</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor='name'>Имя</label>
            <input
              id='name'
              type='text'
              placeholder='Иван Иванов'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete='name'
            />
          </div>

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
              placeholder='Не менее 8 символов'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete='new-password'
            />
          </div>

          <RecaptchaField onVerify={setCaptchaToken} />

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type='submit' disabled={loading}>
            {loading ? 'Регистрация...' : 'Создать аккаунт'}
          </button>
        </form>

        <p>
          Или <a href='/api/auth/google'>зарегистрироваться через Google</a>
        </p>
        <p className={styles.footer}>
          Уже есть аккаунт? <Link href='/login'>Войти</Link>
        </p>
      </div>
    </div>
  );
}
