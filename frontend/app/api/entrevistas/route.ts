import { NextResponse } from 'next/server';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

interface InterviewSummary {
  id: string;
  intervieweeName: string;
  mode: 'legado' | 'corporativo' | string;
  frequency: string;
  sessionCount: number;
  hasProfile: boolean;
  hasTree: boolean;
  updatedAt: string | null;
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

function readInterviewConfig(dir: string): {
  mode: string;
  intervieweeName: string;
  frequency: string;
} {
  const cf = join(dir, 'entrevista_config.json');
  if (existsSync(cf)) {
    try {
      const data = JSON.parse(readFileSync(cf, 'utf-8'));
      return {
        mode: data.mode || 'legado',
        intervieweeName: data.intervieweeName || '',
        frequency: data.frequency || '',
      };
    } catch {
      // fall through
    }
  }
  return { mode: 'legado', intervieweeName: '', frequency: '' };
}

function isInterviewDir(dir: string): boolean {
  // Heuristic: presence of entrevista_config.json marks a directory as an
  // interview. Therapy patients use therapy_config.json. Plain conversation
  // dirs have neither.
  return existsSync(join(dir, 'entrevista_config.json'));
}

function readInterviewSummary(dir: string, id: string): InterviewSummary {
  const cfg = readInterviewConfig(dir);
  const sesionesDir = join(dir, 'sesiones');
  let sessionCount = 0;
  if (existsSync(sesionesDir)) {
    try {
      sessionCount = readdirSync(sesionesDir).filter((f) => f.endsWith('.md')).length;
    } catch {
      // ignore
    }
  }
  const treeFile = join(dir, 'arbol_temas.json');
  let updatedAt: string | null = null;
  if (existsSync(treeFile)) {
    try {
      updatedAt = statSync(treeFile).mtime.toISOString();
    } catch {
      // ignore
    }
  }
  return {
    id,
    intervieweeName: cfg.intervieweeName || id,
    mode: cfg.mode,
    frequency: cfg.frequency,
    sessionCount,
    hasProfile: existsSync(join(dir, 'perfil.md')),
    hasTree: existsSync(treeFile),
    updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`entrevistas:${ip}`, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const sessionsBase = getUserSessionsDir(session.user.id);

    if (!existsSync(sessionsBase)) {
      return NextResponse.json({ interviews: [] });
    }

    const dirs = readdirSync(sessionsBase).filter((d) => {
      if (d.includes('_deleted_')) return false;
      const full = join(sessionsBase, d);
      try {
        return statSync(full).isDirectory() && isInterviewDir(full);
      } catch {
        return false;
      }
    });

    const interviews = dirs.map((d) => readInterviewSummary(join(sessionsBase, d), d));
    return NextResponse.json({ interviews });
  } catch (error) {
    console.error('Error listing interviews:', error);
    return NextResponse.json({ interviews: [] });
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`entrevistas-create:${ip}`, 20, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const sessionsBase = getUserSessionsDir(session.user.id);

    const body = await req.json().catch(() => ({}));
    const rawId = typeof body?.id === 'string' ? body.id : '';
    const id = safeId(rawId).slice(0, 60);
    if (!id) {
      return NextResponse.json(
        { error: 'id requerido (solo letras, números, _ y -)' },
        { status: 400 }
      );
    }
    const mode = body?.mode === 'corporativo' ? 'corporativo' : 'legado';
    const intervieweeName =
      typeof body?.intervieweeName === 'string' ? body.intervieweeName.slice(0, 80) : '';
    const frequency = typeof body?.frequency === 'string' ? body.frequency.slice(0, 80) : '';

    const interviewDir = join(sessionsBase, id);
    if (!resolve(interviewDir).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }
    if (existsSync(interviewDir)) {
      return NextResponse.json(
        { error: 'Ya existe una entrevista (o paciente) con ese id' },
        { status: 409 }
      );
    }

    mkdirSync(interviewDir, { recursive: true });
    mkdirSync(join(interviewDir, 'sesiones'), { recursive: true });
    mkdirSync(join(interviewDir, 'conclusiones', 'conocimiento'), { recursive: true });

    const cfg = { mode, intervieweeName, frequency };
    writeFileSync(
      join(interviewDir, 'entrevista_config.json'),
      JSON.stringify(cfg, null, 2),
      'utf-8'
    );

    return NextResponse.json({ ok: true, id, ...cfg });
  } catch (error) {
    console.error('Error creating interview:', error);
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`entrevistas-del:${ip}`, 10, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const sessionsBase = getUserSessionsDir(session.user.id);
    const body = await req.json().catch(() => ({}));
    const rawId = typeof body?.id === 'string' ? body.id : '';
    const id = safeId(rawId);
    if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
    const dir = join(sessionsBase, id);
    if (!resolve(dir).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }
    if (!existsSync(dir)) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }
    renameSync(dir, join(sessionsBase, `${id}_deleted_${Date.now()}`));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting interview:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
