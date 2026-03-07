import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SESSIONS_BASE = join(process.cwd(), '..', 'agent', 'sessions');

function isPathSafe(filePath: string): boolean {
  const { resolve } = require('path');
  return resolve(filePath).startsWith(resolve(SESSIONS_BASE));
}

function isValidSessionFilename(filename: string): boolean {
  return /^\d{4}-\d{2}-\d{2}_sesion_\d{3}\.md$/.test(filename);
}

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');

  if (!patientId || !isValidSessionFilename(filename)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Sanitize patientId to prevent path traversal
  const safePatientId = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = join(SESSIONS_BASE, safePatientId, 'sesiones', filename);

  if (!isPathSafe(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ filename, content });
}
