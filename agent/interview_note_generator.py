"""Post-session analysis for Elena (entrevistadora).

After each session the transcript is run through the analysis pipeline to:
- (intake only) generate the interviewee profile + initial topic tree + agenda
- distill knowledge per tree branch
- update the topic tree (mark covered / propose deepening / insert new subtopics)
- rewrite the general summary in the interviewee's voice
- refresh `pendientes.md` and `agenda.md`

Mirrors note_generator.py — same OpenRouter client, same FAST/ANALYSIS split.

Model strategy (split per step):
  ANALYSIS_MODEL ("smart" — e.g. deepseek-v4-pro): profile, initial tree,
    distill_per_node, tree_update — the steps where reasoning quality matters.
  FAST_MODEL    ("quick"  — e.g. deepseek-v4-flash): session_file, summary,
    pendientes, agenda — straightforward summarization/organization.

Steps that have no data dependency between them are run via asyncio.gather, so a
session intake (3 independent calls) finishes in ~max(t1, t2, t3) instead of
t1+t2+t3.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime

from interview_manager import InterviewManager
from note_generator import _get_client, ANALYSIS_MODEL, FAST_MODEL

logger = logging.getLogger("comerciante-con-voz")

# ---------------------------------------------------------------------------- helpers


def _date_context() -> str:
    return (
        f"FECHA ACTUAL: {date.today().isoformat()} "
        f"({date.today().strftime('%d de %B de %Y')}). "
        "Usa SIEMPRE esta fecha, no inventes otra."
    )


def _format_transcript(transcript: list[dict]) -> str:
    return "\n".join(
        f"{'ENTREVISTADO' if t['role'] == 'user' else 'ELENA'}: {t['text']}"
        for t in transcript
    )


async def _llm(system: str, user: str, model: str = ANALYSIS_MODEL,
               temperature: float = 0.3) -> str:
    resp = await _get_client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


async def _llm_json(system: str, user: str, model: str = ANALYSIS_MODEL) -> dict | None:
    """Same as _llm but tries to parse JSON. Returns None if parsing fails."""
    raw = await _llm(
        system=system + "\n\nIMPORTANTE: Responde SOLO con JSON válido, sin "
        "comentarios, sin texto antes o después, sin fences ```.",
        user=user,
        model=model,
        temperature=0.2,
    )
    # Strip code fences if the model added them anyway.
    s = raw.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s
        if s.endswith("```"):
            s = s.rsplit("```", 1)[0]
        s = s.strip()
        if s.startswith("json"):
            s = s[4:].strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError as e:
        logger.warning(f"No se pudo parsear JSON del modelo: {e}\n--- raw ---\n{raw[:1000]}")
        return None


# ---------------------------------------------------------------------------- intake


async def generate_intake_notes(
    manager: InterviewManager,
    transcript: list[dict],
    start_time: datetime,
    mode: str,
) -> None:
    """Run after the very first interview session.

    Phase 1 (parallel): perfil, árbol inicial, agenda — three independent calls.
    Phase 2: session-notes pipeline (session_file + distill + tree_update +
    summary + pendientes + agenda refresh).
    """
    transcript_text = _format_transcript(transcript)

    logger.info(
        f"[entrevista] intake — analysis={ANALYSIS_MODEL}, fast={FAST_MODEL}, modo={mode}"
    )

    profile_t = _generate_profile(transcript_text, mode)
    tree_t = _generate_initial_tree(transcript_text, mode)
    agenda_t = _generate_initial_agenda(transcript_text, mode)

    profile, tree, agenda = await asyncio.gather(profile_t, tree_t, agenda_t)

    manager.save_profile(profile)
    logger.info("[entrevista] perfil guardado")

    if tree is not None:
        tree["modo"] = mode
        manager.save_tree(tree)
        logger.info(
            f"[entrevista] árbol inicial guardado "
            f"({_count_nodes(tree.get('raiz', {}))} nodos)"
        )
    else:
        logger.warning("[entrevista] no se generó árbol inicial; se mantiene stub vacío")

    manager.save_agenda(agenda)
    logger.info("[entrevista] agenda inicial guardada")

    await generate_session_notes(manager, transcript, 1, start_time, mode)


# ---------------------------------------------------------------------------- followup


async def generate_session_notes(
    manager: InterviewManager,
    transcript: list[dict],
    session_num: int,
    start_time: datetime,
    mode: str | None = None,
) -> None:
    """Run after each follow-up session.

    Phase 1 (parallel, 3 calls): session_file + distill_per_node + tree_update.
    Phase 2 (sequential write): save session_md, knowledge files, updated tree.
    Phase 3 (parallel, 3 calls): general_summary + pendientes + agenda_update.
    """
    duration_min = int((datetime.now() - start_time).total_seconds() / 60)
    transcript_text = _format_transcript(transcript)
    if mode is None:
        mode = manager.get_interview_config().get("mode", "legado")

    tree_view = manager.tree_compact_view()
    tree_raw = json.dumps(manager.get_tree(), ensure_ascii=False, indent=2)

    logger.info(
        f"[entrevista] sesión {session_num} "
        f"({duration_min} min, {len(transcript)} turnos) — phase 1"
    )

    # Phase 1: three independent analysis calls in parallel.
    session_md_t = _generate_session_file(
        transcript_text, session_num, duration_min, tree_view, mode
    )
    distill_t = _distill_per_node(transcript_text, tree_view, mode)
    tree_update_t = _update_tree(transcript_text, tree_raw, session_num, mode)

    session_md, distillate, updated_tree = await asyncio.gather(
        session_md_t, distill_t, tree_update_t
    )

    # Phase 2: persist phase-1 outputs (need this done before phase 3 reads tree).
    manager.save_session(session_num, session_md)

    for node_id, payload in (distillate or {}).items():
        node = manager.find_node(node_id)
        if node is None:
            continue
        # Tolerate both shapes the model may return:
        #   {"id": "texto..."}                — flat
        #   {"id": {"contenido": "texto..."}} — nested (what we asked for)
        if isinstance(payload, str):
            content = payload.strip()
        elif isinstance(payload, dict):
            content = str(payload.get("contenido") or payload.get("content") or "").strip()
        else:
            content = ""
        if content:
            existing = manager.get_node_knowledge(node_id)
            combined = (existing + "\n\n" if existing else "") + (
                f"## Sesión {session_num} ({date.today().isoformat()})\n{content}"
            )
            manager.save_node_knowledge(node_id, node.get("titulo", ""), combined)

    if updated_tree is not None:
        updated_tree["modo"] = mode
        manager.save_tree(updated_tree)

    # Phase 3: three remaining calls in parallel — they read the persisted tree/notes.
    new_tree_view = manager.tree_compact_view()
    existing_summary = manager.get_general_summary()

    logger.info(f"[entrevista] sesión {session_num} — phase 3")

    summary_t = _update_general_summary(existing_summary, session_md, session_num, mode)
    pendientes_t = _generate_pendientes(new_tree_view, mode)
    agenda_t = _build_updated_agenda(manager.get_agenda(), session_num, new_tree_view, mode)

    new_summary, pendientes, new_agenda = await asyncio.gather(
        summary_t, pendientes_t, agenda_t
    )

    manager.save_general_summary(new_summary)
    manager.save_pendientes(pendientes)
    manager.save_agenda(new_agenda)

    logger.info(f"[entrevista] sesión {session_num} procesada")


# ---------------------------------------------------------------------------- prompts


async def _generate_profile(transcript: str, mode: str) -> str:
    mode_hint = (
        "Es una entrevista de LEGADO personal: enfoca el perfil en quién es la "
        "persona, su contexto vital, qué siente que vale la pena preservar."
        if mode == "legado"
        else "Es una entrevista CORPORATIVA: enfoca el perfil en el puesto, "
        "área, antigüedad, alcance de responsabilidades, contexto de la salida "
        "o transferencia."
    )
    return await _llm(
        system=(
            "Eres un analista cuidadoso. A partir de una transcripción de "
            "entrevista de intake genera el PERFIL del entrevistado en Markdown. "
            f"{mode_hint} "
            "Sé concreto, evita generalidades. Si la persona no mencionó algún "
            "dato, di 'No mencionado' en lugar de inventar. Escribe en español."
        ),
        user=f"{_date_context()}\n\nTRANSCRIPCIÓN DE INTAKE:\n{transcript}\n\n"
             "Genera el perfil en Markdown.",
    )


async def _generate_initial_tree(transcript: str, mode: str) -> dict | None:
    mode_hint = (
        "ETAPAS / PERSONAS / MOMENTOS / OFICIOS / CONSEJOS: organiza el árbol "
        "alrededor de la vida de la persona. Sugiere subnodos para personas "
        "importantes mencionadas, etapas de vida, aprendizajes."
        if mode == "legado"
        else "ÁREAS DE TRABAJO: clientes, proveedores, procesos internos, "
        "herramientas, mercado, gente clave, riesgos, historia del puesto. "
        "Organiza el árbol alrededor de lo que la persona hace y sabe."
    )
    return await _llm_json(
        system=(
            "Eres un planificador de entrevistas. A partir de la sesión de "
            "intake construye el ÁRBOL JERÁRQUICO DE TEMAS que guiará las "
            "siguientes sesiones de la entrevista. "
            f"{mode_hint} "
            "El árbol debe tener entre 4 y 8 ramas principales. Cada rama "
            "principal puede tener entre 2 y 6 subramas. Profundidad máxima 3. "
            "Cada nodo lleva: id (string como '1', '1.2', '1.2.3'), titulo, "
            "estado ('pendiente'), preguntas_clave (array de strings, 2-5 por "
            "nodo hoja), resumen ('' al inicio), sesiones ([]) e hijos. "
            "La raíz tiene id='r' y titulo describiendo a la persona."
        ),
        user=f"{_date_context()}\n\nTRANSCRIPCIÓN DE INTAKE:\n{transcript}\n\n"
             "Devuelve el árbol JSON con shape:\n"
             "{\"version\":1,\"modo\":\"...\",\"raiz\":{\"id\":\"r\",\"titulo\":\"...\",\"estado\":\"pendiente\",\"preguntas_clave\":[],\"resumen\":\"\",\"sesiones\":[],\"hijos\":[...]}}",
    )


async def _generate_initial_agenda(transcript: str, mode: str) -> str:
    return await _llm(
        model=FAST_MODEL,
        system=(
            "Eres un asistente que organiza la agenda de entrevistas. "
            "A partir de la sesión de intake, extrae la frecuencia y duración "
            "acordadas y propone fechas para las próximas 3-4 sesiones, "
            "junto con qué ramas del árbol tocar en cada una. "
            "Escribe en Markdown, en español."
        ),
        user=f"Hoy es {date.today().isoformat()}.\n\n"
             f"TRANSCRIPCIÓN:\n{transcript}\n\n"
             "Genera la agenda en Markdown.",
    )


async def _generate_session_file(transcript: str, session_num: int,
                                  duration_min: int, tree_view: str,
                                  mode: str) -> str:
    # Fast model — structured summarization, not deep reasoning.
    return await _llm(
        model=FAST_MODEL,
        system=(
            "Eres un editor de transcripciones de entrevistas. Genera las "
            "notas estructuradas de la sesión en Markdown. Sé fiel a lo dicho "
            "por el entrevistado, conserva su voz y vocabulario. Escribe en español."
        ),
        user=f"""{_date_context()}

