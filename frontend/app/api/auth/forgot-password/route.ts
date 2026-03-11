import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates';
import { createResetToken } from '@/lib/password-resets';
import { rateLimit } from '@/lib/rate-limit';
import { getUserByEmail, getUserByUsername } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`forgot:${ip}`, 5, 300_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const body = await req.json();
    const { identifier } = body;

    if (!identifier) {
      return NextResponse.json({ error: 'Campo requerido' }, { status: 400 });
    }

    // Find user by username or email
    let user = getUserByUsername(identifier);
    if (!user) {
      user = getUserByEmail(identifier) || undefined;
    }

    // Always return 200 to not leak user existence
    if (!user || !user.email) {
      return NextResponse.json({ ok: true });
    }

    const token = createResetToken(user.id);
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

    await sendEmail(
      user.email,
      'Recuperar contraseña - Conversaciones',
      passwordResetEmail(user.displayName, resetUrl)
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Don't reveal errors
    return NextResponse.json({ ok: true });
  }
}
