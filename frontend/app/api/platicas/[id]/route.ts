import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  type PlaticaManifest,
  validateGuionPayload,
  validateManifestPayload,
} from '@/lib/platica-schema';
import {
  deletePlatica,
  readGuion,
  readManifest,
  writeGuion,
  writeManifest,
} from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-get:${ip}`, 120, 60_000)) {
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
  // Lectura: el owner siempre, o cualquiera si está compartida (shared=true).
  // Las escrituras (PATCH/DELETE más abajo) siguen siendo solo del owner.
  if (manifest.owner_user_id !== session.user.id && !manifest.shared) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const guion = readGuion(id);
  if (!guion) {
    return NextResponse.json({ error: 'Guion faltante' }, { status: 500 });
  }
  return NextResponse.json({ manifest, guion });
}

// PATCH actualiza manifest y/o guion de una plática existente. NO toca el PDF
// ni los slides renderizados — para reemplazar el PDF, hay que crear una
// plática nueva (preserva la integridad slide_count ↔ blocks).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-patch:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { id } = await params;
  const existing = readManifest(id);
  if (!existing) {
    return NextResponse.json({ error: 'Plática no encontrada' }, { status: 404 });
  }
  if (existing.owner_user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Manifest patch: validate fields supplied; merge over existing.
  if (body.manifest !== undefined) {
    // The validator expects all required fields; supply existing values for any
    // the client didn't send so partial updates work.
    const m = body.manifest as Record<string, unknown>;
    const merged = {
      title: m.title ?? existing.title,
      personality_key: m.personality_key ?? existing.personality_key,
      presenter_name: m.presenter_name !== undefined ? m.presenter_name : existing.presenter_name,
      presenter_gender:
        m.presenter_gender !== undefined ? m.presenter_gender : existing.presenter_gender,
      presenter_persona:
        m.presenter_persona !== undefined ? m.presenter_persona : existing.presenter_persona,
      audience_profile: m.audience_profile ?? existing.audience_profile,
      narrative_tone: m.narrative_tone ?? existing.narrative_tone,
      advance_mode: m.advance_mode ?? existing.advance_mode,
      slide_transition:
        m.slide_transition !== undefined ? m.slide_transition : existing.slide_transition,
      presenter_overlay_corner:
        m.presenter_overlay_corner !== undefined
          ? m.presenter_overlay_corner
          : existing.presenter_overlay_corner,
      presenter_visualizer:
        m.presenter_visualizer !== undefined
          ? m.presenter_visualizer
          : existing.presenter_visualizer,
      shared: m.shared !== undefined ? m.shared : existing.shared,
      voice_id: m.voice_id !== undefined ? m.voice_id : existing.voice_id,
      speed: m.speed !== undefined ? m.speed : existing.speed,
      audience_mode: m.audience_mode !== undefined ? m.audience_mode : existing.audience_mode,
      model: m.model !== undefined ? m.model : existing.model,
      glossary: m.glossary !== undefined ? m.glossary : existing.glossary,
      story_arcs: m.story_arcs !== undefined ? m.story_arcs : existing.story_arcs,
      key_moments: m.key_moments !== undefined ? m.key_moments : existing.key_moments,
    };
    const check = validateManifestPayload(merged);
    if (!check.ok) {
      return NextResponse.json({ error: `manifest: ${check.error}` }, { status: 400 });
    }
    const updated: PlaticaManifest = {
      id: existing.id,
      owner_user_id: existing.owner_user_id,
      created_at: existing.created_at,
      slide_count: existing.slide_count,
      ...check.value,
    };
    writeManifest(id, updated);
  }

  if (body.guion !== undefined) {
    const check = validateGuionPayload(body.guion, existing.slide_count);
    if (!check.ok) {
      return NextResponse.json({ error: `guion: ${check.error}` }, { status: 400 });
    }
    writeGuion(id, check.value);
  }

  // Return the up-to-date pair so the client doesn't need a second roundtrip.
  return NextResponse.json({ manifest: readManifest(id), guion: readGuion(id) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-delete:${ip}`, 20, 60_000)) {
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
  deletePlatica(id);
  return NextResponse.json({ ok: true });
}
