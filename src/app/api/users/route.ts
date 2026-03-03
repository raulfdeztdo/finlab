import { NextRequest, NextResponse } from 'next/server';
import { getSession, findUserById, getAllUsers, createUser, updateUser, deleteUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Helper to check admin
function getAuthenticatedUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) return null;

  const session = getSession(sessionId);
  if (!session) return null;

  return findUserById(session.user_id) || null;
}

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
  }

  const users = getAllUsers();
  return NextResponse.json({ success: true, data: users });
}

// POST /api/users - Create user (admin only)
export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const { username, password, role, email } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Rol inválido (admin o user)' },
        { status: 400 }
      );
    }

    const newUser = createUser(username, password, role || 'user', email || '');
    return NextResponse.json({
      success: true,
      data: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { success: false, error: 'El nombre de usuario ya existe' },
        { status: 409 }
      );
    }
    console.error('[Users] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update user (admin only)
export async function PUT(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const { id, username, password, role, email } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const success = updateUser(id, { username, password, role, email });
    if (!success) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { success: false, error: 'El nombre de usuario ya existe' },
        { status: 409 }
      );
    }
    console.error('[Users] Update error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/users - Delete user (admin only)
export async function DELETE(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    if (id === user.id) {
      return NextResponse.json({ success: false, error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
    }

    const success = deleteUser(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Users] Delete error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
