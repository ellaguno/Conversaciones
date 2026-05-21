import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

const VALID_STATES = new Set(['pendiente', 'en_progreso', 'cubierto', 'profundizar', 'saltado']);

interface TreeNode {
  id: string;
  titulo: string;
  estado: string;
  estado_manual?: boolean;
  preguntas_clave?: string[];
  resumen?: string;
  razon_profundizar?: string;
  sesiones?: number[];
  hijos?: TreeNode[];
  motivo_alta?: string;
}

interface Tree {
  version?: number;
  modo?: string;
  updated_at?: string | null;
  raiz: TreeNode;
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

function isValidNode(n: unknown): n is TreeNode {
  if (!n || typeof n !== 'object') return false;
  const node = n as Record<string, unknown>;
  if (typeof node.id !== 'string' || !node.id) return false;
  if (typeof node.titulo !== 'string') return false;
  if (typeof node.estado !== 'string' || !VALID_STATES.has(node.estado)) return false;
  if (node.hijos !== undefined) {
    if (!Array.isArray(node.hijos)) return false;
    for (const c of node.hijos) {
      if (!isValidNode(c)) return false;
    }
  }
  return true;
}

function isValidTree(t: unknown): t is Tree {
  if (!t || typeof t !== 'object') return false;
  const tree = t as Record<string, unknown>;
  return isValidNode(tree.raiz);
}

function ensureNodeShape(n: TreeNode): TreeNode {
  return {
    id: n.id,
    titulo: n.titulo || '',
    estado: n.estado || 'pendiente',
    estado_manual: n.estado_manual === true ? true : undefined,
    preguntas_clave: Array.isArray(n.preguntas_clave)
      ? n.preguntas_clave.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [],
    resumen: typeof n.resumen === 'string' ? n.resumen : '',
    razon_profundizar: typeof n.razon_profundizar === 'string' ? n.razon_profundizar : undefined,
    sesiones: Array.isArray(n.sesiones)
      ? n.sesiones.filter((x): x is number => typeof x === 'number')
      : [],
    motivo_alta: typeof n.motivo_alta === 'string' ? n.motivo_alta : undefined,
    hijos: Array.isArray(n.hijos) ? n.hijos.map(ensureNodeShape) : [],
  };
}

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`entrevistas-arbol:${ip}`, 60, 60_000)) {
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
      return NextResponse.json({ error: 'Entrevista no encontrada' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!isValidTree(body)) {
      return NextResponse.json({ error: 'Estructura de árbol invalida' }, { status: 400 });
    }

    // Normalize shape (strip unknown fields, clamp arrays).
    const cleaned: Tree = {
      version: typeof body.version === 'number' ? body.version : 1,
      modo: typeof body.modo === 'string' ? body.modo : undefined,
      updated_at: new Date().toISOString(),
      raiz: ensureNodeShape(body.raiz),
    };

    // Reject if `.generating` exists — analysis is writing the tree right now
    // and the human edit would be clobbered seconds later. The UI should poll
    // and retry once .generating disappears.
    if (existsSync(join(dir, '.generating'))) {
      return NextResponse.json(
        { error: 'El análisis está actualizando el árbol; intenta de nuevo en unos segundos' },
        { status: 409 }
      );
    }

    writeFileSync(join(dir, 'arbol_temas.json'), JSON.stringify(cleaned, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving tree:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const sessionsBase = getUserSessionsDir(session.user.id);
    const { id: rawId } = await ctx.params;
    const id = safeId(rawId);
    const dir = join(sessionsBase, id);
    if (!resolve(dir).startsWith(resolve(sessionsBase))) {
      return NextResponse.json({ error: 'Ruta invalida' }, { status: 400 });
    }
    const treeFile = join(dir, 'arbol_temas.json');
    if (!existsSync(treeFile)) {
      return NextResponse.json({ tree: null });
    }
    try {
      const tree = JSON.parse(readFileSync(treeFile, 'utf-8'));
      return NextResponse.json({ tree });
    } catch {
      return NextResponse.json({ tree: null });
    }
  } catch (error) {
    console.error('Error reading tree:', error);
    return NextResponse.json({ tree: null });
  }
}
