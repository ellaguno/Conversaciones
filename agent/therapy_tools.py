from livekit.agents import llm
from session_manager import SessionManager


def create_therapy_tools(manager: SessionManager) -> list[llm.Tool]:
    """Create function calling tools for Dra. Ana."""

    @llm.function_tool()
    async def consultar_perfil_paciente() -> str:
        """Consulta el perfil del paciente actual. Usa esto para recordar datos básicos del paciente."""
        profile = manager.get_profile()
        return profile or "No hay perfil registrado aún. Esta es la primera sesión."

    @llm.function_tool()
    async def consultar_sesiones_anteriores(cantidad: int = 2) -> str:
        """Consulta las notas de las últimas sesiones. Usa esto para dar continuidad al tratamiento."""
        sessions = manager.get_last_sessions(cantidad)
        if not sessions:
            return "No hay sesiones anteriores registradas."
        result = []
        for s in sessions:
            result.append(f"### {s['filename']}\n{s['content']}")
        return "\n\n".join(result)

    @llm.function_tool()
    async def consultar_tareas_pendientes() -> str:
        """Consulta las tareas que el paciente tiene pendientes de sesiones anteriores."""
        return manager.get_pending_tasks()

    @llm.function_tool()
    async def consultar_plan_terapeutico() -> str:
        """Consulta el plan terapéutico actual del paciente."""
        plan = manager.get_treatment_plan()
        return plan or "No hay plan terapéutico definido aún."

    @llm.function_tool()
    async def consultar_agenda() -> str:
        """Consulta la agenda de sesiones del paciente."""
        agenda = manager.get_agenda()
        return agenda or "No hay agenda definida aún."

    @llm.function_tool()
    async def consultar_temas_recurrentes() -> str:
        """Consulta los temas recurrentes identificados en el tratamiento."""
        themes = manager.get_recurring_themes()
        return themes or "No hay temas recurrentes registrados aún."

    @llm.function_tool()
    async def consultar_progreso() -> str:
        """Consulta el registro de progreso del paciente."""
        progress = manager.get_progress()
        return progress or "No hay registro de progreso aún."

    return [
        consultar_perfil_paciente,
        consultar_sesiones_anteriores,
        consultar_tareas_pendientes,
        consultar_plan_terapeutico,
        consultar_agenda,
        consultar_temas_recurrentes,
        consultar_progreso,
    ]
