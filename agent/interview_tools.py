"""Function-calling tools exposed to Elena during an interview session.

These mirror therapy_tools.py — read-only consult tools plus a few mutators
that let Elena take live notes on the topic tree.
"""
from __future__ import annotations

from livekit.agents import llm

from interview_manager import InterviewManager


def create_interview_tools(manager: InterviewManager,
                           current_session_num: int) -> list[llm.Tool]:
    """Build the toolset for the Elena agent.

    `current_session_num` is captured so mutator tools can stamp the node
    'sesiones' list with the correct value without the LLM needing to track it.
    """

    @llm.function_tool()
    async def consultar_perfil_entrevistado() -> str:
        """Consulta el perfil del entrevistado: quién es, por qué se entrevista, contexto general."""
        profile = manager.get_profile()
        if profile:
            return profile
        return "Aún no hay perfil registrado. Esta es la primera sesión de intake."

    @llm.function_tool()
    async def consultar_arbol_temas() -> str:
        """Consulta el árbol jerárquico de temas con su estado actual. Útil para saber qué se ha cubierto y qué falta."""
        return manager.tree_compact_view()

    @llm.function_tool()
    async def consultar_nodo(id: str) -> str:
        """Consulta el detalle de un nodo del árbol por su id (ej. '1.2'): título, estado, preguntas clave, resumen acumulado."""
        node = manager.find_node(id)
        if node is None:
            return f"No existe un nodo con id '{id}'."
        parts = [
            f"# {node.get('titulo', '')} [{id}]",
            f"Estado: {node.get('estado', 'pendiente')}",
        ]
        preguntas = node.get("preguntas_clave") or []
        if preguntas:
            parts.append("Preguntas clave:")
            for p in preguntas:
                parts.append(f"- {p}")
        if node.get("razon_profundizar"):
            parts.append(f"\nMotivo para profundizar: {node['razon_profundizar']}")
        if node.get("resumen"):
            parts.append(f"\nResumen acumulado:\n{node['resumen']}")
        sub = node.get("hijos") or []
        if sub:
            parts.append("\nSubtemas:")
            for s in sub:
                parts.append(f"- [{s.get('id')}] {s.get('titulo')} ({s.get('estado')})")
        # Append the distilled knowledge file if present
        knowledge = manager.get_node_knowledge(id)
        if knowledge:
            parts.append(f"\n## Conocimiento ya destilado\n{knowledge}")
        return "\n".join(parts)

    @llm.function_tool()
    async def siguiente_nodo_sugerido() -> str:
        """Sugiere el siguiente nodo a cubrir según el árbol y la agenda. Prioriza nodos marcados para 'profundizar', luego 'pendiente'."""
        node = manager.next_suggested_node()
        if node is None:
            return "Todos los nodos están cubiertos o saltados. Propón al entrevistado profundizar en algo o cerrar la sesión."
        titulo = node.get("titulo", "")
        nid = node.get("id", "")
        estado = node.get("estado", "")
        return f"Siguiente sugerido: [{nid}] '{titulo}' ({estado})"

    @llm.function_tool()
    async def consultar_sesion_anterior(n: int = 1) -> str:
        """Consulta las notas de las últimas n sesiones (default 1). Útil para dar continuidad."""
        sessions = manager.get_last_sessions(max(1, min(int(n), 5)))
        if not sessions:
            return "No hay sesiones anteriores."
        return "\n\n".join(f"### {s['filename']}\n{s['content']}" for s in sessions)

    @llm.function_tool()
    async def consultar_agenda() -> str:
        """Consulta la agenda de sesiones futuras y los temas planeados para hoy."""
        return manager.get_agenda() or "No hay agenda definida aún."

    @llm.function_tool()
    async def consultar_pendientes() -> str:
        """Consulta los temas o ramas pendientes por cubrir o profundizar."""
        return manager.get_pendientes() or "No hay pendientes registrados aún."

    # ----- mutators (Elena takes live notes) ----------------------------------

    @llm.function_tool()
    async def marcar_nodo_cubierto(id: str) -> str:
        """Marca un nodo como cubierto cuando sientas que ya extrajiste lo importante de ese tema."""
        node = manager.find_node(id)
        if node is None:
            return f"No existe el nodo '{id}'."
        manager.update_node(id, estado="cubierto")
        manager.mark_session_touched(id, current_session_num)
        return f"Nodo '{id}' marcado como cubierto."

    @llm.function_tool()
    async def marcar_nodo_en_progreso(id: str) -> str:
        """Marca un nodo como en_progreso cuando empieces a tocarlo en la conversación."""
        node = manager.find_node(id)
        if node is None:
            return f"No existe el nodo '{id}'."
        manager.update_node(id, estado="en_progreso")
        manager.mark_session_touched(id, current_session_num)
        return f"Nodo '{id}' marcado como en progreso."

    @llm.function_tool()
    async def marcar_para_profundizar(id: str, motivo: str) -> str:
        """Marca un nodo para profundizar más adelante. 'motivo' explica brevemente por qué (ej. 'mencionó X sin desarrollar')."""
        node = manager.find_node(id)
        if node is None:
            return f"No existe el nodo '{id}'."
        manager.update_node(id, estado="profundizar", razon_profundizar=motivo)
        return f"Nodo '{id}' marcado para profundizar. Motivo: {motivo}"

    @llm.function_tool()
    async def agregar_subtema(id_padre: str, titulo: str, motivo: str = "") -> str:
        """Agrega un subtema nuevo bajo un nodo padre cuando surge algo no anticipado en la conversación."""
        new_id = manager.add_child(id_padre, titulo, motivo)
        if new_id is None:
            return f"No existe el nodo padre '{id_padre}'."
        return f"Subtema agregado: [{new_id}] '{titulo}' bajo '{id_padre}'."

    return [
        consultar_perfil_entrevistado,
        consultar_arbol_temas,
        consultar_nodo,
        siguiente_nodo_sugerido,
        consultar_sesion_anterior,
        consultar_agenda,
        consultar_pendientes,
        marcar_nodo_cubierto,
        marcar_nodo_en_progreso,
        marcar_para_profundizar,
        agregar_subtema,
    ]
