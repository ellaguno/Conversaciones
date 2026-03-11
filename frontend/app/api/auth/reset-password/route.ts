import { NextResponse } from 'next/server';
import { validateAndConsumeToken } from '@/lib/password-resets';
import { rateLimit } from '@/lib/rate-limit';
import { updateUser } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`reset:${ip}`, 5, 300_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const body = await req.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const userId = validateAndConsumeToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: 'Enlace invalido o expirado. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    updateUser(userId, { password: newPassword });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Error al restablecer contraseña' }, { status: 500 });
  }
}
