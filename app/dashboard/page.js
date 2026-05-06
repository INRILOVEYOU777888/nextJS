import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { isDirector, loadCurrentUser } from '@/lib/access';
import { ensureIdentitySchema } from '@/lib/identity-db';
import DirectorOrdersPanel from '@/components/DirectorOrdersPanel';
import LogoutButton from '@/components/LogoutButton';
import styles from './studio.module.scss';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionUser = verifySession(cookieStore.get('session')?.value);

  if (!sessionUser) {
    redirect('/login');
  }

  await ensureIdentitySchema();
  const user = await loadCurrentUser(sessionUser);

  if (!isDirector(user)) {
    redirect('/dashboard/cabinet');
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.title}>
            <h1>Панель управления студией</h1>
            <p>{user.name} • {user.email}</p>
          </div>
          <nav className={styles.nav}>
            <Link href='/dashboard/students'>Ученики</Link>
            <Link href='/dashboard/subscriptions'>Абонементы</Link>
            <Link href='/dashboard/schedule'>Расписание</Link>
            <Link href='/dashboard/overview'>Обзор директора</Link>
            <LogoutButton />
          </nav>
        </div>

        <div className={styles.grid}>
          <Link className={styles.card} href='/dashboard/students'>
            <h2>Ученики</h2>
            <p>Добавление карточки ученика: ФИО, телефон, направление, преподаватель и комментарий.</p>
          </Link>
          <Link className={styles.card} href='/dashboard/subscriptions'>
            <h2>Абонементы</h2>
            <p>Создание месячного абонемента на 4 или 8 занятий с автоматическим расчётом срока действия.</p>
          </Link>
          <Link className={styles.card} href='/dashboard/schedule'>
            <h2>Календарь</h2>
            <p>Недельная сетка занятий по типу Microsoft Teams с кабинетами, временем и отметкой посещения.</p>
          </Link>
          <Link className={styles.card} href='/dashboard/overview'>
            <h2>Обзор директора</h2>
            <p>Единый список всех абонементов, статусов, сроков действия и остатков занятий.</p>
          </Link>
        </div>

        <DirectorOrdersPanel styles={styles} />
      </div>
    </div>
  );
}
