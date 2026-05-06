import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import StudentOrderPanel from '@/components/StudentOrderPanel';
import pool from '@/lib/db';
import { verifySession } from '@/lib/session';
import { ensureStudioSchema, subscriptionStatus } from '@/lib/studio-db';
import { findStudentForUser, isDirector, loadCurrentUser } from '@/lib/access';
import styles from '../studio.module.scss';

function fmtDate(date) {
  return date ? new Date(date).toLocaleDateString('ru-RU') : '-';
}

function fmtDateTime(date) {
  return date
    ? new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
}

export default async function StudentCabinetPage() {
  const cookieStore = await cookies();
  const sessionUser = verifySession(cookieStore.get('session')?.value);

  if (!sessionUser) {
    redirect('/login');
  }

  await ensureStudioSchema();
  const user = await loadCurrentUser(sessionUser);

  if (isDirector(user)) {
    redirect('/dashboard');
  }

  const student = await findStudentForUser(user);

  let subscriptions = [];
  let lessons = [];

  if (student) {
    const [subscriptionsResult, lessonsResult] = await Promise.all([
      pool.query(
        `SELECT id, lessons_total, lessons_used, lessons_total - lessons_used AS lessons_left,
                purchased_at, expires_at, status
         FROM subscriptions
         WHERE student_id = $1
         ORDER BY created_at DESC`,
        [student.id]
      ),
      pool.query(
        `SELECT id, teacher, room, starts_at, ends_at, status, completed_at
         FROM lessons
         WHERE student_id = $1
         ORDER BY starts_at ASC`,
        [student.id]
      ),
    ]);

    subscriptions = subscriptionsResult.rows.map((row) => ({ ...row, status: subscriptionStatus(row) }));
    lessons = lessonsResult.rows;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Личный кабинет</h1>
            <p>{user.name} • ученик</p>
          </div>
          <nav className={styles.nav}>
            <LogoutButton />
          </nav>
        </div>

        {!student ? (
          <section className={styles.panel}>
            <p className={styles.error}>
              Карточка ученика не найдена. Для личного кабинета имя аккаунта должно совпадать с ФИО в разделе учеников.
            </p>
          </section>
        ) : (
          <>
            <section className={styles.grid}>
              <div className={styles.card}>
                <h2>{student.full_name}</h2>
                <p>{student.direction}</p>
                <p>Преподаватель: {student.teacher}</p>
              </div>
              <div className={styles.card}>
                <h2>{subscriptions.filter((item) => item.status === 'ACTIVE').length}</h2>
                <p>Активных абонементов</p>
              </div>
              <div className={styles.card}>
                <h2>{subscriptions.reduce((sum, item) => sum + Number(item.lessons_left || 0), 0)}</h2>
                <p>Осталось занятий</p>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Абонемент</th>
                      <th>Использовано</th>
                      <th>Остаток</th>
                      <th>Срок действия</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((item) => (
                      <tr key={item.id}>
                        <td>{item.lessons_total} занятий</td>
                        <td>{item.lessons_used}</td>
                        <td>{item.lessons_left}</td>
                        <td>{fmtDate(item.purchased_at)} - {fmtDate(item.expires_at)}</td>
                        <td><span className={styles.status}>{item.status}</span></td>
                      </tr>
                    ))}
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan={5}>Абонементов пока нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <StudentOrderPanel styles={styles} />

            <section className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Дата и время</th>
                      <th>Преподаватель</th>
                      <th>Кабинет</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td>{fmtDateTime(lesson.starts_at)}</td>
                        <td>{lesson.teacher}</td>
                        <td>{lesson.room}</td>
                        <td><span className={styles.status}>{lesson.status}</span></td>
                      </tr>
                    ))}
                    {lessons.length === 0 && (
                      <tr>
                        <td colSpan={4}>Занятий пока нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
