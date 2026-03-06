import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SESSIONS_DIR = join(process.cwd(), '..', 'agent', 'sessions', 'paciente_eduardo', 'sesiones');

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filePath = join(SESSIONS_DIR, filename);

  if (!existsSync(filePath) || !filename.endsWith('.md')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ filename, content });
}
