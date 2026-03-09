import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createUser, deleteUser, getUsers, updateUser } from '@/lib/users';

async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`admin:${ip}`, 30, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return null;
}

// List all users
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const users = getUsers();
  return NextResponse.json({ users });
}

// Create a user
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { username, password, displayName, role } = body;

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe tener entre 3 y 30 caracteres' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'El nombre de usuario solo puede contener letras, numeros y guion bajo' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const user = createUser({
      username,
      password,
      displayName,
      role: role === 'admin' ? 'admin' : 'user',
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Update a user
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, displayName, password, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    updateUser(id, {
      ...(displayName !== undefined && { displayName }),
      ...(password && { password }),
      ...(role !== undefined && { role }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar usuario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Delete a user
export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Prevent self-deletion
    const session = await auth();
    if (session?.user?.id === id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
    }

    deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar usuario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