ÁRBOL DE TEMAS ACTUAL:
{tree_view}

Genera las notas de esta sesión:

# Sesión {session_num} - {date.today().strftime('%d de %B de %Y')}

## Datos
- Fecha: {date.today().isoformat()}
- Duración: {duration_min} minutos
- Modo: {mode}

## Resumen
[3-5 párrafos de los temas tocados, en orden cronológico, conservando la voz del entrevistado]

## Nodos tocados
[Lista con ids del árbol y qué tan profundo se llegó, ej. '- [1.2] El padre — cubierto: anécdota de la fábrica + carácter']

## Citas memorables
[Frases textuales del entrevistado que valga la pena preservar]

## Temas que surgieron sin estar en el árbol
[Lista — el análisis posterior decidirá si se agregan como subtemas]

## Para la próxima sesión
[Qué quedó a medias, qué propuso Elena para profundizar]

---
TRANSCRIPCIÓN:
{transcript}""",
    )


async def _distill_per_node(transcript: str, tree_view: str,
                             mode: str) -> dict | None:
    """Return {node_id: {'contenido': '...md...'}} for the nodes touched."""
    return await _llm_json(
        system=(
            "Eres un destilador de conocimiento. Lees una transcripción de "
            "entrevista y la organizas por nodo del árbol. Para cada nodo que "
            "fue tocado de manera sustantiva en esta sesión, escribe en "
            "Markdown lo que el entrevistado contó — fiel a su voz, ordenado, "
            "sin perder detalles concretos (nombres, lugares, fechas, "
            "anécdotas, criterios). NO inventes. Si una rama solo se rozó, "
            "omítela. Escribe en español."
        ),
        user=f"ÁRBOL DE TEMAS:\n{tree_view}\n\nTRANSCRIPCIÓN:\n{transcript}\n\n"
             "Devuelve JSON con shape: {\"<id_nodo>\": {\"contenido\": \"...md...\"}, ...}",
    )


async def _update_tree(transcript: str, current_tree_json: str,
                        session_num: int, mode: str) -> dict | None:
    """Re-emit the full updated tree based on what happened in this session."""
    return await _llm_json(
        system=(
            "Eres un curador del árbol de temas de una entrevista. "
            "Recibes el árbol actual y la transcripción de la última sesión. "
            "Devuelves el árbol completo actualizado con las siguientes reglas:\n"
            "- Mantén ids estables — NUNCA cambies el id de un nodo existente.\n"
            "- Actualiza 'estado' de los nodos tocados: 'cubierto' si quedó "
            "  satisfactoriamente trabajado, 'en_progreso' si quedó a medias, "
            "  'profundizar' si surgió algo que vale la pena retomar.\n"
            "- Si un nodo quedó marcado 'profundizar', llena 'razon_profundizar'.\n"
            "- Si surgieron temas nuevos no anticipados, agrégalos como hijos "
            "  bajo el nodo padre más natural. Asigna ids como "
            "  parent_id + '.' + (count+1).\n"
            "- Agrega session_num a 'sesiones' de cada nodo tocado.\n"
            "- Refresca 'resumen' breve (1-3 líneas) en cada nodo tocado con "
            "  lo que ahora sabemos sobre él."
        ),
        user=f"ÁRBOL ACTUAL (JSON):\n{current_tree_json}\n\n"
             f"SESIÓN #{session_num} TRANSCRIPCIÓN:\n{transcript}\n\n"
             "Devuelve el JSON completo del árbol actualizado, con el mismo shape.",
    )


async def _update_general_summary(existing: str, session_md: str,
                                   session_num: int, mode: str) -> str:
    # Fast model — narrative consolidation, not deep analysis.
    return await _llm(
        model=FAST_MODEL,
        system=(
            "Eres un redactor que mantiene el resumen general de una "
            "entrevista. Actualiza el resumen incorporando lo nuevo de la "
            "última sesión. Mantén la voz del entrevistado cuando cites o "
            "parafrasees. Estructura por temas, no por sesiones. Si no hay "
            "resumen previo, créalo. Escribe en español, en Markdown."
        ),
        user=f"{_date_context()}\n\nRESUMEN EXISTENTE:\n"
             f"{existing or '(Sin resumen previo — primera sesión)'}\n\n"
             f"NOTAS DE SESIÓN {session_num}:\n{session_md}\n\n"
             "Genera el resumen general actualizado en Markdown.",
    )


async def _generate_pendientes(tree_view: str, mode: str) -> str:
    return await _llm(
        model=FAST_MODEL,
        system=(
            "Eres un asistente que lista lo pendiente de una entrevista. "
            "A partir del árbol de temas, identifica qué nodos quedan por "
            "cubrir (estado pendiente) y cuáles necesitan profundizarse "
            "(estado profundizar). Escribe en Markdown, en español, con dos "
            "secciones: ## Por cubrir y ## Por profundizar."
        ),
        user=f"ÁRBOL DE TEMAS:\n{tree_view}\n\nGenera el resumen de pendientes.",
    )


async def _build_updated_agenda(existing: str, session_num: int,
                                  tree_view: str, mode: str) -> str:
    return await _llm(
        model=FAST_MODEL,
        system=(
            "Eres un asistente que mantiene la agenda de entrevistas. Marca "
            "la sesión que acaba de terminar como completada, y propón hasta "
            "3 sesiones futuras indicando qué nodos del árbol tocar en cada "
            "una, según lo que queda pendiente. Escribe en Markdown, en español."
        ),
        user=f"AGENDA EXISTENTE:\n{existing or '(Sin agenda previa)'}\n\n"
             f"Sesión {session_num} se completó hoy ({date.today().isoformat()}).\n\n"
             f"ÁRBOL ACTUAL:\n{tree_view}\n\n"
             "Genera la agenda actualizada.",
    )


# ---------------------------------------------------------------------------- util


def _count_nodes(node: dict) -> int:
    return 1 + sum(_count_nodes(c) for c in (node.get("hijos") or []))
