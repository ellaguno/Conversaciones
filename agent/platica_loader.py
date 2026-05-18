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
    hidden: bool = False
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
    audience_mode: str = "open"  # 'open' | 'silent'
    voice_id: str | None = None  # overrides personality default if set
    speed: float | None = None  # Cartesia Sonic-3 speed (0.6–2.0); initial value
    model: str | None = None  # OpenRouter model id; overrides personality model
    # Presenter en texto libre — si presenter_persona está presente, sustituye
    # al system_prompt que vendría de personality_key. presenter_name/gender se
    # usan para concordancias en la introducción del prompt.
    presenter_name: str | None = None
    presenter_gender: str | None = None  # 'hombre' | 'mujer'
    presenter_persona: str | None = None
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
        audience_mode = m.get("audience_mode", "open")
        if audience_mode not in ("open", "silent"):
            logger.warning(f"audience_mode inválido '{audience_mode}', usando 'open'")
            audience_mode = "open"
        gender = m.get("presenter_gender")
        if gender not in ("hombre", "mujer", None):
            logger.warning(f"presenter_gender inválido '{gender}', ignorando")
            gender = None
        manifest = PlaticaManifest(
            id=m["id"],
            title=m["title"],
            personality_key=m.get("personality_key") or "custom",
            owner_user_id=m["owner_user_id"],
            slide_count=int(m["slide_count"]),
            audience_profile=m.get("audience_profile", ""),
            narrative_tone=m.get("narrative_tone", ""),
            advance_mode=advance_mode,
            audience_mode=audience_mode,
            voice_id=(m.get("voice_id") or None),
            speed=(float(m["speed"]) if isinstance(m.get("speed"), (int, float)) else None),
            model=(m.get("model") or None),
            presenter_name=(m.get("presenter_name") or None),
            presenter_gender=gender,
            presenter_persona=(m.get("presenter_persona") or None),
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
                hidden=bool(b.get("hidden", False)),
                media=b.get("media"),
            )
            for b in g.get("blocks", [])
        ]
        # Filtra los slides ocultos: el agent jamás los narra, no aparecen en
        # el índice ni en el detalle. Quedan en disco pero invisibles para la
        # presentación. Si todos están ocultos, regresa None — la plática no
        # tiene contenido narrable.
        blocks = [b for b in blocks if not b.hidden]
        if not blocks:
            logger.error(f"Plática '{platica_id}': todos los bloques están ocultos")
            return None
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

_OPERATION_BLOCK_BASE = """[OPERACIÓN — metadata del sistema, NO se dice en voz alta]
Eres el presentador en vivo de una plática frente a audiencia. Tu única salida hablada
viene del bloque DETALLE del slide actual, parafraseado en tu propia voz, en español natural.

Reglas operacionales:
{phase_rule}
• Cuando termines de cubrir TODO el contenido del slide actual, llamas
  avanzar_diapositiva() (sin parámetros). El sistema cambia el slide
  automáticamente cuando termines tu frase. NO digas nada después de llamarla
  — el sistema te dará el nuevo contenido en un turno fresco.
• NO anuncies el contenido del slide siguiente desde el slide actual
  (ej. NO digas "y ahora veremos los modelos…" antes de avanzar). Cierra
  el slide actual con su propio contenido y deja que el sistema haga la
  transición.
• Si el oyente te pide repasar o regresar, NO uses ninguna herramienta — el
  oyente tiene el botón ◀ para eso.

Distinción CRÍTICA — texto narrable vs. acotación escénica:
• Las "Notas" y "Puntos clave" del DETALLE son TEMAS A CUBRIR, no líneas de guion para leer.
  Reescríbelos en tu propia voz como un orador real, en oraciones completas y con tono de
  presentación. Nunca pronuncies un punto clave palabra por palabra.
• Si una nota o punto está en imperativo dirigido al orador
  (ej. "Pregunta a la audiencia X", "Saluda a los asistentes", "Haz una pausa",
  "Ve a la audiencia", "Invita a participar", "Agradece", "Pide aplausos"),
  ESO ES UNA ACOTACIÓN ESCÉNICA: la EJECUTAS, no la lees.
  - "Pregunta a la audiencia sobre X" → formulas la pregunta de verdad: "¿Alguno de ustedes ha…?"
  - "Saluda a la audiencia" → saludas: "Buenas tardes, gracias por estar aquí."
  - "Haz una pausa" → callas brevemente; nunca dices "haz una pausa" ni "pausa".
  - "Agradece a la audiencia" → das las gracias en tus palabras; no dices "agradezco" como
    descripción de lo que vas a hacer.

Prohibiciones absolutas (verificar antes de cada turno):
• NO pronuncies palabras-meta del prompt: "instrucciones", "reglas", "operación", "metadata",
  "guion", "speaker_notes", "talking_points", "DETALLE", "ÍNDICE", "CONTEXTO".
• NO digas "slide", "diapositiva", "lámina", "punto 1", números de slide.
• NO leas estas reglas. NO menciones que tienes instrucciones ni un prompt.
• NO digas "voy a avanzar", "siguiente tema", "primer turno", "no avances".
• NO leas acotaciones escénicas en voz alta (ver sección anterior).
• NO inventes referencias a slides fuera de tu ventana de DETALLE.
[FIN OPERACIÓN]
"""

