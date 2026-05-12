'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import styles from '../studio.module.scss';

const hours = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];

/**
 * @typedef {{ id: number | string, full_name: string, teacher?: string }} Student
 * @typedef {{ id: number | string, student_id: number | string, status: string, lessons_total: number, lessons_left: number }} Subscription
 * @typedef {{ id: number | string, student_name: string, teacher: string, room: string, starts_at: string, status: string, passed_at?: string }} Lesson
 * @typedef {{ studentId: string, subscriptionId: string, teacher: string, room: string, startsAt: string }} LessonForm
 * @typedef {'VISITED' | 'MISSED'} AttendanceStatus
 */

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localInputDate(date, hour = '10:00') {
  const [h, m] = hour.split(':');
  const d = new Date(date);
  d.setHours(Number(h), Number(m), 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fmtDateTime(date) {
  return date
    ? new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
}

export default function SchedulePage() {
  const router = useRouter();
  const [students, setStudents] = useState(/** @type {Student[]} */ ([]));
  const [subscriptions, setSubscriptions] = useState(/** @type {Subscription[]} */ ([]));
  const [lessons, setLessons] = useState(/** @type {Lesson[]} */ ([]));
  const [form, setForm] = useState(/** @type {LessonForm} */ ({
    studentId: '',
    subscriptionId: '',
    teacher: '',
    room: 'Кабинет 1',
    startsAt: localInputDate(new Date()),
  }));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + 5);
    return date;
  }, [weekStart]);

  async function load() {
    const [studentsRes, subscriptionsRes, lessonsRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/subscriptions'),
      fetch('/api/lessons'),
    ]);
    if (studentsRes.ok) setStudents(await studentsRes.json());
    if (subscriptionsRes.ok) setSubscriptions(await subscriptionsRes.json());
    if (lessonsRes.ok) setLessons(await lessonsRes.json());
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

    void Promise.all([
      fetch('/api/students'),
      fetch('/api/subscriptions'),
      fetch('/api/lessons'),
    ]).then(async ([studentsRes, subscriptionsRes, lessonsRes]) => {
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (subscriptionsRes.ok) setSubscriptions(await subscriptionsRes.json());
      if (lessonsRes.ok) setLessons(await lessonsRes.json());
    });
  }, [router]);

  /**
   * @param {keyof LessonForm} field
   * @param {string} value
   */
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /** @param {string} studentId */
  function chooseStudent(studentId) {
    const student = students.find((item) => String(item.id) === String(studentId));
    const subscription = subscriptions.find((item) => String(item.student_id) === String(studentId) && item.status === 'ACTIVE');
    setForm((current) => ({
      ...current,
      studentId,
      teacher: student?.teacher || current.teacher,
      subscriptionId: subscription ? String(subscription.id) : '',
    }));
  }

  const studentSubscriptions = useMemo(
    () => subscriptions.filter((item) => String(item.student_id) === String(form.studentId) && item.status === 'ACTIVE'),
    [form.studentId, subscriptions]
  );

  async function createLesson(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Не удалось создать занятие');
      return;
    }

    setMessage('Занятие добавлено в календарь');
    load();
  }

  /**
   * @param {number | string} lessonId
   * @param {AttendanceStatus} status
   */
  async function markAttendance(lessonId, status) {
    setError('');
    setMessage('');
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Не удалось отметить посещение');
      return;
    }
    setMessage(status === 'VISITED' ? 'Занятие отмечено как посещённое' : 'Занятие отмечено как пропущенное');
    load();
  }

  /**
   * @param {number} dayIndex
   * @param {string} hour
   */
  function lessonFor(dayIndex, hour) {
    return lessons.find((lesson) => {
      const date = new Date(lesson.starts_at);
      if (date < weekStart || date >= weekEnd) return false;
      const day = (date.getDay() || 7) - 1;
      const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return day === dayIndex && time === hour;
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Календарь расписания</h1>
            <p>Недельная сетка занятий по типу Microsoft Teams.</p>
          </div>
          <nav className={styles.nav}>
            <Link href='/dashboard'>Дашборд</Link>
            <Link href='/dashboard/students'>Ученики</Link>
            <Link href='/dashboard/overview'>Обзор директора</Link>
            <LogoutButton />
          </nav>
        </div>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={createLesson}>
            <div className={styles.field}>
              <label htmlFor='student'>Ученик</label>
              <select id='student' value={form.studentId} onChange={(e) => chooseStudent(e.target.value)} required>
                <option value=''>Выберите ученика</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor='teacher'>Преподаватель</label>
              <input id='teacher' value={form.teacher} onChange={(e) => update('teacher', e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor='subscription'>Абонемент</label>
              <select
                id='subscription'
                value={form.subscriptionId}
                onChange={(e) => update('subscriptionId', e.target.value)}
                required
              >
                <option value=''>Выберите активный абонемент</option>
                {studentSubscriptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.lessons_total} занятий, остаток {item.lessons_left}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor='room'>Кабинет</label>
              <select id='room' value={form.room} onChange={(e) => update('room', e.target.value)}>
                <option>Кабинет 1</option>
                <option>Кабинет 2</option>
                <option>Кабинет 3</option>
                <option>Кабинет 4</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor='startsAt'>Дата и время</label>
              <input id='startsAt' type='datetime-local' value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)} required />
            </div>
            <div className={styles.actions}>
              <button className={styles.button}>Добавить занятие</button>
            </div>
          </form>
          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </section>

        <section className={styles.calendar}>
          <div className={styles.calendarHeader}>Время</div>
          {days.map((day, index) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + index);
            return <div key={day} className={styles.calendarHeader}>{day}<br />{date.toLocaleDateString('ru-RU')}</div>;
          })}
          {hours.flatMap((hour) => [
            <div key={`${hour}-time`} className={styles.timeCell}>{hour}</div>,
            ...days.map((day, dayIndex) => {
              const lesson = lessonFor(dayIndex, hour);
              return (
                <div key={`${day}-${hour}`} className={styles.calendarCell}>
                  {lesson && (
                    <div className={styles.lesson}>
                      <strong>{lesson.student_name}</strong>
                      <span>{lesson.teacher}</span>
                      <span>{lesson.room}</span>
                      <span>{lesson.status}</span>
                      {lesson.passed_at && <span>{fmtDateTime(lesson.passed_at)}</span>}
                      {lesson.status === 'SCHEDULED' && (
                        <span>
                          <button onClick={() => markAttendance(lesson.id, 'VISITED')}>Посещено</button>{' '}
                          <button onClick={() => markAttendance(lesson.id, 'MISSED')}>Пропущено</button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            }),
          ])}
        </section>
      </div>
    </main>
  );
}
