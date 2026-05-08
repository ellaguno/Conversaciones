// Returns the current presentation state written to disk by the agent's
// presentation tools. The /presentar view polls this endpoint when no
// LiveKit data channel is available (or as a fallback).
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
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
  if (manifest.owner_user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const stateFile = join(getPlaticaDir(id), '_state.json');
  if (!existsSync(stateFile)) {
    // No active session — return a default state pointing to slide 1.
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
  try {
    const raw = readFileSync(stateFile, 'utf-8');
    const state = JSON.parse(raw) as PlaticaLiveState;
    return NextResponse.json(
      { state: { ...state, active: true } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Estado corrupto' }, { status: 500 });
  }
}
