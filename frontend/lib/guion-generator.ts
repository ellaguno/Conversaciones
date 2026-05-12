// Helpers para construir un guion estructurado a partir de:
//   1. Solo el PDF (modo 'auto' — extrae texto de cada slide y arma bloques mínimos).
//   2. PDF + un documento narrativo (.pdf/.txt) — un LLM alinea el guion con cada slide.
//
// Mammoth (.docx) no está instalado; aceptamos solo .pdf y .txt para el guion fuente.
// Si más adelante se quiere soportar .docx, agregar `mammoth` y un branch en `extractDocText`.
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { GuionBlock, PlaticaGuion } from './platica-schema';

const execFileAsync = promisify(execFile);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = 'google/gemini-2.5-flash';

// Extracts text per page using `pdftotext`. Pages are separated by a form-feed
// (\f) in the default output, which we use to split.
export async function extractSlidesText(pdfPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-']);
  // pdftotext appends a form-feed after each page. Trim and split.
  const pages = stdout.split('\f').map((p) => p.trim());
  // Last element is often empty (trailing \f).
  return pages.filter((_, i, arr) => i < arr.length - 1 || arr[i].length > 0);
}

// Extracts plain text from a .pdf or .txt file (Buffer in memory).
// .docx not supported — caller should reject those at the API boundary.
export async function extractDocText(file: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<string> {
  const lower = file.filename.toLowerCase();
  if (lower.endsWith('.txt') || file.mimeType === 'text/plain') {
    return file.buffer.toString('utf-8');
  }
  if (lower.endsWith('.pdf') || file.mimeType === 'application/pdf') {
    // Write to a temp file because pdftotext wants a path.
    const tmpPath = `/tmp/guion-source-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    const { writeFile, unlink } = await import('fs/promises');
    await writeFile(tmpPath, file.buffer);
    try {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', tmpPath, '-']);
      return stdout;
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }
  throw new Error(
    `Tipo de archivo no soportado: ${file.filename}. Solo se aceptan .pdf y .txt para el guion fuente.`
  );
}

// Modo 'auto': cada slide se vuelve un bloque cuyo speaker_notes es el texto
// extraído del slide. Útil para slides con texto. Para slides muy visuales el
// resultado va a ser pobre y conviene editar manualmente después.
export function deriveGuionFromSlides(slidesText: string[]): PlaticaGuion {
  const blocks: GuionBlock[] = slidesText.map((text, i) => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const firstLine = (text.split('\n').find((l) => l.trim()) || '').trim().slice(0, 80);
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    // Estimate at ~150 wpm = 2.5 wps. Min 30s, max 180s.
    const duration = Math.max(30, Math.min(180, Math.round(wordCount / 2.5)));
    return {
      slide: i + 1,
      summary: firstLine || `Slide ${i + 1}`,
      start_sec: 0, // recalculated below
      duration_sec: duration,
      speaker_notes:
        cleaned ||
        `(Este slide no tiene texto extraíble. Describe brevemente lo que se ve y conecta con el siguiente.)`,
      talking_points: [],
      allow_questions: true,
    };
  });
  let acc = 0;
  for (const b of blocks) {
    b.start_sec = acc;
    acc += b.duration_sec;
  }
  return { blocks };
}

// Modo 'doc': llama al LLM (Gemini 2.0 Flash vía OpenRouter) para alinear
// el texto narrativo del usuario con cada slide y generar speaker_notes,
// talking_points y duraciones razonables.
export async function generateGuionWithLLM(
  slidesText: string[],
  scriptText: string,
  context: { title: string; audience_profile: string; narrative_tone: string }
): Promise<PlaticaGuion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada en el frontend');
  }

  const slidesJoined = slidesText
    .map((t, i) => `=== SLIDE ${i + 1} ===\n${t || '(slide sin texto extraíble)'}`)
    .join('\n\n');

  const prompt = `CONTEXTO:
- Título: ${context.title}
- Audiencia: ${context.audience_profile}
- Tono narrativo: ${context.narrative_tone}

ENTRADA 1 — Texto extraído de cada slide del PDF (${slidesText.length} slides):
${slidesJoined}

ENTRADA 2 — Guion narrativo del presentador (texto libre):
${scriptText}

TAREA: Genera un guion estructurado JSON que alinee porciones del guion narrativo con cada slide. DEBES generar exactamente ${slidesText.length} bloques, uno por slide en orden. Si el guion narrativo no cubre algún slide, basa speaker_notes en el texto extraído del slide.

REGLAS:
- speaker_notes en español natural, fiel al tono indicado, en 2-4 oraciones. Parafrasea el guion narrativo, no lo cites textualmente.
- talking_points: 2-4 bullets cortos.
- duration_sec: estima en base a longitud de speaker_notes (~150 palabras/min, mínimo 30s, máximo 180s).
- start_sec: acumulado en orden (slide 1 = 0, slide 2 = duration_sec del 1, etc.).
- summary: muy breve (≤80 chars), sin números de slide ("intro", "qué es la IA", "cierre", etc.).

FORMATO (JSON estricto, sin texto antes o después, sin markdown fences):
{
  "blocks": [
    {
      "slide": 1,
      "summary": "...",
      "start_sec": 0,
      "duration_sec": 60,
      "speaker_notes": "...",
      "talking_points": ["...", "..."]
    }
  ]
}`;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que estructura guiones de presentaciones en JSON. Respondes SOLO con JSON válido, sin texto extra ni markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LLM error ${response.status}: ${errBody.slice(0, 300)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Respuesta del LLM sin contenido');
  }

  // Strip possible markdown fences just in case the model sneaked them in.
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `El LLM devolvió un JSON inválido: ${e instanceof Error ? e.message : 'parse error'}. Primeros 200 chars: ${cleaned.slice(0, 200)}`
    );
  }

  const obj = parsed as { blocks?: unknown };
  if (!Array.isArray(obj.blocks)) {
    throw new Error('Respuesta del LLM no contiene blocks[]');
  }

  // Coerce blocks into our shape and recompute start_sec to be safe.
  const blocks: GuionBlock[] = [];
  for (const [i, raw] of (obj.blocks as unknown[]).entries()) {
    const b = raw as Record<string, unknown>;
    blocks.push({
      slide: Number(b.slide) || i + 1,
      summary: String(b.summary ?? `Slide ${i + 1}`),
      start_sec: 0, // recomputed below
      duration_sec: Math.max(30, Math.min(300, Number(b.duration_sec) || 60)),
      speaker_notes: String(b.speaker_notes ?? ''),
      talking_points: Array.isArray(b.talking_points)
        ? (b.talking_points as unknown[]).map((p) => String(p)).filter((p) => p.length > 0)
        : [],
      allow_questions: true,
    });
  }
  blocks.sort((a, b) => a.slide - b.slide);
  let acc = 0;
  for (const b of blocks) {
    b.start_sec = acc;
    acc += b.duration_sec;
  }
  return { blocks };
}
