"""One-off recovery script: regenerate missing therapy notes from saved conversation logs.

Usage:
    python recover_notes.py user_id patient_id conversation_file [conversation_file ...]

Reads each conversation .md file (saved by ConversationLog), parses the transcript,
and runs generate_intake_notes for the first one + generate_session_notes for the rest.
"""
import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env.local")

from session_manager import SessionManager
from note_generator import generate_intake_notes, generate_session_notes


HEADER_RE = re.compile(r"^\*\*(?P<who>[^*]+)\*\*:\s*(?P<text>.*)$")


def parse_conversation(path: Path) -> tuple[list[dict], datetime]:
    """Parse a ConversationLog .md file into (transcript, start_time)."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")

    # Extract start time from filename: YYYY-MM-DD_HH-MM.md
    m = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})\.md$", path.name)
    if not m:
        raise ValueError(f"Filename {path.name} does not match expected format")
    date_str, hh, mm = m.groups()
    start_time = datetime.strptime(f"{date_str} {hh}:{mm}", "%Y-%m-%d %H:%M")

    # Find body after the '---' separator
    try:
        sep_idx = lines.index("---")
    except ValueError:
        sep_idx = 0
    body = lines[sep_idx + 1:]

    transcript: list[dict] = []
    current_role: str | None = None
    current_chunks: list[str] = []

    def flush():
        if current_role and current_chunks:
            content = "\n".join(current_chunks).strip()
            if content:
                transcript.append({"role": current_role, "text": content})

    for line in body:
        m = HEADER_RE.match(line)
        if m:
            # New turn — flush previous
            flush()
            current_chunks = []
            who = m.group("who").strip()
            current_role = "user" if who == "Usuario" else "assistant"
            current_chunks.append(m.group("text"))
        else:
            if current_role is not None:
                current_chunks.append(line)
    flush()

    return transcript, start_time


async def recover(user_id: str, patient_id: str, conv_files: list[Path]) -> None:
    manager = SessionManager(patient_id=patient_id, user_id=user_id)
    print(f"\n=== Recovering: user={user_id} patient={patient_id} ===")
    print(f"  patient_dir: {manager.patient_dir}")

    if not (manager.patient_dir / "therapy_config.json").exists():
        print(f"  WARN: no therapy_config.json — skipping")
        return

    # Sort by filename (which encodes timestamp)
    conv_files = sorted(conv_files, key=lambda p: p.name)

    for i, conv_file in enumerate(conv_files):
        transcript, start_time = parse_conversation(conv_file)
        print(f"  [{i+1}/{len(conv_files)}] {conv_file.name}: {len(transcript)} turnos, inicio {start_time.isoformat()}")
        if len(transcript) < 2:
            print(f"    skipping — too short")
            continue

        is_first = manager.is_first_session()
        if is_first:
            print(f"    -> generate_intake_notes")
            await generate_intake_notes(manager, transcript, start_time)
        else:
            session_num = manager.get_session_number()
            print(f"    -> generate_session_notes (sesión {session_num})")
            await generate_session_notes(manager, transcript, session_num, start_time)
        print(f"    ✓ done")


async def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    user_id = sys.argv[1]
    patient_id = sys.argv[2]
    conv_files = [Path(p) for p in sys.argv[3:]]
    for p in conv_files:
        if not p.exists():
            print(f"ERROR: file not found: {p}")
            sys.exit(1)
    await recover(user_id, patient_id, conv_files)


if __name__ == "__main__":
    asyncio.run(main())
