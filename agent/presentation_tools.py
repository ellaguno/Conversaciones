"""Plática-mode slide control. Simple state machine — single source of truth.

Design (read this before touching):

  El LLM solo conoce UN tool: avanzar_diapositiva(). Lo llama al terminar el
  slide actual. NO cambia el slide directamente — solo "pide" un avance vía
  state.pending_target.

  El cliente (botones ▶/◀, hand-raise) publican mensajes por data channel que
  el agent.py traduce a state.pending_target / state.pending_hand_at.

  Un solo loop "conductor" en agent.py vigila state y, cuando el agente está
  IDLE (no hablando, no pensando), commit-ea el cambio de slide. Esto asegura
  que la transición visual NUNCA precede al audio: el slide cambia justo cuando
  el LLM dejó de hablar, y entonces se dispara un nuevo turn que narra el nuevo
  slide desde cero.

  Q&A: si hay mano levantada en el slide actual + audience_mode='silent', el
  conductor abre Q&A ANTES de commit-ear el avance. Durante Q&A el mic se
  prende (cliente reacciona a qa_window_start), el oyente pregunta, el agente
  responde, y tras 3s de silencio el conductor cierra Q&A y avanza al target.

Cosas que ESTE archivo NO hace (vive en agent.py):
- Detectar idle / commit transitions (loop conductor).
- Watchdog "continúa narrando" cuando el LLM se calla mid-slide.
- Pacing nudge para refrescar instructions con time hints.
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

# Dwell mínimo en cada slide ANTES de que el LLM pueda avanzar. Sin esto, con
# modelos chicos el LLM tiende a llamar avanzar_diapositiva tras un saludo
# corto, antes de cubrir el contenido. Lo del slide 1 es más largo porque
# normalmente incluye el saludo + introducción.
MIN_DWELL_FIRST_SLIDE_SEC = 25.0
MIN_DWELL_PER_SLIDE_SEC = 12.0

if TYPE_CHECKING:
    import asyncio

    from livekit.agents import Agent, AgentSession

logger = logging.getLogger("comerciante-con-voz")


class PresentationState:
    """Mutable plática state. One instance per LiveKit session.

    Fields que mutate durante la sesión:
        current_slide: int actualmente visible.
        slide_entered_at: monotonic time del último _do_transition.
        pending_target: si != None, el conductor quiere mover a ese slide cuando
            el agente esté idle.
        pending_hand_at: si == current_slide, el conductor abre Q&A antes de
            commit-ear el siguiente avance.
        qa_active: True mientras el Q&A está en curso (mic prendido cliente).
        final_qa_emitted: latch para emitir final_qa_start una sola vez.

    Campos que se persisten al state file (back-compat con la UI poll):
        timer_running, in_repaso, repaso_origin_slide. El nuevo diseño no usa
        in_repaso/repaso (botón ◀ los reemplaza), pero los dejamos en False/None
        para que el state file siga válido.
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
        # Back-filled después de crear el Agent y arrancar la session.
        self.agent: "Agent | None" = None
        self.session: "AgentSession | None" = None

        # Estado de avance
        self.current_slide: int = 1
        self.slide_entered_at: float = time.monotonic()
        self.pending_target: int | None = None
        self.pending_hand_at: int | None = None
        self.qa_active: bool = False
        self.final_qa_emitted: bool = False

        # Campos del state file (no se usan en lógica actual, pero la UI los lee).
        self.timer_running: bool = True
        self.in_repaso: bool = False
        self.repaso_origin_slide: int | None = None

        # Tasks de background (conductor, watchdog, heartbeat). agent.py las
        # asigna después de crear la PresentationState; el shutdown handler las
        # cancela leyéndolas por nombre.
        self._conductor_task: "asyncio.Task | None" = None
        self._watchdog_task: "asyncio.Task | None" = None
        self._pacing_task: "asyncio.Task | None" = None
        self._heartbeat_task: "asyncio.Task | None" = None

        self.audience_mode: str = platica.manifest.audience_mode

        logger.info(
            f"PresentationState init: platica={platica.manifest.id}, "
            f"current_slide=1, audience_mode={self.audience_mode}, "
            f"state_file={state_file}"
        )
        self.write_state_to_disk()

    # ─── Helpers de slides ──────────────────────────────────────────────

    def next_visible_after(self, slide: int) -> int | None:
        """Próximo slide no-oculto después de `slide`, o None si no hay."""
        for b in self.platica.guion:
            if b.slide > slide and not b.hidden:
                return b.slide
        return None

    def prev_visible_before(self, slide: int) -> int | None:
        """Slide visible inmediatamente anterior, o None si no hay."""
        prev = None
        for b in self.platica.guion:
            if b.slide < slide and not b.hidden:
                prev = b.slide
        return prev

    def is_last_slide(self) -> bool:
        return self.next_visible_after(self.current_slide) is None

    def block_for(self, slide: int):
        for b in self.platica.guion:
            if b.slide == slide:
                return b
        return None

    # ─── I/O de estado ──────────────────────────────────────────────────

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
        """Envía un evento JSON al cliente vía data channel (mejor-esfuerzo)."""
        try:
            await self.room.local_participant.publish_data(
                json.dumps(payload).encode("utf-8"), reliable=True
            )
        except Exception as e:
            logger.warning(f"publish fallo: {e}")

    def write_state_to_disk(self) -> None:
        """Snapshot del slide actual al disco — la vista mode=poll lo lee."""
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
            logger.warning(f"write_state_to_disk fallo: {e}")

    async def refresh_instructions(self) -> None:
        """Update del system prompt del LLM con el detalle del slide actual."""
        self.write_state_to_disk()
        if self.agent is None:
            return
        try:
            await self.agent.update_instructions(self.build_instructions())
        except Exception as e:
            logger.warning(f"refresh_instructions fallo: {e}")

    # ─── Transición de slide ────────────────────────────────────────────
    # SOLO el conductor (agent.py) llama esto. NUNCA llamarlo desde el LLM
    # ni desde el data handler — esos solo setean pending_target.

    async def do_transition(self, target: int) -> None:
        """Cambia el slide visible, refresca instructions, y dispara un nuevo
        turn del LLM para que narre el contenido nuevo desde cero."""
        if target < 1 or target > self.platica.manifest.slide_count:
            logger.warning(f"do_transition: target {target} fuera de rango")
            return
        previous = self.current_slide
        self.current_slide = target
        self.slide_entered_at = time.monotonic()
        self.pending_target = None
        self.pending_hand_at = None  # nuevo slide, mano se borra
        self.final_qa_emitted = False  # reset del latch
        logger.info(f"do_transition: slide {previous} → {target}")
        await self.publish(
            {
                "type": "slide_change",
                "slide": target,
                "previous": previous,
                "source": "conductor",
            }
        )
        await self.refresh_instructions()
        # Kick off LLM para que narre el nuevo slide. NO mencionar lo que viene
        # (evita "ahora veremos X" antes de cambiar al slide siguiente).
        if self.session is not None:
            try:
                self.session.generate_reply(
                    instructions=(
                        "Narra el contenido del slide actual desde el inicio. "
                        "No menciones lo que viene después. Cuando termines de "
                        "cubrir el contenido, llama avanzar_diapositiva."
                    )
                )
            except Exception as e:
                logger.warning(f"do_transition generate_reply fallo: {e}")


