import { NextResponse } from 'next/server';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const SESSIONS_BASE = join(process.cwd(), '..', 'agent', 'sessions');

const FILE_MAP: Record<string, string> = {
  profile: 'perfil.md',
  generalSummary: 'resumen_general.md',
  agenda: 'agenda.md',
  treatmentPlan: 'conclusiones/plan_terapeutico.md',
  recurringThemes: 'conclusiones/temas_recurrentes.md',
  progress: 'conclusiones/progreso.md',
};

function getPatientDir(patientId: string): string {
  const safeId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  return join(SESSIONS_BASE, safeId);
}

function resolveFilePath(patientDir: string, noteType: string, filename?: string): string | null {
  if (noteType === 'session' && filename) {
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
    const body = await req.json();
    const { noteType, filename, content, patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 });
    }

    const patientDir = getPatientDir(patientId);
    const filePath = resolveFilePath(patientDir, noteType, filename);
    if (!filePath) {
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
    const body = await req.json();
    const { noteType, filename, patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 });
    }

    const patientDir = getPatientDir(patientId);
    const filePath = resolveFilePath(patientDir, noteType, filename);
    if (!filePath) {
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
