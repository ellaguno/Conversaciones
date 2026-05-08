// Genera un guion en JSON a partir del PDF + un modo:
//   - 'auto'  → solo PDF, deriva speaker_notes del texto extraído de cada slide.
//   - 'doc'   → PDF + documento narrativo (.pdf/.txt), un LLM alinea el guion con cada slide.
//
// No persiste nada — devuelve el JSON al frontend para que el usuario lo
// revise y edite antes de hacer el POST final a /api/platicas.
import { NextResponse } from 'next/server';
import { unlink, writeFile } from 'fs/promises';
// Node 18 doesn't expose `File` as a global — it lives under `node:buffer`.
// Without this import, `instanceof File` checks throw `ReferenceError: File is not defined`.
import { File } from 'node:buffer';
import { join } from 'path';
import { auth } from '@/lib/auth';
import {
  deriveGuionFromSlides,
  extractDocText,
  extractSlidesText,
  generateGuionWithLLM,
} from '@/lib/guion-generator';
import { rateLimit } from '@/lib/rate-limit';

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB — debe ser <= client_max_body_size de nginx
const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25MB — guion fuente puede ser PDF con imágenes

export const runtime = 'nodejs';
export const maxDuration = 60; // LLM calls can take ~10-20s; allow headroom.

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-preview-guion:${ip}`, 10, 60_000)) {
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

  const mode = String(formData.get('mode') ?? '');
  if (mode !== 'auto' && mode !== 'doc') {
    return NextResponse.json({ error: 'mode debe ser "auto" o "doc"' }, { status: 400 });
  }

  const pdf = formData.get('pdf');
  if (!(pdf instanceof File)) {
    return NextResponse.json({ error: 'pdf (archivo) requerido' }, { status: 400 });
  }
  if (pdf.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'PDF excede 50MB' }, { status: 400 });
  }
  if (pdf.type && pdf.type !== 'application/pdf') {
    return NextResponse.json({ error: `tipo de PDF inválido: ${pdf.type}` }, { status: 400 });
  }

  // Save PDF to a tmp path so pdftotext can read it.
  const tmpPdf = join(
    '/tmp',
    `platica-preview-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  );
  await writeFile(tmpPdf, Buffer.from(await pdf.arrayBuffer()));

  try {
    const slidesText = await extractSlidesText(tmpPdf);
    if (slidesText.length === 0) {
      return NextResponse.json({ error: 'El PDF no tiene páginas legibles' }, { status: 400 });
    }

    if (mode === 'auto') {
      const guion = deriveGuionFromSlides(slidesText);
      return NextResponse.json({
        guion,
        meta: {
          mode: 'auto',
          slide_count: slidesText.length,
          warnings: slidesText
            .map((t, i) => (t.trim().length < 10 ? i + 1 : null))
            .filter((n): n is number => n !== null),
        },
      });
    }

    // mode === 'doc'
    const source = formData.get('source');
    if (!(source instanceof File)) {
      return NextResponse.json(
        { error: 'source (archivo) requerido en modo doc' },
        { status: 400 }
      );
    }
    if (source.size > MAX_DOC_BYTES) {
      return NextResponse.json({ error: 'guion fuente excede 5MB' }, { status: 400 });
    }

    const sourceText = await extractDocText({
      buffer: Buffer.from(await source.arrayBuffer()),
      filename: source.name,
      mimeType: source.type,
    });
    if (!sourceText.trim()) {
      return NextResponse.json({ error: 'El documento fuente está vacío' }, { status: 400 });
    }

    const title = String(formData.get('title') ?? 'Plática');
    const audience_profile = String(formData.get('audience_profile') ?? '');
    const narrative_tone = String(formData.get('narrative_tone') ?? '');

    const guion = await generateGuionWithLLM(slidesText, sourceText, {
      title,
      audience_profile,
      narrative_tone,
    });
    return NextResponse.json({
      guion,
      meta: {
        mode: 'doc',
        slide_count: slidesText.length,
        script_chars: sourceText.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando guion' },
      { status: 500 }
    );
  } finally {
    await unlink(tmpPdf).catch(() => {});
  }
}
