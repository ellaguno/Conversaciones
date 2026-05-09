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

export type PresenterGender = 'hombre' | 'mujer';
export const PRESENTER_GENDERS: PresenterGender[] = ['hombre', 'mujer'];

// Efecto CSS aplicado a TODOS los cambios de slide en la vista de proyección.
// Por ahora es global por plática (PowerPoint permite por slide; lo dejamos
// como TODO para una iteración futura).
export type SlideTransition = 'none' | 'fade' | 'slide_left' | 'slide_right' | 'slide_up' | 'zoom';
export const SLIDE_TRANSITIONS: SlideTransition[] = [
  'none',
  'fade',
  'slide_left',
  'slide_right',
  'slide_up',
  'zoom',
];

// Modo "live" de la vista de proyección: muestra el visualizador del agente
// sobre el slide en una esquina configurable. Solo se aplica cuando se abre
// /presentar/[id]?mode=live (la vista actual `?mode=poll` no usa estos campos).
export type OverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const OVERLAY_CORNERS: OverlayCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

export type PresenterVisualizer = 'aura' | 'wave' | 'bar' | 'grid' | 'radial';
export const PRESENTER_VISUALIZERS: PresenterVisualizer[] = [
  'aura',
  'wave',
  'bar',
  'grid',
  'radial',
];

export interface PlaticaManifest {
  id: string;
  title: string;
  // Legacy: las primeras pláticas se creaban escogiendo una "personality_key"
  // de un dropdown fijo (tato/ia_honesta/etc.). El campo persiste en JSON para
  // que pláticas viejas sigan cargando, pero en pláticas nuevas guardamos
  // 'custom' y el contenido real vive en presenter_* — el agent usa esos.
  personality_key: string;
  presenter_name?: string;
  presenter_gender?: PresenterGender;
  presenter_persona?: string; // system prompt en texto libre; si está, sustituye al personality_key del agent
  owner_user_id: string;
  created_at: string;
  slide_count: number;
  audience_profile: string;
  narrative_tone: string;
  advance_mode?: AdvanceMode; // default 'hybrid'
  slide_transition?: SlideTransition; // default 'fade'
  presenter_overlay_corner?: OverlayCorner; // default 'top-right'
  presenter_visualizer?: PresenterVisualizer; // default 'aura'
  // Si true, la plática aparece en la lista de TODOS los usuarios autenticados
  // y cualquiera puede iniciarla / proyectarla. Solo el owner puede editarla,
  // borrarla o cambiar el flag. Default false (privada).
  shared?: boolean;
  voice_id?: string;
  model?: string; // OpenRouter model ID; overrides personality model if present
  glossary?: Record<string, string>;
  story_arcs?: StoryArc[];
  key_moments?: number[];
}

