import os
import logging
from datetime import date, datetime, timedelta
from openai import AsyncOpenAI

from session_manager import SessionManager

logger = logging.getLogger("comerciante-con-voz")

MODEL = "google/gemini-2.0-flash-001"
_client = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
        )
    return _client


async def generate_session_notes(
    manager: SessionManager,
    transcript: list[dict],
    session_num: int,
    start_time: datetime,
) -> None:
    """Generate all post-session notes from the transcript."""
    duration_min = int((datetime.now() - start_time).total_seconds() / 60)
    transcript_text = "\n".join(
        f"{'PACIENTE' if t['role'] == 'user' else 'DRA. ANA'}: {t['text']}"
        for t in transcript
    )

    logger.info(f"Generando notas para sesión {session_num} ({duration_min} min, {len(transcript)} turnos)")

    # 1. Generate session file
    session_content = await _generate_session_file(transcript_text, session_num, duration_min)
    manager.save_session(session_num, session_content)
    logger.info(f"Sesión {session_num} guardada")

    # 2. Update general summary
    existing_summary = manager.get_general_summary()
    new_summary = await _update_general_summary(existing_summary, session_content, session_num)
    manager.save_general_summary(new_summary)

    # 3. Update treatment plan if needed (after session 1, and every 3 sessions)
    if session_num == 1 or session_num % 3 == 0:
        existing_plan = manager.get_treatment_plan()
        new_plan = await _update_treatment_plan(existing_plan, session_content, existing_summary)
        manager.save_treatment_plan(new_plan)

    # 4. Update recurring themes
    existing_themes = manager.get_recurring_themes()
    new_themes = await _update_recurring_themes(existing_themes, session_content)
    manager.save_recurring_themes(new_themes)

    # 5. Update progress
    existing_progress = manager.get_progress()
    new_progress = await _update_progress(existing_progress, session_content)
    manager.save_progress(new_progress)

    # 6. Update agenda
    await _update_agenda(manager, session_num)

    logger.info(f"Todas las notas de sesión {session_num} generadas")


async def generate_intake_notes(
    manager: SessionManager,
    transcript: list[dict],
    start_time: datetime,
) -> None:
    """Generate notes specifically for the intake (first) session."""
    transcript_text = "\n".join(
        f"{'PACIENTE' if t['role'] == 'user' else 'DRA. ANA'}: {t['text']}"
        for t in transcript
    )

    # Generate profile
    profile = await _generate_profile(transcript_text)
    manager.save_profile(profile)

    # Generate initial treatment plan
    plan = await _generate_initial_plan(transcript_text)
    manager.save_treatment_plan(plan)

    # Generate agenda
    agenda = await _generate_initial_agenda(transcript_text)
    manager.save_agenda(agenda)

    # Generate session notes as usual
    await generate_session_notes(manager, transcript, 1, start_time)


def _date_context() -> str:
    return f"FECHA ACTUAL: {date.today().isoformat()} ({date.today().strftime('%d de %B de %Y')}). Usa SIEMPRE esta fecha, NO inventes otra."


async def _llm_call(system: str, user: str) -> str:
    resp = await _get_client().chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
    )
    return resp.choices[0].message.content or ""


async def _generate_session_file(transcript: str, session_num: int, duration_min: int) -> str:
    today = date.today().strftime("%d de %B de %Y")
    today_iso = date.today().isoformat()
    return await _llm_call(
        system=(
            "Eres un psicólogo supervisor que revisa transcripciones de sesiones terapéuticas. "
            "Genera notas clínicas en formato Markdown siguiendo EXACTAMENTE esta estructura. "
            "Sé conciso pero completo. Escribe en español."
        ),
        user=f"""{_date_context()}

Genera las notas de la siguiente sesión terapéutica:

# Sesión {session_num} - {today}

## Datos
- Fecha: {date.today().isoformat()}
- Duración: {duration_min} minutos
- Estado emocional al inicio: [inferir de la transcripción]
- Estado emocional al cierre: [inferir de la transcripción]

## Transcripción resumida
[Resumen de 3-5 párrafos de los temas principales discutidos]

## Notas clínicas
[Observaciones profesionales en viñetas]

## Tareas para el paciente
[Tareas acordadas o sugeridas, en formato - [ ] tarea]

## Temas para próxima sesión
[Temas a retomar]

---
TRANSCRIPCIÓN:
{transcript}""",
    )


