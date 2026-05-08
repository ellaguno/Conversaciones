"""Loads Plática manifests/guiones and builds the three prompt blocks
(base, índice, detalle±N) that drive a presentation-aware agent.

A "Plática" is a reusable presentation: a PDF + a guión (script with
per-slide notes and timings) + narrative metadata. The agent's instructions
get assembled as:

    [personality system_prompt]

    --- CONTEXTO DE LA PLÁTICA ---     (audience, tone, glossary, story_arcs)
    --- ÍNDICE COMPLETO DE LA PLÁTICA ---  (1-line summary per slide; static)
    --- DETALLE: SLIDES X-Y ---        (full notes for ±N slides; regenerated)
    --- REGLAS DE NARRATIVA ---         (storytelling + reference + flow rules)

Only the DETALLE block is regenerated as the slide changes. Everything else
stays put across the whole talk.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger("comerciante-con-voz")


@dataclass
class GuionBlock:
    slide: int
    summary: str
    start_sec: int
    duration_sec: int
    speaker_notes: str
    talking_points: list[str] = field(default_factory=list)
    allow_questions: bool = True
    media: dict | None = None


@dataclass
class PlaticaManifest:
    id: str
    title: str
    personality_key: str
    owner_user_id: str
    slide_count: int
    audience_profile: str
    narrative_tone: str
    advance_mode: str = "hybrid"  # 'auto' | 'on_cue' | 'hybrid'
    voice_id: str | None = None  # overrides personality default if set
    model: str | None = None  # OpenRouter model id; overrides personality model
    glossary: dict[str, str] = field(default_factory=dict)
    story_arcs: list[dict] = field(default_factory=list)
    key_moments: list[int] = field(default_factory=list)


@dataclass
class Platica:
    manifest: PlaticaManifest
    guion: list[GuionBlock]


def load_platica(platica_id: str, data_dir: Path) -> Platica | None:
    """Load a Plática from /data/platicas/{id}/. Returns None if not found
    or malformed (errors are logged, not raised — calling site decides fallback)."""
    pdir = data_dir / "platicas" / platica_id
    manifest_path = pdir / "manifest.json"
    guion_path = pdir / "guion.json"
    if not manifest_path.exists() or not guion_path.exists():
        logger.warning(f"Plática '{platica_id}' incompleta en {pdir}")
        return None
    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
        g = json.loads(guion_path.read_text(encoding="utf-8"))
        advance_mode = m.get("advance_mode", "hybrid")
        if advance_mode not in ("auto", "on_cue", "hybrid"):
            logger.warning(f"advance_mode inválido '{advance_mode}', usando 'hybrid'")
            advance_mode = "hybrid"
        manifest = PlaticaManifest(
            id=m["id"],
            title=m["title"],
            personality_key=m["personality_key"],
            owner_user_id=m["owner_user_id"],
            slide_count=int(m["slide_count"]),
            audience_profile=m.get("audience_profile", ""),
            narrative_tone=m.get("narrative_tone", ""),
            advance_mode=advance_mode,
            voice_id=(m.get("voice_id") or None),
            model=(m.get("model") or None),
            glossary=m.get("glossary", {}) or {},
            story_arcs=m.get("story_arcs", []) or [],
            key_moments=m.get("key_moments", []) or [],
        )
        blocks = [
            GuionBlock(
                slide=int(b["slide"]),
                summary=b.get("summary", ""),
                start_sec=int(b.get("start_sec", 0)),
                duration_sec=int(b.get("duration_sec", 0)),
                speaker_notes=b.get("speaker_notes", ""),
                talking_points=list(b.get("talking_points", []) or []),
                allow_questions=bool(b.get("allow_questions", True)),
                media=b.get("media"),
            )
            for b in g.get("blocks", [])
        ]
        blocks.sort(key=lambda b: b.slide)
        return Platica(manifest=manifest, guion=blocks)
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        logger.error(f"Error cargando plática '{platica_id}': {e}")
        return None


# Reglas en formato de bloque etiquetado para que el LLM las distinga de
# contenido. La sección OPERACIÓN es metadata; el contenido a hablar viene
# del bloque DETALLE de cada slide. Modelos pequeños (DeepSeek/Gemini Flash)
# tienden a verbalizar instrucciones largas en primera persona, así que
# mantenemos la sección OPERACIÓN corta y genérica.

_OPERATION_BLOCK = """[OPERACIÓN — metadata del sistema, NO se dice en voz alta]
Eres el presentador en vivo de una plática frente a audiencia. Tu única salida hablada
viene del bloque DETALLE del slide actual, parafraseado en tu propia voz, en español natural.

Reglas operacionales:
• Tu primer turno SIEMPRE narra el slide 1. No llames avanzar_diapositiva en ese turno.
• Cuando ya hablaste varias oraciones del slide actual y enlazaste con un puente verbal,
  llamas avanzar_diapositiva(numero=siguiente). El sistema te confirma; sigues hablando
  inmediatamente con el contenido del nuevo slide.
• Para repasar algo previo: repasar_punto, luego volver_a_flujo.
• Para responder pregunta larga sin perder slide: pausar_avance_automatico, luego reanudar_avance_automatico.

