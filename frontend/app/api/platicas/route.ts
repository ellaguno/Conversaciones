import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
// Node 18 needs `File` imported explicitly from `node:buffer` (not yet a global).
import { File } from 'node:buffer';
import { auth } from '@/lib/auth';
import {
  type PlaticaManifest,
  validateGuionPayload,
  validateManifestPayload,
} from '@/lib/platica-schema';
import {
  countPdfPages,
  deletePlatica,
  listPlaticasForUser,
  renderPdfToPngs,
  writeGuion,
  writeManifest,
  writePdf,
} from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-list:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const items = listPlaticasForUser(session.user.id);
  return NextResponse.json({ platicas: items });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-create:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart inválido' }, { status: 400 });
  }

  // Manifest fields can come either as a JSON blob field "manifest" or as
  // individual top-level fields. Accept both for ergonomics.
  let rawManifest: unknown;
  const manifestBlob = formData.get('manifest');
  if (typeof manifestBlob === 'string') {
    try {
      rawManifest = JSON.parse(manifestBlob);
    } catch {
      return NextResponse.json({ error: 'manifest no es JSON válido' }, { status: 400 });
    }
  } else {
    rawManifest = {
      title: formData.get('title'),
      personality_key: formData.get('personality_key'),
      audience_profile: formData.get('audience_profile'),
      narrative_tone: formData.get('narrative_tone'),
      glossary: parseJsonField(formData.get('glossary')),
      story_arcs: parseJsonField(formData.get('story_arcs')),
      key_moments: parseJsonField(formData.get('key_moments')),
    };
  }

  const manifestCheck = validateManifestPayload(rawManifest);
  if (!manifestCheck.ok) {
    return NextResponse.json({ error: `manifest: ${manifestCheck.error}` }, { status: 400 });
  }

  const guionRaw = formData.get('guion');
  if (typeof guionRaw !== 'string') {
    return NextResponse.json({ error: 'guion (json string) requerido' }, { status: 400 });
  }
  let guionParsed: unknown;
  try {
    guionParsed = JSON.parse(guionRaw);
  } catch {
    return NextResponse.json({ error: 'guion no es JSON válido' }, { status: 400 });
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

  // Persist PDF first so we can call pdfinfo/pdftoppm on it.
  const platicaId = nanoid(12);
  const pdfBuffer = Buffer.from(await pdf.arrayBuffer());

  let slideCount: number;
  let pdfPath: string;
  try {
    pdfPath = writePdf(platicaId, pdfBuffer);
    slideCount = await countPdfPages(pdfPath);
  } catch (err) {
    deletePlatica(platicaId);
    return NextResponse.json(
      { error: `error procesando PDF: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 400 }
    );
  }

  const guionCheck = validateGuionPayload(guionParsed, slideCount);
  if (!guionCheck.ok) {
    deletePlatica(platicaId);
    return NextResponse.json({ error: `guion: ${guionCheck.error}` }, { status: 400 });
  }

  const manifest: PlaticaManifest = {
    id: platicaId,
    owner_user_id: session.user.id,
    created_at: new Date().toISOString(),
    slide_count: slideCount,
    ...manifestCheck.value,
  };

  try {
    writeManifest(platicaId, manifest);
    writeGuion(platicaId, guionCheck.value);
    const renderedCount = await renderPdfToPngs(platicaId, pdfPath);
    if (renderedCount !== slideCount) {
      console.warn(
        `Plática ${platicaId}: pdftoppm rindió ${renderedCount} de ${slideCount} páginas`
      );
    }
  } catch (err) {
    deletePlatica(platicaId);
    return NextResponse.json(
      { error: `error renderizando PDF: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ platica: manifest }, { status: 201 });
}

function parseJsonField(v: FormDataEntryValue | null): unknown {
  if (typeof v !== 'string' || !v) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}
