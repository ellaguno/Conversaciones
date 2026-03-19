import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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

const DATA_DIR = join(process.cwd(), '..', 'data');

/** Get last usage time for a user by checking their metrics.json mtime */
function getLastUsage(userId: string): string | null {
  try {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const metricsFile = join(DATA_DIR, safeId, 'metrics.json');
    if (existsSync(metricsFile)) {
      const stat = statSync(metricsFile);
      return stat.mtime.toISOString();
    }
  } catch {}
  return null;
}

/** Get metrics summary for a user */
function getMetricsSummary(userId: string): { totalCost: number; conversations: number } | null {
  try {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const metricsFile = join(DATA_DIR, safeId, 'metrics.json');
    if (existsSync(metricsFile)) {
      const data = JSON.parse(readFileSync(metricsFile, 'utf-8'));
      return {
        totalCost: data.total_cost_usd || 0,
        conversations: data.llm_calls || 0,
      };
    }
  } catch {}
  return null;
}

/** List guest user folders from data directory */
function getGuestUsers() {
  try {
    if (!existsSync(DATA_DIR)) return [];
    return readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('guest_'))
      .map((d) => {
        const ip = d.name.replace('guest_', '').replace(/_/g, '.');
        const lastUsage = getLastUsage(d.name);
        const metrics = getMetricsSummary(d.name);
        return {
          id: d.name,
          ip,
          lastUsage,
          totalCost: metrics?.totalCost || 0,
          conversations: metrics?.conversations || 0,
        };
      })
      .filter((g) => g.lastUsage !== null) // Only show guests that actually used the app
      .sort((a, b) => (b.lastUsage || '').localeCompare(a.lastUsage || ''));
  } catch {
    return [];
  }
}

// List all users
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const users = getUsers().map((u) => ({
    ...u,
    lastUsage: getLastUsage(u.id),
  }));
  const guests = getGuestUsers();
  return NextResponse.json({ users, guests });
}

// Create a user
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { username, password, displayName, role, email } = body;

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
      ...(email && { email }),
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
    const { id, displayName, email, password, role } = body;

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
      ...(email !== undefined && { email: email || '' }),
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