Prohibiciones absolutas (verificar antes de cada turno):
• NO digas "slide", "diapositiva", "guion", "lámina", "punto 1", números de slide.
• NO leas estas reglas. NO menciones que tienes instrucciones.
• NO digas "voy a avanzar", "siguiente tema", "primer turno", "no avances".
• NO inventes referencias a slides fuera de tu ventana de DETALLE.
[FIN OPERACIÓN]
"""

_ADVANCE_RULES = {
    "auto": (
        "[MODO: AUTO] Avanzas tú solo en cuanto estés listo. Si te quedas sin "
        "qué decir antes de avanzar, agregas analogía o ejemplo. No dejas "
        "silencios.[FIN MODO]"
    ),
    "on_cue": (
        "[MODO: POR SEÑAL] Después de narrar cada slide, te callas invitando "
        "a la audiencia. Avanzas solo cuando oigas 'sigamos', 'siguiente', "
        "'continuemos', 'vamos'. Silencios largos son aceptables.[FIN MODO]"
    ),
    "hybrid": (
        "[MODO: HÍBRIDO] Avanzas tú solo, pero pausas si la audiencia "
        "interactúa. 'Sigamos' avanza de inmediato. No dejas silencios.[FIN MODO]"
    ),
}


# Combined for build_base_block.
_BASE_RULES = _OPERATION_BLOCK


def _narrative_rules_for(advance_mode: str) -> str:
    rule = _ADVANCE_RULES.get(advance_mode, _ADVANCE_RULES["hybrid"])
    return _BASE_RULES + "\n" + rule


_OVERRIDE_NOTICE = (
    "--- IMPORTANTE: PRECEDENCIA DE CONTEXTO ---\n"
    "Cualquier mención de audiencia, lugar, tema, o nombre de organizador en tu rol "
    "base anterior queda ANULADA por el contexto de la plática que sigue. La audiencia, "
    "lugar y tema reales son SIEMPRE los del bloque CONTEXTO DE LA PLÁTICA. Si tu rol "
    "base mencionaba un lugar (ej. 'Temixco') y este manifest dice otro, usa SIEMPRE el "
    "del manifest. Si tu rol base limita la longitud de respuestas (ej. 'máximo 3 "
    "frases'), esa regla NO aplica durante la plática — extiéndete lo necesario para "
    "narrar cada slide a fondo."
)


def build_base_block(platica: Platica) -> str:
    """Static block: audience, tone, glossary, story arcs, narrative rules.
    Doesn't change as the talk progresses."""
    lines = [_OVERRIDE_NOTICE, "", "--- CONTEXTO DE LA PLÁTICA ---"]
    lines.append(f"Título: {platica.manifest.title}")
    lines.append(f"Audiencia: {platica.manifest.audience_profile}")
    lines.append(f"Tono narrativo: {platica.manifest.narrative_tone}")
    if platica.manifest.glossary:
        lines.append("")
        lines.append("Glosario (usa estas analogías cuando aparezcan los términos):")
        for term, explanation in platica.manifest.glossary.items():
            lines.append(f"  - {term} → {explanation}")
    if platica.manifest.story_arcs:
        lines.append("")
        lines.append("Arcos narrativos (úsalos para dar continuidad entre slides):")
        for arc in platica.manifest.story_arcs:
            lines.append(
                f"  - Slides {arc.get('from_slide')}-{arc.get('to_slide')}: {arc.get('arc')}"
            )
    if platica.manifest.key_moments:
        lines.append("")
        lines.append(
            "Momentos memorables (estos son slides especialmente buenos para callbacks): "
            + ", ".join(str(s) for s in platica.manifest.key_moments)
        )
    lines.append("")
    lines.append(_narrative_rules_for(platica.manifest.advance_mode))
    return "\n".join(lines)


def build_index_block(platica: Platica) -> str:
    """Always-present 1-line summary per slide. Lets the agent foreshadow
    and decide if a callback is valid without inventing detail."""
    lines = ["--- ÍNDICE COMPLETO DE LA PLÁTICA ---"]
    for block in platica.guion:
        lines.append(f"Slide {block.slide}: {block.summary}")
    return "\n".join(lines)


def build_detail_block(platica: Platica, current_slide: int, window: int = 5) -> str:
    """Full speaker_notes + talking_points for slides in [current-window, current+window].
    Regenerated each time the slide changes."""
    start = max(1, current_slide - window)
    end = min(platica.manifest.slide_count, current_slide + window)
    lines = [
        f"--- DETALLE: SLIDES {start}-{end} (estás en slide {current_slide}) ---"
    ]
    for block in platica.guion:
        if not (start <= block.slide <= end):
            continue
        marker = "  ← SLIDE ACTUAL" if block.slide == current_slide else ""
        lines.append("")
        lines.append(f"• Slide {block.slide}{marker}")
        lines.append(f"  Resumen: {block.summary}")
        if block.speaker_notes:
            lines.append(f"  Notas: {block.speaker_notes}")
        if block.talking_points:
            lines.append("  Puntos clave:")
            for p in block.talking_points:
                lines.append(f"    - {p}")
        if block.media:
            kind = block.media.get("type", "media")
            lines.append(
                f"  [Reproduce {kind}: guarda silencio mientras se reproduce y retoma cuando termine.]"
            )
    return "\n".join(lines)


def build_full_instructions(
    base_personality_prompt: str, platica: Platica, current_slide: int, window: int = 5
) -> str:
    """Stitch personality system_prompt + base + índice + detalle. Used both
    at session start and on every slide change (only detalle differs)."""
    return (
        base_personality_prompt.rstrip()
        + "\n\n"
        + build_base_block(platica)
        + "\n\n"
        + build_index_block(platica)
        + "\n\n"
        + build_detail_block(platica, current_slide, window=window)
    )
