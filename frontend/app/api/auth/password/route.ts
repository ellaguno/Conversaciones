import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { rateLimit } from '@/lib/rate-limit';

const AUTH_CONFIG_FILE = join(process.cwd(), '..', 'auth-config.json');

function getStoredPassword(): string {
  if (existsSync(AUTH_CONFIG_FILE)) {
    try {
      const data = JSON.parse(readFileSync(AUTH_CONFIG_FILE, 'utf-8'));
      if (data.password) return data.password;
    } catch {}
  }
  return process.env.AUTH_ADMIN_PASSWORD || 'admin';
}

export function getAuthPassword(): string {
  return getStoredPassword();
}

export async function PUT(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`password:${ip}`, 5, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 4 caracteres' },
        { status: 400 }
      );
    }

    // Verify current password
    const storedPassword = getStoredPassword();
    if (currentPassword !== storedPassword) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 403 });
    }

    // Save new password
    writeFileSync(AUTH_CONFIG_FILE, JSON.stringify({ password: newPassword }), 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}
