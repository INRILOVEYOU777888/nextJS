'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import styles from '../studio.module.scss';

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ fullName: '', phone: '', direction: '', teacher: '', comment: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadStudents() {
    const res = await fetch('/api/students');
    if (res.ok) setStudents(await res.json());
  }

  useEffect(() => {
    void fetch('/api/auth/session').then(async (res) => {
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const { user } = await res.json();
      if (user?.role !== 'DIRECTOR') router.replace('/dashboard/cabinet');
    });

    void fetch('/api/students').then(async (res) => {
      if (res.ok) setStudents(await res.json());
    });
  }, [router]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Не удалось добавить ученика');
      return;
    }

    setForm({ fullName: '', phone: '', direction: '', teacher: '', comment: '' });
    setMessage('Ученик добавлен');
    loadStudents();
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Ученики</h1>
            <p>Карточки учеников для привязки к абонементам и занятиям.</p>
          </div>
          <nav className={styles.nav}>
            <Link href='/dashboard'>Дашборд</Link>
            <Link href='/dashboard/subscriptions'>Абонементы</Link>
            <Link href='/dashboard/schedule'>Расписание</Link>
            <LogoutButton />
          </nav>
        </div>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor='fullName'>ФИО ученика</label>
              <input id='fullName' value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor='phone'>Телефон</label>
              <input id='phone' value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor='direction'>Направление</label>
              <input id='direction' value={form.direction} onChange={(e) => update('direction', e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor='teacher'>Преподаватель</label>
              <input id='teacher' value={form.teacher} onChange={(e) => update('teacher', e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor='comment'>Комментарий</label>
              <textarea id='comment' value={form.comment} onChange={(e) => update('comment', e.target.value)} />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} disabled={loading}>{loading ? 'Сохранение...' : 'Добавить ученика'}</button>
            </div>
          </form>
          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Телефон</th>
                  <th>Направление</th>
                  <th>Преподаватель</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.full_name}</td>
                    <td>{student.phone || '-'}</td>
                    <td>{student.direction}</td>
                    <td>{student.teacher}</td>
                    <td>{student.comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
