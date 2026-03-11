import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { accountApprovedEmail, accountRejectedEmail } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';
import { getUserById, updateUserStatus } from '@/lib/users';

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

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { userId, action } = body;

    if (!userId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    const user = getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected';
    updateUserStatus(userId, newStatus);

    // Notify user via email
    if (user.email) {
      try {
        const emailHtml =
          action === 'approve'
            ? accountApprovedEmail(user.displayName)
            : accountRejectedEmail(user.displayName);
        await sendEmail(
          user.email,
          action === 'approve'
            ? 'Cuenta aprobada - Conversaciones'
            : 'Solicitud de cuenta - Conversaciones',
          emailHtml
        );
      } catch {
        // Best-effort
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