def create_presentation_tools(state: PresentationState) -> list[llm.FunctionTool]:
    """Tools que ve el LLM. UNO solo: avanzar_diapositiva (sin parámetros).

    El cambio real lo hace el conductor en agent.py cuando el LLM se va a idle —
    así garantizamos que el slide nunca se adelanta al audio.
    """

    @llm.function_tool()
    async def avanzar_diapositiva(motivo: str = "") -> str:
        """Llama esto SOLAMENTE cuando hayas terminado de narrar el contenido
        del slide actual y estés listo para pasar al siguiente. El sistema
        cambiará el slide automáticamente cuando termines de hablar.

        Args:
            motivo: nota interna corta para tu propio registro (no se dice).
        """
        next_vis = state.next_visible_after(state.current_slide)
        if next_vis is None:
            return (
                "Ya estás en el último slide visible. Despídete brevemente y "
                "termina; no llames esta función otra vez."
            )
        if state.pending_target is not None:
            # Ya pediste cambiar y aún no committeamos; ignora la segunda llamada.
            return (
                f"Ya pediste cambiar al slide {state.pending_target}. Termina "
                "tu frase actual y el sistema cambia."
            )
        # Dwell mínimo: rechaza llamadas prematuras. Sin esto el LLM tiende a
        # avanzar tras un saludo corto y la transición se programa antes de
        # que haya cubierto el contenido del slide.
        elapsed = time.monotonic() - state.slide_entered_at
        floor = (
            MIN_DWELL_FIRST_SLIDE_SEC
            if state.current_slide == 1
            else MIN_DWELL_PER_SLIDE_SEC
        )
        if elapsed < floor:
            remaining = int(floor - elapsed) + 1
            logger.info(
                f"avanzar_diapositiva rechazado: solo {int(elapsed)}s en slide "
                f"{state.current_slide} (mínimo {int(floor)}s)"
            )
            return (
                f"Aún llevas solo {int(elapsed)} segundos en este slide; el "
                f"contenido necesita cubrirse con calma. Sigue narrando al "
                f"menos {remaining} segundos más antes de avanzar."
            )
        state.pending_target = next_vis
        logger.info(
            f"avanzar_diapositiva: pending {state.current_slide} → {next_vis} "
            f"(motivo: {motivo or 'n/a'})"
        )
        return (
            "OK. El sistema cambiará el slide automáticamente cuando termines "
            "tu frase actual. NO sigas hablando del slide actual ni anuncies "
            "lo que viene; deja que el sistema haga la transición."
        )

    return [avanzar_diapositiva]