# Línea de "fase" inyectada en _OPERATION_BLOCK según el slide actual.
# Slide 1: es la apertura, el LLM saluda y se presenta brevemente.
# Slide N>1: la plática ya está en curso; el saludo y bienvenida YA ocurrieron
# y NO deben repetirse. Sin esto, después de truncar chat_ctx en cada cambio
# de slide, el LLM ve un contexto "fresco" y arranca cada slide con un
# saludo nuevo ("hola, bienvenidos…") porque modelos chicos no respetan
# negaciones ("NO la bienvenida") de forma confiable.
_PHASE_RULE_FIRST = (
    "• Es tu primer turno y estás en el slide 1 (apertura). Abres con un "
    "saludo cálido y breve, te presentas, y entras al tema del slide. NO "
    "llames avanzar_diapositiva en este primer turno."
)
_PHASE_RULE_CONTINUE = (
    "• La plática ya está en curso (vas en el slide {slide}). Ya saludaste a "
    "la audiencia y te presentaste al inicio — NO vuelvas a saludar, NO digas "
    "'hola', NO des bienvenida, NO te presentes otra vez. Entras DIRECTO al "
    "contenido del slide actual, como continuación natural del slide anterior."
)


def _operation_block_for(current_slide: int) -> str:
    """Operation block con la regla de fase correcta para el slide actual."""
    if current_slide <= 1:
        phase = _PHASE_RULE_FIRST
    else:
        phase = _PHASE_RULE_CONTINUE.format(slide=current_slide)
    return _OPERATION_BLOCK_BASE.format(phase_rule=phase)

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

# Cuando la plática corre con audience_mode='silent', los oyentes tienen el
# micrófono muteado por default. Si Tato hace preguntas abiertas al aire
# ("¿alguno de ustedes…?", "tengo una pregunta para ustedes") nadie puede
# responder y se queda esperando indefinidamente, frenando la plática. Le
# decimos explícitamente que NO haga ese tipo de engagement.
_AUDIENCE_SILENT_RULE = (
    "[MODO AUDIENCIA: SILENCIOSO] El público te escucha pero su micrófono "
    "está apagado por default. NO hagas preguntas abiertas a la audiencia "
    "('¿alguno de ustedes…?', 'tengo una pregunta', '¿les pregunto…?', "
    "'levanten la mano si…'). NO esperes respuestas verbales: nadie puede "
    "responder libremente. Cuando una nota o punto clave sugiera 'pregunta a "
    "la audiencia', sustituye por una afirmación o reflexión retórica corta y "
    "sigue narrando. Si quieres invitar a interactuar, basta con 'si tienes "
    "una pregunta puedes levantar la mano'. Cuando termines el contenido del "
    "slide, llama avanzar_diapositiva directamente — no esperes señal "
    "verbal.[FIN MODO AUDIENCIA]"
)


def _narrative_rules_for(
    advance_mode: str,
    audience_mode: str = "open",
    current_slide: int = 1,
) -> str:
    rule = _ADVANCE_RULES.get(advance_mode, _ADVANCE_RULES["hybrid"])
    parts = [_operation_block_for(current_slide), rule]
    if audience_mode == "silent":
        parts.append(_AUDIENCE_SILENT_RULE)
    return "\n".join(parts)


