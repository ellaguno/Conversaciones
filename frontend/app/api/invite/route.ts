import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { invitationEmail } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`invite:${ip}`, 5, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const body = await req.json();
    const { email, fromName } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Correo invalido' }, { status: 400 });
    }

    const origin =
      req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '') || '';
    const registerUrl = `${origin}/register`;
    const senderName = fromName || 'Alguien';

    const html = invitationEmail(senderName, registerUrl);
    await sendEmail(email, `${senderName} te invita a Conversaciones`, html);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar invitacion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
