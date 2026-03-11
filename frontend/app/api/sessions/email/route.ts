import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';
import { sendEmail } from '@/lib/email';
import { homeworkEmail, sessionTranscriptEmail } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';
import { getUserById } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`email-session:${ip}`, 10, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { patientId, sessionFilename, type, recipientEmail } = body;

    if (!patientId || !sessionFilename) {
      return NextResponse.json({ error: 'Parametros requeridos' }, { status: 400 });
    }

    // Read session file
    const safePatientId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = sessionFilename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const sessionsBase = getUserSessionsDir(session.user.id);
    const sessionPath = join(sessionsBase, safePatientId, 'sesiones', safeFilename);

    // Security check
    if (!resolve(sessionPath).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }

    if (!existsSync(sessionPath)) {
      return NextResponse.json({ error: 'Sesion no encontrada' }, { status: 404 });
    }

    const content = readFileSync(sessionPath, 'utf-8');

    // Determine recipient
    let toEmail = recipientEmail;
    if (!toEmail) {
      const user = getUserById(session.user.id);
      toEmail = user?.email;
    }

    if (!toEmail) {
      return NextResponse.json(
        { error: 'No hay correo configurado. Agrega tu email en Configuracion.' },
        { status: 400 }
      );
    }

    // Extract date from filename
    const dateMatch = safeFilename.match(/(\d{4}-\d{2}-\d{2})/);
    const sessionDate = dateMatch ? dateMatch[1] : '';

    if (type === 'homework') {
      // Extract homework section
      const homeworkMatch = content.match(
        /## Tareas para el paciente\n([\s\S]*?)(?=\n## |\n---|\Z)/
      );
      const tasks = homeworkMatch ? homeworkMatch[1].trim() : 'No se encontraron tareas asignadas.';
      const html = homeworkEmail(tasks, safePatientId, sessionDate);
      await sendEmail(toEmail, `Tareas asignadas - ${sessionDate}`, html);
    } else {
      const html = sessionTranscriptEmail(content, safePatientId, sessionDate);
      await sendEmail(toEmail, `Notas de sesion - ${sessionDate}`, html);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar correo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
