import { NextResponse } from 'next/server';
import { readFileSync, statSync } from 'fs';
// Node 18 needs `File` imported explicitly from `node:buffer` (not yet a global).
import { File } from 'node:buffer';
import { auth } from '@/lib/auth';
import {
  SLIDE_MIME_TYPES,
  type SlideExtension,
  deleteSlideAt,
  findSlidePath,
  readGuion,
  readManifest,
  writeGuion,
  writeManifest,
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
  // ETag basado en mtime del archivo. Cuando re-subes PDF o reemplazas la
  // imagen del slide, mtime cambia → ETag cambia → el navegador re-descarga.
  // Cache-Control: no-cache permite uso de caché PERO obliga a revalidar con
  // el server cada vez (304 si el ETag coincide, costo ≈ un round-trip vacío).
  // Esto resuelve el bug de "vuelven las imágenes viejas al refrescar la página".
  const stat = statSync(found.path);
  const etag = `"${found.ext}-${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  const buf = readFileSync(found.path);
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': SLIDE_MIME_TYPES[found.ext],
      'Cache-Control': 'private, no-cache',
      ETag: etag,
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

// DELETE remueve un slide ENTERO: borra la imagen, baja una posición a todos
// los slides posteriores en disco, descarta el bloque del guion y renumera los
// bloques restantes. Reduce slide_count en 1.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-slide-delete:${ip}`, 30, 60_000)) {
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
  if (manifest.slide_count <= 1) {
    return NextResponse.json(
      {
        error: 'No puedes borrar el último slide. Borra la plática completa si es lo que quieres.',
      },
      { status: 400 }
    );
  }

  const guion = readGuion(id);
  if (!guion) {
    return NextResponse.json({ error: 'guion faltante' }, { status: 500 });
  }

  try {
    deleteSlideAt(id, slideNumber, manifest.slide_count);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'error borrando slide' },
      { status: 500 }
    );
  }

  // Renumera bloques: descarta el del slide borrado, decrementa los posteriores.
  const newBlocks = guion.blocks
    .filter((b) => b.slide !== slideNumber)
    .map((b) => (b.slide > slideNumber ? { ...b, slide: b.slide - 1 } : b))
    .sort((a, b) => a.slide - b.slide);
  let acc = 0;
  for (const b of newBlocks) {
    b.start_sec = acc;
    acc += Math.max(0, Number(b.duration_sec) || 0);
  }
  writeGuion(id, { blocks: newBlocks });
  writeManifest(id, { ...manifest, slide_count: manifest.slide_count - 1 });

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
  // Fall back to filename extension if mime is missing/unreliable.
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp)$/);
  if (!m) return null;
  if (m[1] === 'jpeg') return 'jpg';
  return m[1] as SlideExtension;
}