_OVERRIDE_NOTICE = (
    "--- IMPORTANTE: PRECEDENCIA DE CONTEXTO ---\n"
    "Cualquier mención de audiencia, lugar, tema, o nombre de organizador en tu rol "
    "base anterior queda ANULADA por el contexto de la plática que sigue. La audiencia, "
    "lugar y tema reales son SIEMPRE los del bloque CONTEXTO DE LA PLÁTICA. Si tu rol "
    "base mencionaba un lugar específico y este manifest dice otro, usa SIEMPRE el "
    "del manifest. Si tu rol base limita la longitud de respuestas (ej. 'máximo 3 "
    "frases'), esa regla NO aplica durante la plática — extiéndete lo necesario para "
    "narrar cada slide a fondo."
)


def build_base_block(platica: Platica, current_slide: int = 1) -> str:
    """Audience, tone, glossary, story arcs, narrative rules.
    Mostly static, salvo la línea de "fase" del operation block que cambia
    entre slide 1 (apertura, saluda) y slides posteriores (continuación, NO
    saluda) — ver `_phase_rule_for`."""
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
    lines.append(
        _narrative_rules_for(
            platica.manifest.advance_mode,
            platica.manifest.audience_mode,
            current_slide=current_slide,
        )
    )
    return "\n".join(lines)


def build_index_block(platica: Platica) -> str:
    """Always-present 1-line summary per slide. Lets the agent foreshadow
    and decide if a callback is valid without inventing detail."""
    lines = ["--- ÍNDICE COMPLETO DE LA PLÁTICA ---"]
    for block in platica.guion:
        lines.append(f"Slide {block.slide}: {block.summary}")
    return "\n".join(lines)


def build_detail_block(
    platica: Platica,
    current_slide: int,
    window: int = 5,
    elapsed_sec: float = 0.0,
) -> str:
    """Full speaker_notes + talking_points for slides in [current-window, current+window].
    Regenerated each time the slide changes — y también periódicamente desde el
    pacing-ticker en agent.py para que el LLM vea el `transcurrido` y los nudges
    de tiempo cuando se acerca o pasa del objetivo de duración."""
    start = max(1, current_slide - window)
    end = min(platica.manifest.slide_count, current_slide + window)
    lines = [
        f"--- DETALLE: SLIDES {start}-{end} (estás en slide {current_slide}) ---"
    ]
    for block in platica.guion:
        if not (start <= block.slide <= end):
            continue
        is_current = block.slide == current_slide
        marker = "  ← SLIDE ACTUAL" if is_current else ""
        lines.append("")
        lines.append(f"• Slide {block.slide}{marker}")
        # Tiempo objetivo: para todos los slides se anota como guía suave.
        # Para el slide actual incluimos el transcurrido y un nudge cuando
        # te acercas (>90%) o te pasas (>140%) del objetivo.
        if block.duration_sec:
            if is_current:
                elapsed = max(0, int(elapsed_sec))
                target = block.duration_sec
                if elapsed_sec > target * 1.4:
                    status = (
                        f"  ⚠ TIEMPO EXCEDIDO ({elapsed}s vs objetivo {target}s) — "
                        "cierra esta idea con UNA frase y avanza al siguiente slide."
                    )
                elif elapsed_sec > target * 0.9:
                    status = (
                        f"  ⏱ Cerca del objetivo ({elapsed}s de {target}s) — "
                        "prepara el cierre, no abras nuevos sub-temas."
                    )
                else:
                    status = ""
                lines.append(f"  Tiempo: objetivo ~{target}s, transcurrido {elapsed}s.{status}")
            else:
                lines.append(f"  Tiempo objetivo: ~{block.duration_sec}s")
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
    base_personality_prompt: str,
    platica: Platica,
    current_slide: int,
    window: int = 5,
    elapsed_sec: float = 0.0,
) -> str:
    """Stitch personality system_prompt + base + índice + detalle. Used both
    at session start and on every slide change (only detalle differs)."""
    return (
        base_personality_prompt.rstrip()
        + "\n\n"
        + build_base_block(platica, current_slide=current_slide)
        + "\n\n"
        + build_index_block(platica)
        + "\n\n"
        + build_detail_block(platica, current_slide, window=window, elapsed_sec=elapsed_sec)
    )
