// Returns the current presentation state written to disk by the agent's
// presentation tools. The /presentar view polls this endpoint when no
// LiveKit data channel is available (or as a fallback).
//
// Multi-session: el agente escribe `_state_<roomName>.json` por sesión. El
// cliente puede pasar `?session=<roomName>` para leer una sesión específica
// (operador en su propia proyección, mode=live). Sin ese parámetro, el
// endpoint elige el `_state_*.json` más reciente — útil para invitados que
// abren una plática compartida sin saber qué sesión está activa.
import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { getPlaticaDir, readManifest } from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

interface PlaticaLiveState {
  platica_id: string;
  current_slide: number;
  timer_running: boolean;
  in_repaso: boolean;
  repaso_origin_slide: number | null;
  updated_at: string;
}

const STALE_AFTER_MS = 60_000;

function findStateFile(dir: string, sessionParam: string): string | null {
  if (!existsSync(dir)) return null;
  if (sessionParam) {
    const candidate = join(dir, `_state_${sessionParam}.json`);
    return existsSync(candidate) ? candidate : null;
  }
  // Sin session param, elegimos el archivo más recientemente modificado.
  // Si todos están stale, igual lo devolvemos — la marca `active:false` la
  // hace el chequeo de updated_at más abajo.
  let bestPath: string | null = null;
  let bestMtime = -Infinity;
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('_state_') || !f.endsWith('.json')) continue;
    const full = join(dir, f);
    try {
      const m = statSync(full).mtimeMs;
      if (m > bestMtime) {
        bestMtime = m;
        bestPath = full;
      }
    } catch {
      // ignore unreadable
    }
  }
  return bestPath;
}

function inactiveResponse(id: string) {
  return NextResponse.json(
    {
      state: {
        platica_id: id,
        current_slide: 1,
        timer_running: false,
        in_repaso: false,
        repaso_origin_slide: null,
        updated_at: null,
        active: false,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  // Polling endpoint — allow generous rate (clients poll ~2x/sec).
  if (!rateLimit(`platicas-state:${ip}`, 600, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { id } = await params;
  const manifest = readManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: 'Plática no encontrada' }, { status: 404 });
  }
  // Lectura permitida al owner o a cualquiera si la plática está compartida.
  if (manifest.owner_user_id !== session.user.id && !manifest.shared) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const sessionParam = (new URL(req.url).searchParams.get('session') ?? '').replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  const stateFile = findStateFile(getPlaticaDir(id), sessionParam);
  if (!stateFile) {
    return inactiveResponse(id);
  }
  try {
    const raw = readFileSync(stateFile, 'utf-8');
    const state = JSON.parse(raw) as PlaticaLiveState;
    // El archivo solo significa "activo" si el heartbeat del agente lo
    // refrescó hace poco. Sin esto, un crash sucio (kill -9, OOM) deja
    // huérfano el state file. Heartbeat es 20s; 60s da 3x de margen.
    const updatedAtMs = state.updated_at ? Date.parse(state.updated_at) : NaN;
    const active = Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < STALE_AFTER_MS;
    return NextResponse.json(
      { state: { ...state, active } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Estado corrupto' }, { status: 500 });
  }
}
