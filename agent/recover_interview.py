"""One-shot recovery: re-run the post-session analysis on a saved interview
transcript (stored in data/<user>/conversations/entrevistadora/<file>.md by
ConversationLog) when the original analysis failed.

Usage:
    python recover_interview.py <user_id> <interview_id> <transcript_filename>

Example:
    python recover_interview.py admin experto_en_software_libre 2026-05-20_15-09.md
"""
from __future__ import annotations

import asyncio
import logging
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

from interview_manager import InterviewManager, DATA_DIR
from interview_note_generator import (
    generate_intake_notes,
    generate_session_notes,
    ANALYSIS_MODEL,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("recover_interview")


# Match lines like:
#   **Usuario**: text
#   **Elena**: text (or whichever personality name)
ROLE_RE = re.compile(r"^\*\*([^*]+)\*\*:\s*(.*)$")


def parse_transcript_md(md_text: str) -> tuple[list[dict], datetime]:
    """Parse the ConversationLog markdown into (transcript, start_time).

    Returns:
        transcript: list of {"role": "user"|"assistant", "text": str}
        start_time: best-effort parsed timestamp from the header, or now()
    """
    lines = md_text.splitlines()

    # Find start time from header (best effort).
    start_time = datetime.now()
    date_str = None
    hour_str = None
    for ln in lines[:20]:
        if ln.startswith("- **Fecha**:"):
            date_str = ln.split(":", 1)[1].strip()
        if ln.startswith("- **Hora**:"):
            # "15:09 - 15:28"
            hour_str = ln.split(":", 1)[1].strip().split("-", 1)[0].strip()
    if date_str and hour_str:
        # date_str: "20 de May de 2026"
        try:
            months = {
                "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5,
                "junio": 6, "julio": 7, "agosto": 8, "septiembre": 9,
                "octubre": 10, "noviembre": 11, "diciembre": 12,
                # English locale fallback (e.g. "May")
                "january": 1, "february": 2, "march": 3, "april": 4,
                "may": 5,
                "june": 6, "july": 7, "august": 8, "september": 9,
                "october": 10, "november": 11, "december": 12,
            }
            parts = date_str.lower().split()
            day = int(parts[0])
            month = months.get(parts[2], 1)
            year = int(parts[4])
            h, m = map(int, hour_str.split(":"))
            start_time = datetime(year, month, day, h, m)
        except (ValueError, IndexError, KeyError):
            pass

    # Skip header — body starts after the "---" line.
    body_idx = 0
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            body_idx = i + 1
            break

    transcript: list[dict] = []
    current_role: str | None = None
    current_text: list[str] = []

    def flush():
        if current_role and current_text:
            transcript.append({
                "role": current_role,
                "text": "\n".join(current_text).strip(),
            })

    for ln in lines[body_idx:]:
        m = ROLE_RE.match(ln)
        if m:
            # New turn — flush previous
            flush()
            speaker, text = m.group(1).strip(), m.group(2)
            # "Usuario" → user; everything else → assistant
            current_role = "user" if speaker.lower() == "usuario" else "assistant"
            current_text = [text] if text else []
        else:
            # Continuation of current turn (multiline message)
            if current_role is not None and ln.strip():
                current_text.append(ln)
    flush()

    return transcript, start_time


async def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)

    user_id, interview_id, transcript_filename = sys.argv[1:4]

    transcript_path = (
        DATA_DIR / user_id / "conversations" / "entrevistadora" / transcript_filename
    )
    if not transcript_path.exists():
        logger.error(f"No existe: {transcript_path}")
        sys.exit(1)

    logger.info(f"Leyendo transcripción: {transcript_path}")
    md = transcript_path.read_text(encoding="utf-8")
    transcript, start_time = parse_transcript_md(md)
    logger.info(
        f"Parsed {len(transcript)} turnos, "
        f"start_time = {start_time.isoformat()}"
    )
    if len(transcript) < 2:
        logger.error("Transcripción demasiado corta")
        sys.exit(1)

    manager = InterviewManager(interview_id=interview_id, user_id=user_id)
    mode = manager.get_interview_config().get("mode", "legado")
    logger.info(
        f"Interview dir: {manager.interview_dir}  |  modo: {mode}  |  "
        f"modelo análisis: {ANALYSIS_MODEL}"
    )

    status_file = manager.interview_dir / ".generating"
    status_file.write_text(datetime.now().isoformat(), encoding="utf-8")
    try:
        if manager.is_first_session():
            logger.info("Corriendo intake (perfil + árbol inicial + agenda + sesión 1)…")
            await generate_intake_notes(manager, transcript, start_time, mode)
        else:
            session_num = manager.get_session_number()
            logger.info(f"Corriendo análisis de sesión {session_num}…")
            await generate_session_notes(
                manager, transcript, session_num, start_time, mode
            )
        logger.info("✓ Análisis completado")
    finally:
        status_file.unlink(missing_ok=True)


if __name__ == "__main__":
    asyncio.run(main())
