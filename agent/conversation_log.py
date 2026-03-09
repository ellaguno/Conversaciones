import re
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


class ConversationLog:
    """Saves conversation transcripts as .md files, organized by user and personality."""

    def __init__(self, personality_key: str, personality_name: str, user_id: str = "default"):
        safe_key = re.sub(r'[^a-zA-Z0-9_-]', '', personality_key)
        safe_user = re.sub(r'[^a-zA-Z0-9_-]', '', user_id)
        self.personality_key = safe_key or "unknown"
        self.personality_name = personality_name
        self.user_id = safe_user or "default"
        self.log_dir = DATA_DIR / self.user_id / "conversations" / self.personality_key
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def get_log_dir(self) -> Path:
        return self.log_dir

    def save(self, transcript: list[dict], start_time: datetime) -> Path:
        """Save a conversation transcript as a Markdown file with timestamp header."""
        end_time = datetime.now()
        duration_min = int((end_time - start_time).total_seconds() / 60)

        # Filename: YYYY-MM-DD_HH-MM.md
        filename = start_time.strftime("%Y-%m-%d_%H-%M") + ".md"
        filepath = self.log_dir / filename

        # Build content
        lines = []
        lines.append(f"# Conversación con {self.personality_name}")
        lines.append("")
        lines.append(f"- **Fecha**: {start_time.strftime('%d de %B de %Y')}")
        lines.append(f"- **Hora**: {start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}")
        lines.append(f"- **Duración**: {duration_min} minutos")
        lines.append(f"- **Turnos**: {len(transcript)}")
        lines.append("")
        lines.append("---")
        lines.append("")

        for turn in transcript:
            role = turn["role"]
            text = turn["text"]
            if role == "user":
                lines.append(f"**Usuario**: {text}")
            else:
                lines.append(f"**{self.personality_name}**: {text}")
            lines.append("")

        filepath.write_text("\n".join(lines), encoding="utf-8")
        return filepath
