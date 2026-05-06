'use client';

import { useEffect, useState } from 'react';

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

export default function StudentOrderPanel({ styles }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadOrders() {
    const res = await fetch('/api/orders');
    if (res.ok) setOrders(await res.json());
  }

  useEffect(() => {
    const firstLoad = setTimeout(() => void loadOrders(), 0);
    return () => clearTimeout(firstLoad);
  }, []);

  async function createOrder(lessonsTotal) {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonsTotal }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось отправить заявку');
        return;
      }

      setMessage('Заявка отправлена директору');
      await loadOrders();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Заказать абонемент</h2>
        <div className={styles.inlineActions}>
          <button className={styles.button} type='button' disabled={loading} onClick={() => createOrder(4)}>
            4 занятия
          </button>
          <button className={styles.button} type='button' disabled={loading} onClick={() => createOrder(8)}>
            8 занятий
          </button>
        </div>
      </div>

      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Абонемент</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{fmtDateTime(order.createdAt)}</td>
                <td>{order.lessonsTotal} занятий</td>
                <td><span className={styles.status}>{statusLabels[order.status] || order.status}</span></td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={3}>Заявок пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
