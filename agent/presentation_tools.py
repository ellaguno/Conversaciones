"""LiveKit function tools that let a Plática-mode agent control its own slides.

Holds a single mutable PresentationState per session. Tools mutate state, publish
data events to the room (frontend listens for slide_change / timer_state), and
regenerate the agent's instructions so the LLM's next turn sees the new ±N
detail window centered on the current slide.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from livekit.agents import llm

from platica_loader import Platica, build_full_instructions

if TYPE_CHECKING:
    from livekit.agents import Agent

logger = logging.getLogger("comerciante-con-voz")

# Hard floor for advancing past slide 1. Prevents the LLM from calling
# avanzar_diapositiva right after the kickoff greeting. Bypassed by the
# operator's manual override (which doesn't go through this tool).
MIN_TIME_ON_FIRST_SLIDE_SEC = 25.0
# Floor for any subsequent slide advance, so we don't blow through a slide
# in 5 seconds even if the LLM thinks it's done.
MIN_TIME_PER_SLIDE_SEC = 12.0


class PresentationState:
    """Mutable presentation state. One instance per LiveKit session.

    The `agent` field is set lazily after the Agent instance is constructed
    (the tools need to reference state at construction time, but the agent
    itself doesn't exist yet at that moment — circular).
    """

    def __init__(
        self,
        platica: Platica,
        room,
        base_personality_prompt: str,
        state_file: Path,
        window: int = 5,
    ):
        self.platica = platica
        self.room = room
        self.base_personality_prompt = base_personality_prompt
        self.state_file = state_file
        self.window = window
        self.agent: "Agent | None" = None  # back-filled after agent construction
        self.current_slide: int = 1
        self.timer_running: bool = True
        self.in_repaso: bool = False
        self.repaso_origin_slide: int | None = None
        # Track when the current slide was entered. Used to enforce a minimum
        # dwell time so the LLM can't blow through slides too fast.
        self.slide_entered_at: float = time.monotonic()
        # Defensive reset: if a previous session left a stale state file with
        # current_slide=N, overwrite it now with slide=1 so /presentar (which
        # may be polling from a prior tab) snaps back to the start.
        logger.info(
            f"PresentationState init: platica={platica.manifest.id}, "
            f"reseting current_slide=1, writing state file at {state_file}"
        )
        self.write_state_to_disk()

    def build_instructions(self) -> str:
        elapsed = max(0.0, time.monotonic() - self.slide_entered_at)
        return build_full_instructions(
            self.base_personality_prompt,
            self.platica,
            self.current_slide,
            window=self.window,
            elapsed_sec=elapsed,
        )

    async def publish(self, payload: dict) -> None:
        try:
            await self.room.local_participant.publish_data(
                json.dumps(payload).encode("utf-8"), reliable=True
            )
        except Exception as e:
            logger.warning(f"Error publicando evento de presentación: {e}")

    def write_state_to_disk(self) -> None:
        """Snapshot the current presentation state to disk so a polling
        /presentar view (running in another tab/device, no LiveKit token) can
        stay in sync. Best-effort: file write errors don't fail the tool call."""
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "platica_id": self.platica.manifest.id,
                "current_slide": self.current_slide,
                "timer_running": self.timer_running,
                "in_repaso": self.in_repaso,
                "repaso_origin_slide": self.repaso_origin_slide,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self.state_file.write_text(json.dumps(payload), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Error escribiendo estado a disco: {e}")

    async def refresh_instructions(self) -> None:
        """Regenerate instructions and push to the agent so the next LLM turn
        sees the updated ±N detail window. Also persists state to disk for
        non-LiveKit subscribers. Safe to call between turns."""
        self.write_state_to_disk()
        if self.agent is None:
            logger.warning("refresh_instructions: agent aún no asignado, salto")
            return
        try:
            await self.agent.update_instructions(self.build_instructions())
            logger.info(
                f"Instructions refreshed: ventana centrada en slide {self.current_slide}"
            )
        except Exception as e:
            logger.warning(f"Error refrescando instructions: {e}", exc_info=True)


def create_presentation_tools(state: PresentationState) -> list[llm.FunctionTool]:
    """Build the function tools that the agent will invoke during the talk."""

    @llm.function_tool()
    async def avanzar_diapositiva(numero: int, motivo: str = "") -> str:
        """Cambia a una diapositiva específica como parte del flujo lineal de la plática.
        Úsalo cuando termines de explicar el slide actual y debas pasar al siguiente.

        Args:
            numero: Número de slide al que cambiar (1-indexed).
            motivo: Nota interna corta para tu propio registro (no se dice en voz alta).
        """
        if numero < 1 or numero > state.platica.manifest.slide_count:
            return f"Error: slide {numero} fuera de rango (1-{state.platica.manifest.slide_count})."
        # Enforce minimum dwell time. The LLM tends to advance too eagerly
        # right after greeting; this is a hard floor that's invisible to the
        # prompt but caught at the tool boundary.
        elapsed = time.monotonic() - state.slide_entered_at
        floor = MIN_TIME_ON_FIRST_SLIDE_SEC if state.current_slide == 1 else MIN_TIME_PER_SLIDE_SEC
        if elapsed < floor:
            remaining = floor - elapsed
            logger.info(
                f"avanzar_diapositiva rechazado: solo {elapsed:.1f}s en slide "
                f"{state.current_slide} (mínimo {floor}s, faltan {remaining:.1f}s)"
            )
            return (
                f"Aún no puedes avanzar — solo llevas {elapsed:.0f} segundos en este slide. "
                f"Sigue narrando este slide al menos {remaining:.0f} segundos más antes de avanzar."
            )
        previous = state.current_slide
        # Avanzar implícitamente cierra cualquier repaso en curso.
        was_in_repaso = state.in_repaso
        state.in_repaso = False
        state.repaso_origin_slide = None
        state.current_slide = numero
        state.slide_entered_at = time.monotonic()
        await state.publish({
            "type": "slide_change",
            "slide": numero,
            "previous": previous,
            "source": "agent",
            "motivo": motivo,
            "exited_repaso": was_in_repaso,
        })
        await state.refresh_instructions()
        # Tool result is fed back to the LLM. Make it instruct continuation so
        # the model doesn't fall silent waiting for input after the slide change.
        return (
            f"Slide cambiado a {numero}. AHORA mismo, en este mismo turno, "
            f"continúa narrando el contenido del slide {numero} con un puente "
            f"verbal natural ('y eso nos lleva a…', 'ahora veamos…'). NO te "
            f"detengas, NO esperes input, NO pidas confirmación."
        )

    @llm.function_tool()
    async def repasar_punto(slide_a_repasar: int, motivo: str) -> str:
        """Regresa temporalmente a una diapositiva anterior para repasar un punto.
        Úsalo cuando alguien pida que expliques de nuevo algo que ya se vio.
        Después de explicar brevemente, llama `volver_a_flujo()` para regresar a
        donde estabas. Pausa el timer mientras dura el repaso.

        Args:
            slide_a_repasar: Número del slide a repasar (debe ser menor al slide actual).
            motivo: Qué te pidieron repasar (registro interno).
        """
        if state.in_repaso:
            return (
                "Ya estás en modo repaso; termina el repaso actual con volver_a_flujo() "
                "antes de iniciar otro."
            )
        if slide_a_repasar < 1 or slide_a_repasar > state.platica.manifest.slide_count:
            return f"Error: slide {slide_a_repasar} fuera de rango."
        if slide_a_repasar >= state.current_slide:
            return (
                f"Error: repasar_punto solo es para slides anteriores. Estás en "
                f"slide {state.current_slide}; usa avanzar_diapositiva si necesitas "
                f"saltar adelante."
            )
        state.in_repaso = True
        state.repaso_origin_slide = state.current_slide
        previous = state.current_slide
        state.current_slide = slide_a_repasar
        state.slide_entered_at = time.monotonic()
        state.timer_running = False
        await state.publish({
            "type": "slide_change",
            "slide": slide_a_repasar,
            "previous": previous,
            "source": "agent_repaso",
            "motivo": motivo,
            "repaso_origin": previous,
        })
        await state.publish({"type": "timer_state", "running": False, "reason": "repaso"})
        await state.refresh_instructions()
        return (
            f"Repasando slide {slide_a_repasar}. Cuando termines de explicar, "
            f"llama volver_a_flujo() para regresar a slide {previous}."
        )

    @llm.function_tool()
    async def volver_a_flujo() -> str:
        """Regresa al slide donde estabas antes de iniciar un repaso, y reanuda el avance automático."""
        if not state.in_repaso or state.repaso_origin_slide is None:
            return "Error: no estás en modo repaso, no hay a dónde volver."
        target = state.repaso_origin_slide
        previous = state.current_slide
        state.in_repaso = False
        state.repaso_origin_slide = None
        state.current_slide = target
        state.slide_entered_at = time.monotonic()
        state.timer_running = True
        await state.publish({
            "type": "slide_change",
            "slide": target,
            "previous": previous,
            "source": "agent_volver",
        })
        await state.publish({"type": "timer_state", "running": True, "reason": "fin_repaso"})
        await state.refresh_instructions()
        return f"De vuelta en slide {target}. Continúa la narración desde donde te quedaste."

    @llm.function_tool()
    async def pausar_avance_automatico(motivo: str = "qa") -> str:
        """Pausa el avance automático del timer. El slide actual no cambia, pero
        el timer del frontend no lo va a avanzar solo. Úsalo cuando una pregunta
        o explicación tomará más de una frase.

        Args:
            motivo: Razón corta (ej "qa", "explicación larga"). Solo registro.
        """
        state.timer_running = False
        state.write_state_to_disk()
        await state.publish({"type": "timer_state", "running": False, "reason": motivo})
        return "Avance automático pausado."

    @llm.function_tool()
    async def reanudar_avance_automatico() -> str:
        """Reanuda el avance automático del timer."""
        state.timer_running = True
        state.write_state_to_disk()
        await state.publish({"type": "timer_state", "running": True})
        return "Avance automático reanudado."

    return [
        avanzar_diapositiva,
        repasar_punto,
        volver_a_flujo,
        pausar_avance_automatico,
        reanudar_avance_automatico,
    ]
