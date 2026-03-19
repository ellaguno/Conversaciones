import os
import logging
from pathlib import Path

from openai import AsyncOpenAI

logger = logging.getLogger("comerciante-con-voz")

FAST_MODEL = "google/gemini-2.0-flash-001"

_client = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
        )
    return _client


async def _llm_call(system: str, user: str) -> str:
    resp = await _get_client().chat.completions.create(
        model=FAST_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
    )
    return resp.choices[0].message.content or ""


def get_summary_path(user_id: str, personality_key: str) -> Path:
    """Return the path to the rolling summary file for a user+personality."""
    data_dir = Path(__file__).parent.parent / "data"
    safe_user = user_id or "default"
    safe_key = personality_key or "unknown"
    return data_dir / safe_user / "conversations" / safe_key / "summary.md"


def read_summary(user_id: str, personality_key: str) -> str:
    """Read existing summary, or empty string if none."""
    path = get_summary_path(user_id, personality_key)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


async def generate_summary(
    user_id: str,
    personality_key: str,
    personality_name: str,
    transcript: list[dict],
) -> None:
    """Generate or update the rolling summary after a session ends."""
    if len(transcript) < 2:
        return

    transcript_text = "\n".join(
        f"{'USUARIO' if t['role'] == 'user' else personality_name.upper()}: {t['text']}"
        for t in transcript
    )

    existing = read_summary(user_id, personality_key)

    if existing:
        new_summary = await _llm_call(
            system=(
                f"Eres un asistente que mantiene un resumen acumulativo de las conversaciones "
                f"entre un usuario y '{personality_name}'. Tu tarea es actualizar el resumen "
                f"existente incorporando los puntos clave de la nueva conversación. "
                f"Mantén el resumen en máximo 500 palabras. Incluye: temas tratados, "
                f"progreso del usuario, preferencias expresadas, datos personales relevantes "
                f"mencionados, y puntos pendientes. Escribe en español en formato Markdown."
            ),
            user=f"""RESUMEN EXISTENTE:
{existing}

NUEVA CONVERSACIÓN:
{transcript_text}

Genera el resumen actualizado.""",
        )
    else:
        new_summary = await _llm_call(
            system=(
                f"Eres un asistente que genera un resumen de la primera conversación "
                f"entre un usuario y '{personality_name}'. Incluye: temas tratados, "
                f"nivel del usuario (si aplica), preferencias expresadas, datos personales "
                f"relevantes mencionados, objetivos o intereses, y puntos pendientes. "
                f"Máximo 500 palabras. Escribe en español en formato Markdown."
            ),
            user=f"""CONVERSACIÓN:
{transcript_text}

Genera el resumen inicial.""",
        )

    # Save
    path = get_summary_path(user_id, personality_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_summary, encoding="utf-8")
    logger.info(f"Resumen actualizado: {path}")
