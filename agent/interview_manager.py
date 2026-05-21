"""Manages interview files: per-interviewee directory, hierarchical topic tree,
session transcripts, and the distilled knowledge corpus organized by tree node.

Layout (mirror of SessionManager):

    data/<user>/sessions/<interview_id>/
        entrevista_config.json           # mode, interviewee name, frequency
        perfil.md                        # who they are, why we're interviewing
        arbol_temas.json                 # hierarchical topic tree
        resumen_general.md               # accumulated distillate
        agenda.md                        # next session plan
        sesiones/
            YYYY-MM-DD_sesion_001.md     # per-session transcript + notes
        conclusiones/
            pendientes.md                # branches still pending / to deepen
            conocimiento/
                <node_path>.md           # distilled knowledge per branch

Tree node shape (in arbol_temas.json):

    {
        "id": "1.2",
        "titulo": "El padre",
        "estado": "pendiente" | "en_progreso" | "cubierto" | "profundizar" | "saltado",
        "preguntas_clave": ["..."],
        "resumen": "...",
        "razon_profundizar": "...",       # optional, set when estado=profundizar
        "sesiones": [1, 2],                # session_nums that touched this node
        "hijos": [ ... ]
    }
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent.parent / "data"

VALID_STATES = {"pendiente", "en_progreso", "cubierto", "profundizar", "saltado"}

# Heuristic threshold (in characters of the destilled knowledge file) above
# which a non-manually-set node is auto-promoted to "cubierto". Below the
# threshold but with any content → "en_progreso". See apply_state_heuristic().
KNOWLEDGE_CUBIERTO_THRESHOLD = 1500


def _slugify(text: str) -> str:
    """Convert a node title to a safe filename slug."""
    s = re.sub(r"[^a-zA-Z0-9\-_ ]", "", text or "").strip().lower()
    s = re.sub(r"\s+", "-", s)
    return s[:60] or "nodo"


class InterviewManager:
    """Manages interview files and the topic tree for one interviewee."""

    def __init__(self, interview_id: str = "default", user_id: str = "default"):
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", interview_id) or "default"
        safe_user = re.sub(r"[^a-zA-Z0-9_-]", "", user_id) or "default"

        self.interview_id = safe_id
        self.user_id = safe_user

        self.sessions_base = DATA_DIR / safe_user / "sessions"
        self.interview_dir = self.sessions_base / safe_id

        user_data_dir = DATA_DIR / safe_user
        if not self.interview_dir.resolve().is_relative_to(user_data_dir.resolve()):
            raise ValueError(f"Invalid interview ID: {interview_id}")

        self.sesiones_dir = self.interview_dir / "sesiones"
        self.conclusiones_dir = self.interview_dir / "conclusiones"
        self.conocimiento_dir = self.conclusiones_dir / "conocimiento"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.sesiones_dir.mkdir(parents=True, exist_ok=True)
        self.conclusiones_dir.mkdir(parents=True, exist_ok=True)
        self.conocimiento_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ config

    def has_stored_config(self) -> bool:
        return (self.interview_dir / "entrevista_config.json").exists()

    def is_first_session(self) -> bool:
        """First session = no profile written yet (intake notes not generated)."""
        return not (self.interview_dir / "perfil.md").exists()

    def save_interview_config(self, mode: str, interviewee_name: str = "",
                              frequency: str = "") -> None:
        config = {
            "mode": mode,
            "intervieweeName": interviewee_name,
            "frequency": frequency,
        }
        (self.interview_dir / "entrevista_config.json").write_text(
            json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def get_interview_config(self) -> dict:
        cf = self.interview_dir / "entrevista_config.json"
        if cf.exists():
            try:
                return json.loads(cf.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, TypeError):
                pass
        return {"mode": "legado", "intervieweeName": "", "frequency": ""}

    # ------------------------------------------------------------------ files

    def _read(self, path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def get_profile(self) -> str:
        return self._read(self.interview_dir / "perfil.md")

    def save_profile(self, content: str) -> None:
        (self.interview_dir / "perfil.md").write_text(content, encoding="utf-8")

    def get_general_summary(self) -> str:
        return self._read(self.interview_dir / "resumen_general.md")

    def save_general_summary(self, content: str) -> None:
        (self.interview_dir / "resumen_general.md").write_text(
            content, encoding="utf-8"
        )

    def get_agenda(self) -> str:
        return self._read(self.interview_dir / "agenda.md")

    def save_agenda(self, content: str) -> None:
        (self.interview_dir / "agenda.md").write_text(content, encoding="utf-8")

    def get_pendientes(self) -> str:
        return self._read(self.conclusiones_dir / "pendientes.md")

    def save_pendientes(self, content: str) -> None:
        (self.conclusiones_dir / "pendientes.md").write_text(
            content, encoding="utf-8"
        )

    # ----------------------------------------------------------------- sessions

    def get_session_number(self) -> int:
        existing = sorted(self.sesiones_dir.glob("*_sesion_*.md"))
        return len(existing) + 1

    def get_session_filepath(self, session_num: int) -> Path:
        today = date.today().isoformat()
        return self.sesiones_dir / f"{today}_sesion_{session_num:03d}.md"

    def save_session(self, session_num: int, content: str) -> None:
        self.get_session_filepath(session_num).write_text(
            content, encoding="utf-8"
        )

    def get_last_sessions(self, n: int = 2) -> list[dict]:
        files = sorted(self.sesiones_dir.glob("*_sesion_*.md"))
        return [
            {"filename": f.name, "content": f.read_text(encoding="utf-8")}
            for f in files[-n:]
        ]

    # ------------------------------------------------------------- knowledge

    def save_node_knowledge(self, node_id: str, node_title: str, content: str) -> None:
        """Append/overwrite distilled knowledge for a tree node."""
        filename = f"{node_id.replace('.', '_')}-{_slugify(node_title)}.md"
        (self.conocimiento_dir / filename).write_text(content, encoding="utf-8")

    def get_node_knowledge(self, node_id: str) -> str:
        # Find by id prefix (title may have changed)
        prefix = node_id.replace(".", "_") + "-"
        for f in self.conocimiento_dir.glob(f"{prefix}*.md"):
            return f.read_text(encoding="utf-8")
        return ""

    # ----------------------------------------------------------------- tree

    def get_tree(self) -> dict:
        """Read the topic tree from disk. Returns an empty stub if missing."""
        tf = self.interview_dir / "arbol_temas.json"
        if tf.exists():
            try:
                return json.loads(tf.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, TypeError):
                pass
        return {
            "version": 1,
            "modo": self.get_interview_config().get("mode", "legado"),
            "updated_at": None,
            "raiz": {
                "id": "r",
                "titulo": "Entrevista",
                "estado": "pendiente",
                "preguntas_clave": [],
                "resumen": "",
                "sesiones": [],
                "hijos": [],
            },
        }

    def save_tree(self, tree: dict) -> None:
        tree = dict(tree)
        tree["updated_at"] = datetime.now().isoformat()
        (self.interview_dir / "arbol_temas.json").write_text(
            json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def find_node(self, node_id: str) -> dict | None:
        def walk(n: dict) -> dict | None:
            if n.get("id") == node_id:
                return n
            for child in n.get("hijos", []) or []:
                found = walk(child)
                if found is not None:
                    return found
            return None

        tree = self.get_tree()
        return walk(tree["raiz"])

    def update_node(self, node_id: str, **fields: Any) -> bool:
        """Mutate fields on a node by id. Returns True if found."""
        tree = self.get_tree()

        def walk(n: dict) -> bool:
            if n.get("id") == node_id:
                for k, v in fields.items():
                    n[k] = v
                return True
            for child in n.get("hijos", []) or []:
                if walk(child):
                    return True
            return False

        if walk(tree["raiz"]):
            self.save_tree(tree)
            return True
        return False

    def add_child(self, parent_id: str, titulo: str, motivo: str = "") -> str | None:
        """Append a new child to parent_id. Returns the new node's id, or None
        if the parent was not found."""
        tree = self.get_tree()

        def walk(n: dict) -> str | None:
            if n.get("id") == parent_id:
                existing = n.get("hijos") or []
                # Generate a new id: parent_id.<n+1> ; or "1" if parent is root
                if parent_id == "r":
                    new_id = str(len(existing) + 1)
                else:
                    new_id = f"{parent_id}.{len(existing) + 1}"
                new_node = {
                    "id": new_id,
                    "titulo": titulo,
                    "estado": "pendiente",
                    "preguntas_clave": [],
                    "resumen": "",
                    "sesiones": [],
                    "hijos": [],
                }
                if motivo:
                    new_node["motivo_alta"] = motivo
                n.setdefault("hijos", []).append(new_node)
                return new_id
            for child in n.get("hijos", []) or []:
                got = walk(child)
                if got:
                    return got
            return None

        new_id = walk(tree["raiz"])
        if new_id is not None:
            self.save_tree(tree)
        return new_id

    def mark_session_touched(self, node_id: str, session_num: int) -> None:
        """Append session_num to a node's 'sesiones' list (deduped)."""
        node = self.find_node(node_id)
        if node is None:
            return
        sessions = node.get("sesiones") or []
        if session_num not in sessions:
            sessions.append(session_num)
            self.update_node(node_id, sesiones=sessions)

    # -------------------------------------------------------- manual / heuristic

    def merge_preserving_manual_states(self, llm_tree: dict) -> dict:
        """Given an LLM-emitted updated tree, override any node's estado /
        razon_profundizar with the current (on-disk) value when that node has
        `estado_manual: true`. Robust to the LLM dropping the field entirely.
        Also carries the `estado_manual` flag forward into the new tree."""
        current = self.get_tree()
        manual_map: dict[str, dict] = {}

        def index(n: dict) -> None:
            if n.get("estado_manual"):
                manual_map[n.get("id")] = {
                    "estado": n.get("estado"),
                    "razon_profundizar": n.get("razon_profundizar"),
                }
            for c in n.get("hijos") or []:
                index(c)

        index(current["raiz"])

        def patch(n: dict) -> None:
            mp = manual_map.get(n.get("id"))
            if mp is not None:
                n["estado"] = mp["estado"]
                if mp["razon_profundizar"] is not None:
                    n["razon_profundizar"] = mp["razon_profundizar"]
                elif "razon_profundizar" in n:
                    # Manual + no reason → drop any stale reason the LLM proposed.
                    del n["razon_profundizar"]
                n["estado_manual"] = True
            for c in n.get("hijos") or []:
                patch(c)

        patch(llm_tree["raiz"])
        return llm_tree

    def apply_state_heuristic(self) -> int:
        """For every node where `estado_manual` is not True, derive `estado`
        from the size of its destilled-knowledge file:

            no knowledge      → leave estado as-is
            < threshold chars → en_progreso
            ≥ threshold chars → cubierto

        Returns the number of nodes whose state actually changed."""
        tree = self.get_tree()
        touched = 0

        def walk(n: dict) -> None:
            nonlocal touched
            if n.get("id") != "r" and not n.get("estado_manual"):
                content = self.get_node_knowledge(n.get("id", ""))
                if content:
                    new_state = (
                        "cubierto"
                        if len(content) >= KNOWLEDGE_CUBIERTO_THRESHOLD
                        else "en_progreso"
                    )
                    if n.get("estado") != new_state:
                        n["estado"] = new_state
                        touched += 1
            for c in n.get("hijos") or []:
                walk(c)

        walk(tree["raiz"])
        if touched:
            self.save_tree(tree)
        return touched

    # ----------------------------------------------------------------- views

    def tree_compact_view(self) -> str:
        """Return an indented text view of the tree, suitable for the LLM."""
        tree = self.get_tree()
        lines: list[str] = []

        def walk(n: dict, depth: int):
            estado = n.get("estado", "pendiente")
            marker = {
                "cubierto": "✔",
                "en_progreso": "…",
                "profundizar": "↻",
                "saltado": "✗",
            }.get(estado, "·")
            indent = "  " * depth
            lines.append(f"{indent}{marker} [{n.get('id', '?')}] "
                         f"{n.get('titulo', '')} ({estado})")
            for child in n.get("hijos", []) or []:
                walk(child, depth + 1)

        walk(tree["raiz"], 0)
        return "\n".join(lines) if lines else "(árbol vacío)"

    def next_suggested_node(self) -> dict | None:
        """Pick the next node to cover: first 'profundizar', else first
        'pendiente' encountered in pre-order traversal."""
        tree = self.get_tree()

        def find_first(estado_match: str) -> dict | None:
            def walk(n: dict) -> dict | None:
                if n.get("estado") == estado_match and n.get("id") != "r":
                    return n
                for c in n.get("hijos", []) or []:
                    f = walk(c)
                    if f:
                        return f
                return None

            return walk(tree["raiz"])

        return find_first("profundizar") or find_first("pendiente")

    # ----------------------------------------------------------------- context

    def build_session_context(self) -> str:
        """Build the context block injected into Elena's followup prompt."""
        parts: list[str] = []

        cfg = self.get_interview_config()
        if cfg.get("intervieweeName"):
            parts.append(f"## Entrevistado\n{cfg['intervieweeName']} "
                         f"(modo: {cfg.get('mode', 'legado')})")

        profile = self.get_profile()
        if profile:
            parts.append(f"## Perfil\n{profile}")

        summary = self.get_general_summary()
        if summary:
            parts.append(f"## Resumen general\n{summary}")

        tree_view = self.tree_compact_view()
        if tree_view:
            parts.append(f"## Árbol de temas\n```\n{tree_view}\n```")

        agenda = self.get_agenda()
        if agenda:
            parts.append(f"## Agenda\n{agenda}")

        pendientes = self.get_pendientes()
        if pendientes:
            parts.append(f"## Pendientes\n{pendientes}")

        last_sessions = self.get_last_sessions(2)
        if last_sessions:
            parts.append("## Últimas sesiones")
            for s in last_sessions:
                parts.append(f"### {s['filename']}\n{s['content']}")

        return "\n\n".join(parts)
