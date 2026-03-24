import json
import logging
from livekit.agents import llm

logger = logging.getLogger("comerciante-con-voz")


def create_demo_client_tools(room) -> list[llm.Tool]:
    """Create function calling tools for demo client/prospect agents.

    These tools allow the AI prospect to report its emotional state and
    purchase intent in real-time via LiveKit data messages, so the frontend
    can display a live evaluation panel.
    """

    @llm.function_tool()
    async def actualizar_estado(
        emocion: str,
        intencion_compra: int,
        notas: str,
    ) -> str:
        """Actualiza tu estado emocional y nivel de intención de compra.
        Llama esta herramienta cada 2-3 intercambios con el vendedor.

        Args:
            emocion: Tu emoción actual. Valores: confianza, interés, curiosidad,
                     incredulidad, desconfianza, agresividad, bloqueo, aburrimiento,
                     molestia, entusiasmo
            intencion_compra: Tu nivel de intención de compra de 0 a 100.
                              0 = nunca compraría, 50 = indeciso, 100 = quiero comprar ya
            notas: Breve nota sobre qué te hizo sentir así (1-2 oraciones)
        """
        data = json.dumps({
            "type": "demo_estado",
            "emocion": emocion,
            "intencion": max(0, min(100, intencion_compra)),
            "notas": notas,
        })
        try:
            await room.local_participant.publish_data(
                data.encode("utf-8"), reliable=True
            )
            logger.info(f"Demo estado publicado: {emocion}, intención={intencion_compra}")
        except Exception as e:
            logger.warning(f"Error publicando estado demo: {e}")
        return "Estado actualizado correctamente."

    @llm.function_tool()
    async def calificar_venta(
        resultado: str,
        resumen: str,
        puntaje: int,
    ) -> str:
        """Califica el resultado final de la venta cuando la conversación
        llegue a un cierre natural o cuando el vendedor intente cerrar.

        Args:
            resultado: El resultado de la venta. Valores exactos:
                       'cerro_venta' - El vendedor logró cerrar la venta
                       'abrio_seguimiento' - No compró pero aceptó una segunda cita/seguimiento
                       'perdio_venta' - El vendedor perdió la venta definitivamente
            resumen: Resumen de 2-3 oraciones explicando por qué se llegó a ese resultado,
                     qué hizo bien y qué hizo mal el vendedor.
            puntaje: Calificación del vendedor de 1 a 10 (1=pésimo, 10=excelente)
        """
        data = json.dumps({
            "type": "demo_calificacion",
            "resultado": resultado,
            "resumen": resumen,
            "puntaje": max(1, min(10, puntaje)),
        })
        try:
            await room.local_participant.publish_data(
                data.encode("utf-8"), reliable=True
            )
            logger.info(f"Demo calificación publicada: {resultado}, puntaje={puntaje}")
        except Exception as e:
            logger.warning(f"Error publicando calificación demo: {e}")
        return "Calificación registrada correctamente."

    return [actualizar_estado, calificar_venta]