async def _update_general_summary(existing: str, session_notes: str, session_num: int) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo supervisor. Actualiza el resumen general del tratamiento "
            "incorporando la información de la última sesión. Mantén un formato claro y "
            "cronológico. Si no hay resumen previo, crea uno nuevo. Escribe en español."
        ),
        user=f"""{_date_context()}

RESUMEN EXISTENTE:
{existing or '(Primera sesión, no hay resumen previo)'}

NOTAS DE SESIÓN {session_num}:
{session_notes}

Genera el resumen general actualizado en Markdown.""",
    )


async def _update_treatment_plan(existing: str, session_notes: str, summary: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo supervisor. Actualiza el plan terapéutico basándote en "
            "el progreso del paciente. Incluye objetivos, técnicas a usar y metas. "
            "Escribe en español."
        ),
        user=f"""{_date_context()}

PLAN EXISTENTE:
{existing or '(No hay plan previo)'}

RESUMEN DEL TRATAMIENTO:
{summary}

ÚLTIMA SESIÓN:
{session_notes}

Genera el plan terapéutico actualizado en Markdown.""",
    )


async def _generate_profile(transcript: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo que genera el perfil inicial de un paciente a partir de "
            "la sesión de intake. Extrae: nombre, datos relevantes, motivo de consulta, "
            "antecedentes mencionados, y objetivos expresados. Escribe en español."
        ),
        user=f"""{_date_context()}

A partir de esta transcripción de sesión de intake, genera el perfil del paciente en Markdown:

{transcript}""",
    )


async def _generate_initial_plan(transcript: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo que genera un plan terapéutico inicial basándose en la "
            "sesión de intake. Incluye: objetivos, enfoque terapéutico sugerido, "
            "frecuencia recomendada, y primeras áreas de trabajo. Escribe en español."
        ),
        user=f"""{_date_context()}

A partir de esta sesión de intake, genera un plan terapéutico inicial en Markdown:

{transcript}""",
    )


async def _generate_initial_agenda(transcript: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo que genera la agenda de sesiones. Extrae la frecuencia "
            "acordada con el paciente (diaria, 1-2 veces por semana, etc). "
            "Calcula las próximas 4 fechas de sesión. Escribe en español. "
            "Formato: lista con fechas y estado (pendiente/completada)."
        ),
        user=f"""A partir de esta sesión, genera la agenda de sesiones en Markdown.
Hoy es {date.today().isoformat()}.

{transcript}""",
    )


async def _update_recurring_themes(existing: str, session_notes: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo supervisor. Actualiza la lista de temas recurrentes del "
            "paciente. Identifica patrones que se repiten. Escribe en español."
        ),
        user=f"""TEMAS RECURRENTES EXISTENTES:
{existing or '(No hay registro previo)'}

ÚLTIMA SESIÓN:
{session_notes}

Actualiza los temas recurrentes en Markdown.""",
    )


async def _update_progress(existing: str, session_notes: str) -> str:
    return await _llm_call(
        system=(
            "Eres un psicólogo supervisor. Actualiza el registro de progreso del paciente. "
            "Nota avances, retrocesos y estancamientos. Escribe en español."
        ),
        user=f"""PROGRESO EXISTENTE:
{existing or '(No hay registro previo)'}

ÚLTIMA SESIÓN:
{session_notes}

Actualiza el progreso en Markdown.""",
    )


async def _update_agenda(manager: SessionManager, session_num: int):
    existing = manager.get_agenda()
    new_agenda = await _llm_call(
        system=(
            "Eres un asistente que actualiza la agenda de sesiones terapéuticas. "
            "Marca la sesión actual como completada y asegúrate de que haya al menos "
            "3 sesiones futuras programadas según la frecuencia acordada. "
            "Escribe en español."
        ),
        user=f"""AGENDA EXISTENTE:
{existing or '(No hay agenda)'}

La sesión {session_num} se completó hoy ({date.today().isoformat()}).
Actualiza la agenda en Markdown.""",
    )
    manager.save_agenda(new_agenda)