// Default usado para prealimentar el formulario de creación / edición. Mantén
// sincronizado con la entrada "tato" en agent/personalities.py.
export const DEFAULT_PRESENTER = {
  name: 'Tato',
  gender: 'hombre' as PresenterGender,
  voice_id: '3a35daa1-ba81-451c-9b21-59332e9db2f3', // Alejandro - Mentor Calmado
  persona: [
    'Eres Tato, un presentador cálido que da pláticas de divulgación. ',
    'Tu fuerte es explicar cosas con paciencia y analogías sencillas, sin tecnicismos. ',
    'Cuando uses una palabra técnica, la explicas con palabras del día a día.\n\n',
    'Reglas de comunicación:\n',
    "- Responde siempre en español mexicano, con un trato cálido y respetuoso. Puedes tutear o usar 'usted' según sienta natural con la audiencia.\n",
    '- Usa analogías cotidianas: la cocina, el jardín, la receta de la abuela, el radio, la libreta de apuntes, herramientas comunes.\n',
    "- Nunca digas 'como modelo de lenguaje' ni te describas en términos técnicos. Habla de ti como un ayudante.\n",
    "- Si te preguntan algo que no sabes, dilo con honestidad: 'no lo sé' o 'no estoy seguro'. No inventes.\n",
    '- No des consejos médicos, legales ni financieros específicos. Sugiere consultar a una persona de confianza.\n\n',
    'Tu tono: amigable, paciente, sin prisa. Trata a cada persona como un vecino querido.',
  ].join(''),
} as const;

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
  // Slide oculto: el bloque persiste en disco (PNG y guion) pero se salta en
  // narración del agent y navegación de la vista de proyección. Útil para
  // backups o slides "para si surge" que no quieres desechar.
  hidden?: boolean;
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
  // Para que la UI distinga "es mía" vs "compartida por alguien más" y
  // muestre o esconda los controles de edición.
  owner_user_id: string;
  shared: boolean;
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
  const requiredStrings = ['title', 'audience_profile', 'narrative_tone'] as const;
  for (const k of requiredStrings) {
    if (typeof m[k] !== 'string' || !(m[k] as string).trim()) {
      return { ok: false, error: `campo requerido faltante o vacío: ${k}` };
    }
  }
  // personality_key es opcional — si no llega, defaulteamos a 'custom' (las
  // pláticas nuevas usan presenter_persona; el campo solo persiste para back-compat).
  if (m.personality_key !== undefined && typeof m.personality_key !== 'string') {
    return { ok: false, error: 'personality_key debe ser una cadena' };
  }
  if (m.presenter_name !== undefined && typeof m.presenter_name !== 'string') {
    return { ok: false, error: 'presenter_name debe ser una cadena' };
  }
  if (
    m.presenter_gender !== undefined &&
    !PRESENTER_GENDERS.includes(m.presenter_gender as PresenterGender)
  ) {
    return {
      ok: false,
      error: `presenter_gender debe ser uno de: ${PRESENTER_GENDERS.join(', ')}`,
    };
  }
  if (m.presenter_persona !== undefined && typeof m.presenter_persona !== 'string') {
    return { ok: false, error: 'presenter_persona debe ser una cadena' };
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
  if (
    m.slide_transition !== undefined &&
    !SLIDE_TRANSITIONS.includes(m.slide_transition as SlideTransition)
  ) {
    return {
      ok: false,
      error: `slide_transition debe ser uno de: ${SLIDE_TRANSITIONS.join(', ')}`,
    };
  }
  if (
    m.presenter_overlay_corner !== undefined &&
    !OVERLAY_CORNERS.includes(m.presenter_overlay_corner as OverlayCorner)
  ) {
    return {
      ok: false,
      error: `presenter_overlay_corner debe ser uno de: ${OVERLAY_CORNERS.join(', ')}`,
    };
  }
  if (
    m.presenter_visualizer !== undefined &&
    !PRESENTER_VISUALIZERS.includes(m.presenter_visualizer as PresenterVisualizer)
  ) {
    return {
      ok: false,
      error: `presenter_visualizer debe ser uno de: ${PRESENTER_VISUALIZERS.join(', ')}`,
    };
  }
  if (m.shared !== undefined && typeof m.shared !== 'boolean') {
    return { ok: false, error: 'shared debe ser booleano' };
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
      personality_key: ((m.personality_key as string | undefined) ?? 'custom').trim() || 'custom',
      presenter_name: (m.presenter_name as string | undefined)?.trim() || undefined,
      presenter_gender: (m.presenter_gender as PresenterGender | undefined) ?? undefined,
      presenter_persona: (m.presenter_persona as string | undefined)?.trim() || undefined,
      audience_profile: (m.audience_profile as string).trim(),
      narrative_tone: (m.narrative_tone as string).trim(),
      advance_mode: (m.advance_mode as AdvanceMode | undefined) ?? 'hybrid',
      slide_transition: (m.slide_transition as SlideTransition | undefined) ?? 'fade',
      presenter_overlay_corner:
        (m.presenter_overlay_corner as OverlayCorner | undefined) ?? 'top-right',
      presenter_visualizer: (m.presenter_visualizer as PresenterVisualizer | undefined) ?? 'aura',
      shared: (m.shared as boolean | undefined) ?? false,
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
      hidden: bo.hidden === true ? true : undefined,
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
