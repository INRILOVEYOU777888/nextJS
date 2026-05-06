'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import styles from '../studio.module.scss';

function fmt(date) {
  return date ? new Date(date).toLocaleDateString('ru-RU') : '-';
}

export default function DirectorOverviewPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState([]);
  const [filter, setFilter] = useState('ALL');

  async function load() {
    const res = await fetch('/api/subscriptions');
    if (res.ok) setSubscriptions(await res.json());
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

    void fetch('/api/subscriptions').then(async (res) => {
      if (res.ok) setSubscriptions(await res.json());
    });
  }, [router]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return subscriptions;
    return subscriptions.filter((item) => item.status === filter);
  }, [filter, subscriptions]);

  const stats = useMemo(() => ({
    all: subscriptions.length,
    active: subscriptions.filter((item) => item.status === 'ACTIVE').length,
    expiring: subscriptions.filter((item) => Number(item.lessons_left) <= 2 && item.status === 'ACTIVE').length,
  }), [subscriptions]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Обзор директора</h1>
            <p>Контроль всех абонементов, сроков действия и остатков занятий.</p>
          </div>
          <nav className={styles.nav}>
            <Link href='/dashboard'>Дашборд</Link>
            <Link href='/dashboard/students'>Ученики</Link>
            <Link href='/dashboard/subscriptions'>Абонементы</Link>
            <Link href='/dashboard/schedule'>Расписание</Link>
            <LogoutButton />
          </nav>
        </div>

        <section className={styles.grid}>
          <div className={styles.card}>
            <h2>{stats.all}</h2>
            <p>Всего абонементов</p>
          </div>
          <div className={styles.card}>
            <h2>{stats.active}</h2>
            <p>Активных абонементов</p>
          </div>
          <div className={styles.card}>
            <h2>{stats.expiring}</h2>
            <p>Заканчиваются: остаток 1-2 занятия</p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.nav}>
            <button onClick={() => setFilter('ALL')}>Все</button>
            <button onClick={() => setFilter('ACTIVE')}>Активные</button>
            <button onClick={() => setFilter('FINISHED')}>Завершённые</button>
            <button onClick={() => setFilter('EXPIRED')}>Истёкшие</button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Направление</th>
                  <th>Преподаватель</th>
                  <th>Абонемент</th>
                  <th>Использовано</th>
                  <th>Остаток</th>
                  <th>Срок действия</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.student_name}</td>
                    <td>{item.direction}</td>
                    <td>{item.teacher}</td>
                    <td>{item.lessons_total} занятий</td>
                    <td>{item.lessons_used}</td>
                    <td>{item.lessons_left}</td>
                    <td>{fmt(item.purchased_at)} - {fmt(item.expires_at)}</td>
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
