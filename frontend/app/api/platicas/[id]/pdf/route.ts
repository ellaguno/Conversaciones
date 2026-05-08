import { NextResponse } from 'next/server';
// Node 18 needs `File` imported explicitly from `node:buffer` (not yet a global).
import { File } from 'node:buffer';
import { auth } from '@/lib/auth';
import type { GuionBlock } from '@/lib/platica-schema';
import {
  countPdfPages,
  readGuion,
  readManifest,
  renderPdfToPngs,
  writeGuion,
  writeManifest,
  writePdf,
} from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

const MAX_PDF_BYTES = 50 * 1024 * 1024;

// PUT reemplaza el PDF de una plática existente. Re-renderiza los slides y
// ajusta slide_count en el manifest. El guion se preserva: si el nuevo PDF
// tiene más páginas, se rellenan bloques vacíos al final; si tiene menos,
// se truncan los bloques excedentes (el usuario debe revisar antes de guardar
// que el contenido alineado sigue teniendo sentido).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-pdf-put:${ip}`, 10, 60_000)) {
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
  const pdf = formData.get('pdf');
  if (!(pdf instanceof File)) {
    return NextResponse.json({ error: 'pdf (archivo) requerido' }, { status: 400 });
  }
  if (pdf.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'PDF excede 50MB' }, { status: 400 });
  }
  if (pdf.type && pdf.type !== 'application/pdf') {
    return NextResponse.json({ error: `tipo de archivo inválido: ${pdf.type}` }, { status: 400 });
  }

  const buffer = Buffer.from(await pdf.arrayBuffer());
  let pdfPath: string;
  let newSlideCount: number;
  try {
    pdfPath = writePdf(id, buffer);
    newSlideCount = await countPdfPages(pdfPath);
  } catch (err) {
    return NextResponse.json(
      { error: `error procesando PDF: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 400 }
    );
  }

  try {
    const renderedCount = await renderPdfToPngs(id, pdfPath);
    if (renderedCount !== newSlideCount) {
      console.warn(`Plática ${id}: pdftoppm rindió ${renderedCount} de ${newSlideCount} páginas`);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `error renderizando PDF: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 500 }
    );
  }

  const oldSlideCount = manifest.slide_count;
  writeManifest(id, { ...manifest, slide_count: newSlideCount });

  // Reconcilia el guion con el nuevo conteo de páginas.
  const guion = readGuion(id);
  let blockSummary: { kept: number; padded: number; dropped: number } = {
    kept: 0,
    padded: 0,
    dropped: 0,
  };
  if (guion) {
    const kept = guion.blocks.filter((b) => b.slide >= 1 && b.slide <= newSlideCount);
    const dropped = guion.blocks.length - kept.length;
    const existingSlides = new Set(kept.map((b) => b.slide));
    const padded: GuionBlock[] = [];
    for (let s = 1; s <= newSlideCount; s++) {
      if (!existingSlides.has(s)) {
        padded.push({
          slide: s,
          summary: '',
          start_sec: 0,
          duration_sec: 60,
          speaker_notes: '',
          talking_points: [],
        });
      }
    }
    const merged = [...kept, ...padded].sort((a, b) => a.slide - b.slide);
    let acc = 0;
    for (const b of merged) {
      b.start_sec = acc;
      acc += Math.max(0, Number(b.duration_sec) || 0);
    }
    writeGuion(id, { blocks: merged });
    blockSummary = { kept: kept.length, padded: padded.length, dropped };
  }

  return NextResponse.json({
    manifest: readManifest(id),
    guion: readGuion(id),
    change: {
      old_slide_count: oldSlideCount,
      new_slide_count: newSlideCount,
      ...blockSummary,
    },
  });
}
