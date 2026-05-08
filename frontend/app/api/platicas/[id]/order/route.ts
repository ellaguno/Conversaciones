import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readGuion, readManifest, reorderSlideFiles, writeGuion } from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

// PATCH reordena los slides según una permutación. body.order[i] = el número de
// slide ORIGINAL (1..slide_count) que ahora debe estar en la posición (i+1).
// Renombra los archivos en disco y reescribe los slide-numbers de los bloques
// del guion correspondientemente. slide_count no cambia.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-order:${ip}`, 60, 60_000)) {
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: 'order debe ser un arreglo' }, { status: 400 });
  }
  const order = body.order as unknown[];
  if (order.length !== manifest.slide_count) {
    return NextResponse.json(
      { error: `order debe tener ${manifest.slide_count} elementos (recibí ${order.length})` },
      { status: 400 }
    );
  }
  const seen = new Set<number>();
  const orderInts: number[] = [];
  for (const v of order) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > manifest.slide_count) {
      return NextResponse.json(
        { error: `valor inválido en order: ${v} (esperado 1..${manifest.slide_count})` },
        { status: 400 }
      );
    }
    if (seen.has(n)) {
      return NextResponse.json({ error: `slide ${n} duplicado en order` }, { status: 400 });
    }
    seen.add(n);
    orderInts.push(n);
  }

  const guion = readGuion(id);
  if (!guion) {
    return NextResponse.json({ error: 'guion faltante' }, { status: 500 });
  }

  try {
    reorderSlideFiles(id, orderInts);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'error reordenando slides' },
      { status: 500 }
    );
  }

  // Mapeo: slide original → nueva posición. orderInts[i] = original; new = i+1.
  const remap = new Map<number, number>();
  orderInts.forEach((origSlide, i) => remap.set(origSlide, i + 1));
  const newBlocks = guion.blocks
    .map((b) => ({ ...b, slide: remap.get(b.slide) ?? b.slide }))
    .sort((a, b) => a.slide - b.slide);
  let acc = 0;
  for (const b of newBlocks) {
    b.start_sec = acc;
    acc += Math.max(0, Number(b.duration_sec) || 0);
  }
  writeGuion(id, { blocks: newBlocks });

  return NextResponse.json({
    manifest: readManifest(id),
    guion: readGuion(id),
  });
}
