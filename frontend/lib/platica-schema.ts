// Shared types for "Plática" — a reusable presentation (PDF + guión + narrative
// metadata) that an agent narrates while controlling slides.

export interface StoryArc {
  from_slide: number;
  to_slide: number;
  arc: string;
}

// How Tato decides to advance from one slide to the next.
//   'auto'    — tras terminar el speaker_notes, llama avanzar_diapositiva sin esperar.
//   'on_cue'  — Tato termina el slide y se queda quieto hasta oír una señal verbal
//               ("sigamos", "siguiente", "continuemos"…) o un override manual.
//   'hybrid'  — Tato avanza por su cuenta pero con sensibilidad: si percibe interés
//               de la audiencia (preguntas, comentarios) se detiene; si no, sigue.
export type AdvanceMode = 'auto' | 'on_cue' | 'hybrid';

export const ADVANCE_MODES: AdvanceMode[] = ['auto', 'on_cue', 'hybrid'];

export interface PlaticaManifest {
  id: string;
  title: string;
  personality_key: string;
  owner_user_id: string;
  created_at: string;
  slide_count: number;
  audience_profile: string;
  narrative_tone: string;
  advance_mode?: AdvanceMode; // default 'hybrid'
  voice_id?: string; // overrides personality default if present
  model?: string; // OpenRouter model ID; overrides personality model if present
  glossary?: Record<string, string>;
  story_arcs?: StoryArc[];
  key_moments?: number[];
}

export interface GuionMedia {
  type: 'youtube' | 'audio';
  video_id?: string;
  url?: string;
  start_sec?: number;
  end_sec?: number;
  autoplay?: boolean;
}

export interface GuionBlock {
  slide: number;
  summary: string;
  start_sec: number;
  duration_sec: number;
  speaker_notes: string;
  talking_points: string[];
  allow_questions?: boolean;
  media?: GuionMedia;
}

export interface PlaticaGuion {
  blocks: GuionBlock[];
}

export interface PlaticaListItem {
  id: string;
  title: string;
  personality_key: string;
  slide_count: number;
  created_at: string;
  advance_mode?: AdvanceMode;
}

// Validation helpers used by API routes when accepting upload payloads.
export function validateManifestPayload(raw: unknown):
  | {
      ok: true;
      value: Omit<PlaticaManifest, 'id' | 'owner_user_id' | 'created_at' | 'slide_count'>;
    }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object')
    return { ok: false, error: 'manifest debe ser un objeto JSON' };
  const m = raw as Record<string, unknown>;
  const requiredStrings = [
    'title',
    'personality_key',
    'audience_profile',
    'narrative_tone',
  ] as const;
  for (const k of requiredStrings) {
    if (typeof m[k] !== 'string' || !(m[k] as string).trim()) {
      return { ok: false, error: `campo requerido faltante o vacío: ${k}` };
    }
  }
  if (m.glossary !== undefined && (typeof m.glossary !== 'object' || Array.isArray(m.glossary))) {
    return { ok: false, error: 'glossary debe ser un objeto { término: explicación }' };
  }
  if (m.story_arcs !== undefined && !Array.isArray(m.story_arcs)) {
    return { ok: false, error: 'story_arcs debe ser un arreglo' };
  }
  if (m.key_moments !== undefined && !Array.isArray(m.key_moments)) {
    return { ok: false, error: 'key_moments debe ser un arreglo de números' };
  }
  if (m.advance_mode !== undefined && !ADVANCE_MODES.includes(m.advance_mode as AdvanceMode)) {
    return {
      ok: false,
      error: `advance_mode debe ser uno de: ${ADVANCE_MODES.join(', ')}`,
    };
  }
  if (m.voice_id !== undefined && typeof m.voice_id !== 'string') {
    return { ok: false, error: 'voice_id debe ser una cadena' };
  }
  if (m.model !== undefined && typeof m.model !== 'string') {
    return { ok: false, error: 'model debe ser una cadena' };
  }
  return {
    ok: true,
    value: {
      title: (m.title as string).trim(),
      personality_key: (m.personality_key as string).trim(),
      audience_profile: (m.audience_profile as string).trim(),
      narrative_tone: (m.narrative_tone as string).trim(),
      advance_mode: (m.advance_mode as AdvanceMode | undefined) ?? 'hybrid',
      voice_id: (m.voice_id as string | undefined)?.trim() || undefined,
      model: (m.model as string | undefined)?.trim() || undefined,
      glossary: (m.glossary as Record<string, string> | undefined) ?? undefined,
      story_arcs: (m.story_arcs as StoryArc[] | undefined) ?? undefined,
      key_moments: (m.key_moments as number[] | undefined) ?? undefined,
    },
  };
}

export function validateGuionPayload(
  raw: unknown,
  expectedSlideCount: number
): { ok: true; value: PlaticaGuion } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'guion debe ser un objeto JSON' };
  const g = raw as Record<string, unknown>;
  if (!Array.isArray(g.blocks)) return { ok: false, error: 'guion.blocks debe ser un arreglo' };
  const blocks: GuionBlock[] = [];
  for (const [i, b] of (g.blocks as unknown[]).entries()) {
    if (!b || typeof b !== 'object') return { ok: false, error: `bloque ${i} no es un objeto` };
    const bo = b as Record<string, unknown>;
    const slide = Number(bo.slide);
    if (!Number.isInteger(slide) || slide < 1 || slide > expectedSlideCount) {
      return {
        ok: false,
        error: `bloque ${i}: slide ${bo.slide} fuera de rango (1-${expectedSlideCount})`,
      };
    }
    if (typeof bo.speaker_notes !== 'string')
      return { ok: false, error: `bloque ${i}: speaker_notes faltante` };
    if (typeof bo.summary !== 'string')
      return { ok: false, error: `bloque ${i}: summary faltante` };
    blocks.push({
      slide,
      summary: bo.summary as string,
      start_sec: Number(bo.start_sec) || 0,
      duration_sec: Number(bo.duration_sec) || 0,
      speaker_notes: bo.speaker_notes as string,
      talking_points: Array.isArray(bo.talking_points) ? (bo.talking_points as string[]) : [],
      allow_questions: bo.allow_questions !== false,
      media: (bo.media as GuionMedia | undefined) ?? undefined,
    });
  }
  blocks.sort((a, b) => a.slide - b.slide);
  // Verify no duplicate slides
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].slide === blocks[i - 1].slide) {
      return { ok: false, error: `slide ${blocks[i].slide} duplicado en el guion` };
    }
  }
  return { ok: true, value: { blocks } };
}
