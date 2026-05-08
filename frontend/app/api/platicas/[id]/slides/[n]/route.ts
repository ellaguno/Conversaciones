import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
// Node 18 needs `File` imported explicitly from `node:buffer` (not yet a global).
import { File } from 'node:buffer';
import { auth } from '@/lib/auth';
import {
  SLIDE_MIME_TYPES,
  type SlideExtension,
  findSlidePath,
  readManifest,
  writeSlideImage,
} from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

const MAX_SLIDE_BYTES = 10 * 1024 * 1024; // 10MB per replacement image

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-slide:${ip}`, 600, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { id, n } = await params;
  const manifest = readManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: 'Plática no encontrada' }, { status: 404 });
  }
  if (manifest.owner_user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  // n is "001" (string) or "1"; accept both.
  const slideNumber = parseInt(n, 10);
  if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > manifest.slide_count) {
    return NextResponse.json({ error: 'slide fuera de rango' }, { status: 404 });
  }
  const found = findSlidePath(id, slideNumber);
  if (!found) {
    return NextResponse.json({ error: 'imagen no encontrada' }, { status: 404 });
  }
  const buf = readFileSync(found.path);
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': SLIDE_MIME_TYPES[found.ext],
      // no-store on replaced slides would break perf; the client appends a
      // version query string after a replace to bypass cache.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// PUT replaces the rendered image for a single slide. Accepts PNG/JPG/WebP.
// The PDF and slide_count are untouched — this is purely a visual override
// for that one page.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-slide-put:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { id, n } = await params;
  const manifest = readManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: 'Plática no encontrada' }, { status: 404 });
  }
  if (manifest.owner_user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const slideNumber = parseInt(n, 10);
  if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > manifest.slide_count) {
    return NextResponse.json({ error: 'slide fuera de rango' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart inválido' }, { status: 400 });
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
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    writeSlideImage(id, slideNumber, buf, ext);
  } catch (err) {
    return NextResponse.json(
      { error: `error guardando imagen: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, slide: slideNumber, ext });
}

function detectImageExtension(name: string, mime: string): SlideExtension | null {
  const lowerMime = (mime || '').toLowerCase();
  if (lowerMime === 'image/png') return 'png';
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') return 'jpg';
  if (lowerMime === 'image/webp') return 'webp';
  // Fall back to filename extension if mime is missing/unreliable.
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp)$/);
  if (!m) return null;
  if (m[1] === 'jpeg') return 'jpg';
  return m[1] as SlideExtension;
}
