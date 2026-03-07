import os
import re
import glob
from datetime import datetime, date
from pathlib import Path

SESSIONS_DIR = Path(__file__).parent / "sessions"


class SessionManager:
    """Manages patient session files and directories."""

    def __init__(self, patient_id: str = "paciente_eduardo"):
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', patient_id)
        if not safe_id:
            safe_id = "default"
        self.patient_id = safe_id
        self.patient_dir = SESSIONS_DIR / safe_id
        # Verify the resolved path stays within SESSIONS_DIR
        if not self.patient_dir.resolve().is_relative_to(SESSIONS_DIR.resolve()):
            raise ValueError(f"Invalid patient ID: {patient_id}")
        self.sesiones_dir = self.patient_dir / "sesiones"
        self.conclusiones_dir = self.patient_dir / "conclusiones"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.sesiones_dir.mkdir(parents=True, exist_ok=True)
        self.conclusiones_dir.mkdir(parents=True, exist_ok=True)

    def is_first_session(self) -> bool:
        return not (self.patient_dir / "perfil.md").exists()

    def get_session_number(self) -> int:
        existing = sorted(self.sesiones_dir.glob("*_sesion_*.md"))
        return len(existing) + 1

    def get_session_filepath(self, session_num: int) -> Path:
        today = date.today().isoformat()
        return self.sesiones_dir / f"{today}_sesion_{session_num:03d}.md"

    # --- Read files ---

    def read_file(self, filepath: Path) -> str:
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
        return ""

    def get_profile(self) -> str:
        return self.read_file(self.patient_dir / "perfil.md")

    def get_general_summary(self) -> str:
        return self.read_file(self.patient_dir / "resumen_general.md")

    def get_agenda(self) -> str:
        return self.read_file(self.patient_dir / "agenda.md")

    def get_treatment_plan(self) -> str:
        return self.read_file(self.conclusiones_dir / "plan_terapeutico.md")

    def get_recurring_themes(self) -> str:
        return self.read_file(self.conclusiones_dir / "temas_recurrentes.md")

    def get_progress(self) -> str:
        return self.read_file(self.conclusiones_dir / "progreso.md")

    def get_last_sessions(self, n: int = 2) -> list[dict]:
        files = sorted(self.sesiones_dir.glob("*_sesion_*.md"))
        result = []
        for f in files[-n:]:
            result.append({
                "filename": f.name,
                "content": f.read_text(encoding="utf-8"),
            })
        return result

    def get_pending_tasks(self) -> str:
        """Extract pending tasks from the last session."""
        sessions = self.get_last_sessions(1)
        if not sessions:
            return "No hay tareas pendientes."
        content = sessions[0]["content"]
        # Extract tasks section
        in_tasks = False
        tasks = []
        for line in content.split("\n"):
            if "## Tareas para el paciente" in line:
                in_tasks = True
                continue
            if in_tasks and line.startswith("## "):
                break
            if in_tasks and line.strip().startswith("- ["):
                tasks.append(line.strip())
        return "\n".join(tasks) if tasks else "No hay tareas pendientes."

    # --- Write files ---

    def save_profile(self, content: str):
        (self.patient_dir / "perfil.md").write_text(content, encoding="utf-8")

    def save_agenda(self, content: str):
        (self.patient_dir / "agenda.md").write_text(content, encoding="utf-8")

    def save_general_summary(self, content: str):
        (self.patient_dir / "resumen_general.md").write_text(content, encoding="utf-8")

    def save_session(self, session_num: int, content: str):
        filepath = self.get_session_filepath(session_num)
        filepath.write_text(content, encoding="utf-8")

    def save_treatment_plan(self, content: str):
        (self.conclusiones_dir / "plan_terapeutico.md").write_text(content, encoding="utf-8")

    def save_recurring_themes(self, content: str):
        (self.conclusiones_dir / "temas_recurrentes.md").write_text(content, encoding="utf-8")

    def save_progress(self, content: str):
        (self.conclusiones_dir / "progreso.md").write_text(content, encoding="utf-8")

    # --- Context builder ---

    def build_session_context(self) -> str:
        """Build the full context string for the Dra. Ana prompt."""
        parts = []

        profile = self.get_profile()
        if profile:
            parts.append(f"## Perfil del paciente\n{profile}")

        summary = self.get_general_summary()
        if summary:
            parts.append(f"## Resumen del tratamiento\n{summary}")

        plan = self.get_treatment_plan()
        if plan:
            parts.append(f"## Plan terapéutico\n{plan}")

        tasks = self.get_pending_tasks()
        if tasks and "No hay tareas" not in tasks:
            parts.append(f"## Tareas pendientes del paciente\n{tasks}")

        agenda = self.get_agenda()
        if agenda:
            parts.append(f"## Agenda\n{agenda}")

        last_sessions = self.get_last_sessions(2)
        if last_sessions:
            parts.append("## Últimas sesiones")
            for s in last_sessions:
                parts.append(f"### {s['filename']}\n{s['content']}")

        return "\n\n".join(parts)
