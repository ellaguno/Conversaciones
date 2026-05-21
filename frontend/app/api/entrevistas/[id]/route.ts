import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

function readFileSafe(p: string): string | null {
  try {
    return existsSync(p) ? readFileSync(p, 'utf-8') : null;
  } catch {
    return null;
  }
}

function readJsonSafe(p: string): unknown {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
  } catch {
    return null;
  }
}

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`entrevistas-get:${ip}`, 120, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const sessionsBase = getUserSessionsDir(session.user.id);

    const { id: rawId } = await ctx.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ error: 'id invalido' }, { status: 400 });
    }

    const dir = join(sessionsBase, id);
    if (!resolve(dir).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }
    if (!existsSync(dir)) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }

    const config = readJsonSafe(join(dir, 'entrevista_config.json')) || {
      mode: 'legado',
      intervieweeName: id,
      frequency: '',
    };

    const tree = readJsonSafe(join(dir, 'arbol_temas.json'));
    const profile = readFileSafe(join(dir, 'perfil.md'));
    const generalSummary = readFileSafe(join(dir, 'resumen_general.md'));
    const agenda = readFileSafe(join(dir, 'agenda.md'));
    const pendientes = readFileSafe(join(dir, 'conclusiones', 'pendientes.md'));

    // Sessions list
    const sesionesDir = join(dir, 'sesiones');
    let sessions: { filename: string; date: string; num: number }[] = [];
    if (existsSync(sesionesDir)) {
      sessions = readdirSync(sesionesDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => {
          const m = f.match(/(\d{4}-\d{2}-\d{2})_sesion_(\d+)/);
          return { filename: f, date: m ? m[1] : '', num: m ? parseInt(m[2], 10) : 0 };
        });
    }

    // Knowledge index (list of files only; full content is heavy)
    const conocDir = join(dir, 'conclusiones', 'conocimiento');
    let knowledge: string[] = [];
    if (existsSync(conocDir)) {
      knowledge = readdirSync(conocDir)
        .filter((f) => f.endsWith('.md'))
        .sort();
    }

    return NextResponse.json({
      id,
      config,
      tree,
      profile,
      generalSummary,
      agenda,
      pendientes,
      sessions,
      knowledge,
      generating: existsSync(join(dir, '.generating')),
    });
  } catch (error) {
    console.error('Error reading interview:', error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
