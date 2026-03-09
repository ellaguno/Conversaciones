import { NextResponse } from 'next/server';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

const FILE_MAP: Record<string, string> = {
  profile: 'perfil.md',
  generalSummary: 'resumen_general.md',
  agenda: 'agenda.md',
  treatmentPlan: 'conclusiones/plan_terapeutico.md',
  recurringThemes: 'conclusiones/temas_recurrentes.md',
  progress: 'conclusiones/progreso.md',
};

const VALID_NOTE_TYPES = new Set([...Object.keys(FILE_MAP), 'session']);

function isValidSessionFilename(filename: string): boolean {
  return /^\d{4}-\d{2}-\d{2}_sesion_\d{3}\.md$/.test(filename);
}

function getPatientDir(sessionsBase: string, patientId: string): string {
  const safeId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  return join(sessionsBase, safeId);
}

function resolveFilePath(patientDir: string, noteType: string, filename?: string): string | null {
  if (!VALID_NOTE_TYPES.has(noteType)) return null;

  if (noteType === 'session' && filename) {
    if (!isValidSessionFilename(filename)) return null;
    return join(patientDir, 'sesiones', filename);
  }
  const relative = FILE_MAP[noteType];
  if (relative) {
    return join(patientDir, relative);
  }
  return null;
}

// Save/update a note
export async function PUT(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`notes-put:${ip}`, 30, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    const sessionsBase = getUserSessionsDir(userId);

    const body = await req.json();
    const { noteType, filename, content, patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 });
    }

    const patientDir = getPatientDir(sessionsBase, patientId);
    const filePath = resolveFilePath(patientDir, noteType, filename);
    if (!filePath || !resolve(filePath).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Tipo de nota invalido' }, { status: 400 });
    }

    // Ensure parent directory exists
    const parentDir = join(filePath, '..');
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving note:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

// Delete a note
export async function DELETE(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`notes-del:${ip}`, 10, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    const sessionsBase = getUserSessionsDir(userId);

    const body = await req.json();
    const { noteType, filename, patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 });
    }

    const patientDir = getPatientDir(sessionsBase, patientId);
    const filePath = resolveFilePath(patientDir, noteType, filename);
    if (!filePath || !resolve(filePath).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Tipo de nota invalido' }, { status: 400 });
    }

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 });
  }
}
