import { NextResponse } from 'next/server';
// Node 18 needs `File` imported explicitly from `node:buffer` (not yet a global).
import { File } from 'node:buffer';
import { auth } from '@/lib/auth';
import type { GuionBlock } from '@/lib/platica-schema';
import {
  type SlideExtension,
  insertSlideAt,
  readGuion,
  readManifest,
  writeGuion,
  writeManifest,
} from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

const MAX_SLIDE_BYTES = 10 * 1024 * 1024;

// POST inserta un slide nuevo en la posición indicada. Sube todos los slides
// posteriores una posición (en disco y en el guion), agrega un bloque vacío
// para el nuevo slot y aumenta slide_count.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-slide-insert:${ip}`, 30, 60_000)) {
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart inválido' }, { status: 400 });
  }
  const positionRaw = formData.get('position');
  const position = parseInt(typeof positionRaw === 'string' ? positionRaw : '', 10);
  if (!Number.isInteger(position) || position < 1 || position > manifest.slide_count + 1) {
    return NextResponse.json(
      { error: `position fuera de rango (1..${manifest.slide_count + 1})` },
      { status: 400 }
    );
  }
  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image (archivo) requerido' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'archivo vacío' }, { status: 400 });
  }
  if (file.size > MAX_SLIDE_BYTES) {
    return NextResponse.json({ error: 'imagen excede 10MB' }, { status: 400 });
  }
  const ext = detectImageExtension(file.name, file.type);
  if (!ext) {
    return NextResponse.json(
      { error: 'formato no soportado (usa PNG, JPG o WebP)' },
      { status: 400 }
    );
  }

  const guion = readGuion(id);
  if (!guion) {
    return NextResponse.json({ error: 'guion faltante' }, { status: 500 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    insertSlideAt(id, position, buf, ext, manifest.slide_count);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'error insertando slide' },
      { status: 500 }
    );
  }

  // Renumera bloques: incrementa los slides >= position, agrega bloque nuevo
  // en `position` con contenido vacío para que el usuario lo edite.
  const shifted = guion.blocks.map((b) => (b.slide >= position ? { ...b, slide: b.slide + 1 } : b));
  const inserted: GuionBlock = {
    slide: position,
    summary: '',
    start_sec: 0,
    duration_sec: 60,
    speaker_notes: '',
    talking_points: [],
  };
  const newBlocks = [...shifted, inserted].sort((a, b) => a.slide - b.slide);
  let acc = 0;
  for (const b of newBlocks) {
    b.start_sec = acc;
    acc += Math.max(0, Number(b.duration_sec) || 0);
  }
  writeGuion(id, { blocks: newBlocks });
  writeManifest(id, { ...manifest, slide_count: manifest.slide_count + 1 });

  return NextResponse.json({
    manifest: readManifest(id),
    guion: readGuion(id),
  });
}

function detectImageExtension(name: string, mime: string): SlideExtension | null {
  const lowerMime = (mime || '').toLowerCase();
  if (lowerMime === 'image/png') return 'png';
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') return 'jpg';
  if (lowerMime === 'image/webp') return 'webp';
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp)$/);
  if (!m) return null;
  if (m[1] === 'jpeg') return 'jpg';
  return m[1] as SlideExtension;
}
