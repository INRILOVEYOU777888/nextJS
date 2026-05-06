import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const user = verifySession(cookieStore.get('session')?.value);

  if (!user) {
    redirect('/login');
  }

  return children;
}
