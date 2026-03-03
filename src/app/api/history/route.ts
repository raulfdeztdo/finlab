import { NextRequest, NextResponse } from 'next/server';
import { getSession, findUserById, getRecentRequests, getRecentActions, getActionStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/history - Get request and action history
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Sesión expirada' }, { status: 401 });
  }

  const user = findUserById(session.user_id);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'actions';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (type === 'requests') {
      const data = getRecentRequests(limit);
      return NextResponse.json({ success: true, data });
    } else if (type === 'stats') {
      const data = getActionStats();
      return NextResponse.json({ success: true, data });
    } else {
      const data = getRecentActions(limit);
      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('[History] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
