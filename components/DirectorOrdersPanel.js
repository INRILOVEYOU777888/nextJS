'use client';

import { useEffect, useMemo, useState } from 'react';

const statusLabels = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CANCELLED: 'Отменена',
};

function fmtDateTime(date) {
  return date
    ? new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
}

export default function DirectorOrdersPanel({ styles }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const newCount = useMemo(() => orders.filter((order) => order.status === 'NEW').length, [orders]);

  async function loadOrders() {
    const res = await fetch('/api/orders');
    if (!res.ok) {
      setError('Не удалось загрузить заявки');
      return;
    }
    setOrders(await res.json());
    setError('');
  }

  useEffect(() => {
    const firstLoad = setTimeout(() => void loadOrders(), 0);
    const timer = setInterval(() => void loadOrders(), 5000);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(timer);
    };
  }, []);

  async function updateStatus(id, status) {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });

    if (!res.ok) {
      setError('Не удалось обновить заявку');
      return;
    }

    await loadOrders();
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Заявки учеников</h2>
        <span className={styles.status}>{newCount} новых</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Ученик</th>
              <th>Email</th>
              <th>Заказ</th>
              <th>Статус</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{fmtDateTime(order.createdAt)}</td>
                <td>{order.customerName}</td>
                <td>{order.customerEmail || '-'}</td>
                <td>{order.lessonsTotal} занятий</td>
                <td><span className={styles.status}>{statusLabels[order.status] || order.status}</span></td>
                <td>
                  <div className={styles.inlineActions}>
                    <button type='button' onClick={() => updateStatus(order.id, 'IN_PROGRESS')}>
                      В работу
                    </button>
                    <button type='button' onClick={() => updateStatus(order.id, 'DONE')}>
                      Готово
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6}>Заявок пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
