import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { getSession, findUserById } from '@/lib/db';

export default async function Home() {
  // Check authentication
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;

  if (!sessionId) {
    redirect('/login');
  }

  const session = getSession(sessionId);
  if (!session) {
    redirect('/login');
  }

  const user = findUserById(session.user_id);
  if (!user) {
    redirect('/login');
  }

  return (
    <Dashboard
      user={{
        id: user.id,
        username: user.username,
        role: user.role,
      }}
    />
  );
}
