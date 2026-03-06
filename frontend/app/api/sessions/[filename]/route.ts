import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SESSIONS_BASE = join(process.cwd(), '..', 'agent', 'sessions');

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');

  if (!patientId || !filename.endsWith('.md')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Sanitize patientId to prevent path traversal
  const safePatientId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = join(SESSIONS_BASE, safePatientId, 'sesiones', filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ filename, content });
}
