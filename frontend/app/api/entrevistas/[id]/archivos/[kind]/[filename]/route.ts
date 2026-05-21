import { NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserDataDir, getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

// Allowed file "kinds" — maps to a subpath under the interview directory or
// the user's conversation logs. `transcript` lives in conversations/, the rest
// in sessions/<id>/. Anything else is rejected.
const KIND_TO_SUBPATH: Record<string, (id: string) => string[]> = {
  sesion: (id) => ['sessions', id, 'sesiones'],
  conocimiento: (id) => ['sessions', id, 'conclusiones', 'conocimiento'],
  transcript: () => ['conversations', 'entrevistadora'],
};

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.\-]/g, '').slice(0, 200);
}

interface RouteCtx {
  params: Promise<{ id: string; kind: string; filename: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`ent-file:${ip}`, 120, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id: rawId, kind: rawKind, filename: rawFilename } = await ctx.params;
    const id = safeSegment(rawId);
    const kind = safeSegment(rawKind);
    const filename = safeSegment(rawFilename);

    if (!id || !filename || !filename.endsWith('.md')) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    if (!(kind in KIND_TO_SUBPATH)) {
      return NextResponse.json({ error: 'Tipo desconocido' }, { status: 400 });
    }

    const userDataDir = getUserDataDir(userId);
    const subPath = KIND_TO_SUBPATH[kind](id);
    const filePath = join(userDataDir, ...subPath, filename);

    // Path safety — must stay within the user's data directory and (for
    // session/conocimiento) within sessions/<id>/ to enforce per-interview scope.
    const safeRoot =
      kind === 'transcript'
        ? join(userDataDir, 'conversations', 'entrevistadora')
        : join(getUserSessionsDir(userId), id);
    if (!resolve(filePath).startsWith(resolve(safeRoot))) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const content = readFileSync(filePath, 'utf-8');
    const headers = new Headers({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    });

    // ?download=1 returns the same body with Content-Disposition: attachment so
    // browsers save it instead of rendering it.
    const url = new URL(req.url);
    if (url.searchParams.get('download') === '1') {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    }

    return new NextResponse(content, { headers });
  } catch (error) {
    console.error('Error reading interview file:', error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
