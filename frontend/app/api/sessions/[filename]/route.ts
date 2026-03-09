import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';

function isValidSessionFilename(filename: string): boolean {
  return /^\d{4}-\d{2}-\d{2}_sesion_\d{3}\.md$/.test(filename);
}

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const userId = session.user.id;
  const sessionsBase = getUserSessionsDir(userId);

  const { filename } = await params;
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');

  if (!patientId || !isValidSessionFilename(filename)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Sanitize patientId to prevent path traversal
  const safePatientId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = join(sessionsBase, safePatientId, 'sesiones', filename);

  if (!resolve(filePath).startsWith(resolve(sessionsBase))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ filename, content });
}
