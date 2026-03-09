import { type NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserDataDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

function isValidFilename(f: string): boolean {
  return /^[\w._-]+\.md$/.test(f) && f.length < 150;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`transcribe-file:${ip}`, 30, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { filename } = await params;

    if (!isValidFilename(filename)) {
      return NextResponse.json({ error: 'Nombre de archivo invalido' }, { status: 400 });
    }

    const transcriptionsDir = join(getUserDataDir(session.user.id), 'transcriptions');
    const filePath = resolve(transcriptionsDir, filename);

    // Path traversal protection
    if (!filePath.startsWith(resolve(transcriptionsDir))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const content = readFileSync(filePath, 'utf-8');

    // Check if download requested
    const download = req.nextUrl.searchParams.get('download') === 'true';
    if (download) {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ filename, content });
  } catch (error) {
    console.error('Error reading transcription:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
