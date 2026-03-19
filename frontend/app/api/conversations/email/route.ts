import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserConversationsDir } from '@/lib/data-paths';
import { sendEmail } from '@/lib/email';
import { conversationTranscriptEmail } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';
import { getUserById } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`email-conv:${ip}`, 10, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { personality, personalityName, filename, recipientEmail } = body;

    if (!personality) {
      return NextResponse.json({ error: 'Personalidad requerida' }, { status: 400 });
    }

    const safePersonality = personality.replace(/[^a-zA-Z0-9_-]/g, '');
    const convsBase = getUserConversationsDir(session.user.id);
    const personalityDir = join(convsBase, safePersonality);

    // Security check
    if (!resolve(personalityDir).startsWith(resolve(convsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }

    // If no specific filename, get the most recent transcript
    let targetFile: string;
    if (filename) {
      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
      targetFile = join(personalityDir, safeFilename);
    } else {
      if (!existsSync(personalityDir)) {
        return NextResponse.json({ error: 'No hay conversaciones' }, { status: 404 });
      }
      const files = readdirSync(personalityDir)
        .filter((f: string) => f.endsWith('.md') && f !== 'summary.md')
        .sort()
        .reverse();
      if (files.length === 0) {
        return NextResponse.json({ error: 'No hay conversaciones' }, { status: 404 });
      }
      targetFile = join(personalityDir, files[0]);
    }

    // Security check
    if (!resolve(targetFile).startsWith(resolve(convsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }

    if (!existsSync(targetFile)) {
      return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 });
    }

    const content = readFileSync(targetFile, 'utf-8');

    // Determine recipient
    let toEmail = recipientEmail;
    if (!toEmail) {
      const user = getUserById(session.user.id);
      toEmail = user?.email;
    }

    if (!toEmail) {
      return NextResponse.json(
        { error: 'No hay correo configurado. Agrega tu email en tu perfil.' },
        { status: 400 }
      );
    }

    // Extract date from filename
    const baseName = targetFile.split('/').pop() || '';
    const dateMatch = baseName.match(/(\d{4}-\d{2}-\d{2})/);
    const sessionDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    const displayName = personalityName || safePersonality;
    const html = conversationTranscriptEmail(content, displayName, sessionDate);
    await sendEmail(toEmail, `Conversacion con ${displayName} - ${sessionDate}`, html);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar correo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
