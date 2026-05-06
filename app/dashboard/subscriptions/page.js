'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../studio.module.scss';

function fmt(date) {
  return date ? new Date(date).toLocaleDateString('ru-RU') : '-';
}

export default function SubscriptionsPage() {
  const [students, setStudents] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [lessonsTotal, setLessonsTotal] = useState('4');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [studentsRes, subscriptionsRes] = await Promise.all([fetch('/api/students'), fetch('/api/subscriptions')]);
    if (studentsRes.ok) setStudents(await studentsRes.json());
    if (subscriptionsRes.ok) setSubscriptions(await subscriptionsRes.json());
  }

  useEffect(() => {
    void Promise.all([fetch('/api/students'), fetch('/api/subscriptions')]).then(async ([studentsRes, subscriptionsRes]) => {
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (subscriptionsRes.ok) setSubscriptions(await subscriptionsRes.json());
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, lessonsTotal }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Не удалось создать абонемент');
      return;
    }

    setMessage('Абонемент создан на месяц');
    setStudentId('');
    load();
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Абонементы</h1>
            <p>Создание абонемента на месяц: 4 или 8 занятий.</p>
          </div>
          <nav className={styles.nav}>
            <Link href='/dashboard'>Дашборд</Link>
            <Link href='/dashboard/students'>Ученики</Link>
            <Link href='/dashboard/overview'>Обзор директора</Link>
          </nav>
        </div>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor='student'>Ученик</label>
              <select id='student' value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value=''>Выберите ученика</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor='lessonsTotal'>Количество занятий</label>
              <select id='lessonsTotal' value={lessonsTotal} onChange={(e) => setLessonsTotal(e.target.value)}>
                <option value='4'>4 занятия</option>
                <option value='8'>8 занятий</option>
              </select>
            </div>
            <div className={styles.actions}>
              <button className={styles.button}>Создать абонемент</button>
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
                  <th>Ученик</th>
                  <th>Преподаватель</th>
                  <th>Тип</th>
                  <th>Остаток</th>
                  <th>Покупка</th>
                  <th>Окончание</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.student_name}</td>
                    <td>{item.teacher}</td>
                    <td>{item.lessons_total} занятий</td>
                    <td>{item.lessons_left}</td>
                    <td>{fmt(item.purchased_at)}</td>
                    <td>{fmt(item.expires_at)}</td>
                    <td><span className={styles.status}>{item.status}</span></td>
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
