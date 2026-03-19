import os
import re
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# Load env BEFORE local imports that read env vars at module level (e.g. note_generator)
load_dotenv(dotenv_path=".env.local")

from livekit import api
from livekit.agents import Agent, AgentSession, RoomInputOptions, JobContext, AgentServer, cli
from livekit.agents.llm import ChatContext, ChatMessage, ImageContent
from livekit.plugins import deepgram, openai, cartesia
from personalities import (
    PERSONALITIES, DEFAULT_PERSONALITY, VISION_PERSONALITIES,
    DRA_ANA_INTAKE_PROMPT, DRA_ANA_FOLLOWUP_PROMPT,
    THERAPY_METHODS, DEFAULT_THERAPY_METHOD, DRA_ANA_COUPLE_ADDON,
    get_voice_for_name,
)
from session_manager import SessionManager
from conversation_log import ConversationLog
from therapy_tools import create_therapy_tools
from note_generator import generate_session_notes, generate_intake_notes

logger = logging.getLogger("comerciante-con-voz")
logger.setLevel(logging.INFO)

DATA_DIR = Path(__file__).parent.parent / "data"

# Cost per 1M tokens (Gemini 2.0 Flash via OpenRouter)
LLM_COST_PER_1M_INPUT = 0.10
LLM_COST_PER_1M_OUTPUT = 0.40
MAX_TRANSCRIPT_TURNS = 500


def _get_metrics_file(user_id: str) -> Path:
    safe_user = re.sub(r'[^a-zA-Z0-9_-]', '', user_id) or "default"
    metrics_dir = DATA_DIR / safe_user
    metrics_dir.mkdir(parents=True, exist_ok=True)
    return metrics_dir / "metrics.json"


def _load_metrics(user_id: str) -> dict:
    mf = _get_metrics_file(user_id)
    if mf.exists():
        return json.loads(mf.read_text())
    return {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0,
            "total_cost_usd": 0.0, "llm_calls": 0, "tts_characters": 0,
            "stt_audio_seconds": 0.0}


def _save_metrics(user_id: str, m: dict):
    mf = _get_metrics_file(user_id)
    mf.write_text(json.dumps(m, indent=2))


class ComercianteAgent(Agent):
    def __init__(self, personality_key: str, instructions: str, tools=None, has_vision: bool = False) -> None:
        personality = PERSONALITIES.get(personality_key, PERSONALITIES[DEFAULT_PERSONALITY])
        logger.info(f"Cargando personalidad: {personality['name']} (vision={has_vision})")
        self._has_vision = has_vision
        super().__init__(
            instructions=instructions,
            tools=tools or [],
        )

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """Inject the latest screen frame into the chat context before LLM processes it."""
        if not self._has_vision:
            return
        try:
            video_frame = self.session.input.video
            if video_frame is not None:
                turn_ctx.add_message(
                    role="user",
                    content=[ImageContent(image=video_frame)],
                )
                logger.info("Frame de pantalla inyectado al contexto del LLM")
            else:
                logger.info("Visión activa pero no hay frame de video disponible (¿pantalla no compartida?)")
        except Exception as e:
            logger.warning(f"Error capturando frame de video: {e}")


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    room = ctx.room

    # Parse room name: room_{personality}_{patient_id}_{random} or room_{personality}_{random}
    personality_key = DEFAULT_PERSONALITY
    patient_id = None
    custom_voice_id = None
    custom_temperature = None
    room_name = room.name or ""
    logger.info(f"Room name: '{room_name}'")

    if room_name.startswith("room_"):
        parts = room_name.split("_")
        if len(parts) >= 3:
            # Check for custom_* personalities (room_custom_slug_random)
            if parts[1] == "custom" and len(parts) >= 4:
                # Reconstruct custom key: custom_{slug} (everything between "custom" and last part which is random)
                personality_key = "_".join(parts[1:-1])
                logger.info(f"Custom personality key: '{personality_key}'")
            else:
                # Try progressively longer keys: room_{a}_{b}_{c}_{random}
                # Check "a_b_c", then "a_b", then "a" against known personalities
                found = False
                for i in range(len(parts) - 1, 1, -1):
                    candidate = "_".join(parts[1:i])
                    if candidate in PERSONALITIES:
                        personality_key = candidate
                        found = True
                        break
                if not found and parts[1] not in PERSONALITIES:
                    logger.warning(f"Personalidad desconocida solicitada: {parts[1]}")
        if len(parts) >= 4 and parts[1] == "psicologo":
            # room_psicologo_{patient_id}_{random}
            raw_id = "_".join(parts[2:-1])  # handles patient_ids with underscores
            patient_id = re.sub(r'[^a-zA-Z0-9_-]', '', raw_id)
            logger.info(f"Patient ID: '{patient_id}'")

    # Parse room metadata for custom voice/temperature/model/therapy config/userId
    # room.metadata may be empty due to timing — fetch via API as fallback
    room_metadata = room.metadata or ""
    if not room_metadata and room_name:
        try:
            rooms_list = await ctx.api.room.list_rooms(api.ListRoomsRequest(names=[room_name]))
            for r in rooms_list.rooms:
                if r.name == room_name and r.metadata:
                    room_metadata = r.metadata
                    break
        except Exception as e:
            logger.warning(f"Error fetching room metadata via API: {e}")
    logger.info(f"Raw room metadata: '{room_metadata}'")
    custom_model = None
    therapy_method = None
    couple_therapy = False
    user_id = "default"
    try:
        meta = json.loads(room_metadata) if room_metadata.startswith("{") else {}
        custom_voice_id = meta.get("voiceId")
        custom_temperature = meta.get("temperature")
        custom_model = meta.get("model")
        therapy_method = meta.get("therapyMethod")
        couple_therapy = bool(meta.get("coupleTherapy", False))
        user_id = meta.get("userId", "default")
    except (json.JSONDecodeError, TypeError):
        pass

    # Sanitize user_id
    user_id = re.sub(r'[^a-zA-Z0-9_-]', '', user_id) or "default"
    logger.info(f"User ID: '{user_id}'")

    if personality_key in PERSONALITIES:
        personality = PERSONALITIES[personality_key]
    elif personality_key.startswith("custom_"):
        # Dynamic custom personality — derive name from key
        char_name = personality_key.replace("custom_", "").replace("_", " ").title()
        voice_id = get_voice_for_name(char_name)
        personality = {
            "name": char_name,
            "system_prompt": (
                f"Eres {char_name}. Responde como lo haría esta persona o personaje, "
                f"con su personalidad, conocimientos, estilo y perspectiva característicos. "
                f"Mantente en personaje en todo momento. Si eres un personaje histórico, "
                f"habla desde tu época pero puedes opinar sobre temas modernos desde tu perspectiva. "
                f"Si eres un personaje de ficción, mantén tu personalidad tal como se conoce. "
                f"Sé auténtico, interesante y conversacional. "
                f"Siempre respondes en español."
            ),
            "voice_id": voice_id,
            "description": f"Conversación con {char_name}",
            "has_sessions": True,
        }
    else:
        personality = PERSONALITIES[DEFAULT_PERSONALITY]
    logger.info(f"Iniciando agente: {personality['name']} (key={personality_key})")

    # Build instructions and tools
    tools = []
    instructions = personality["system_prompt"]
    manager = None

    if personality.get("has_therapy_tools"):
        # Dra. Ana with full session management + therapy tools
        manager = SessionManager(patient_id=patient_id or "default", user_id=user_id)
        tools = create_therapy_tools(manager)

        if manager.is_first_session():
            # First session: use therapy method from metadata (selected by user)
            method_key = therapy_method if therapy_method in THERAPY_METHODS else DEFAULT_THERAPY_METHOD
            method_info = THERAPY_METHODS[method_key]
            instructions += f"\n\n--- ENFOQUE TERAPÉUTICO ---\n{method_info['description']}"
            if couple_therapy:
                instructions += DRA_ANA_COUPLE_ADDON
            instructions += "\n\n" + DRA_ANA_INTAKE_PROMPT
            # Store therapy config so agent knows to save it in profile
            manager.save_therapy_config(method_key, couple_therapy)
            logger.info(f"Primera sesión (intake) - Método: {method_info['name']}, Pareja: {couple_therapy}")
        else:
            # Follow-up: read therapy method from stored config
            stored_config = manager.get_therapy_config()
            method_key = stored_config.get("method", DEFAULT_THERAPY_METHOD)
            is_couple = stored_config.get("couple", False)
            if method_key in THERAPY_METHODS:
                instructions += f"\n\n--- ENFOQUE TERAPÉUTICO ---\n{THERAPY_METHODS[method_key]['description']}"
            if is_couple:
                instructions += DRA_ANA_COUPLE_ADDON
            context = manager.build_session_context()
            instructions += "\n\n" + DRA_ANA_FOLLOWUP_PROMPT
            instructions += "\n\n--- CONTEXTO DEL PACIENTE ---\n" + context
            logger.info(f"Sesión de seguimiento, sesión #{manager.get_session_number()} - Método: {method_key}")

    # Conversation log for all personalities (user-scoped)
    conv_log = ConversationLog(personality_key, personality["name"], user_id=user_id)

    # Use custom voice/temperature/model if provided, otherwise use personality defaults
    voice_id = custom_voice_id or personality["voice_id"]
    temperature = custom_temperature if custom_temperature is not None else 0.7
    llm_model = custom_model or "google/gemini-2.0-flash-001"
    # Language settings: personality can override STT/TTS language (for language teachers)
    stt_language = personality.get("stt_language", "es")
    tts_language = personality.get("tts_language", "es")
    logger.info(f"Voice: {voice_id}, Temperature: {temperature}, Model: {llm_model}, STT: {stt_language}, TTS: {tts_language}")

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language=stt_language,
        ),
        llm=openai.LLM(
            model=llm_model,
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=temperature,
        ),
        tts=cartesia.TTS(
            model="sonic-3",
            language=tts_language,
            voice=voice_id,
            api_key=os.getenv("CARTESIA_API_KEY"),
        ),
    )

    # Metrics collection for all personalities (user-scoped)
    @session.on("metrics_collected")
    def on_metrics(event):
        m = event.metrics
        try:
            data = _load_metrics(user_id)
            if hasattr(m, "total_tokens"):  # LLM metrics
                data["total_tokens"] += m.total_tokens
                data["prompt_tokens"] += m.prompt_tokens
                data["completion_tokens"] += m.completion_tokens
                cost = (m.prompt_tokens * LLM_COST_PER_1M_INPUT / 1_000_000 +
                        m.completion_tokens * LLM_COST_PER_1M_OUTPUT / 1_000_000)
                data["total_cost_usd"] += cost
                data["llm_calls"] += 1
            elif hasattr(m, "characters_count"):  # TTS metrics
                data["tts_characters"] += m.characters_count
            elif hasattr(m, "audio_duration"):  # STT metrics
                data["stt_audio_seconds"] += m.audio_duration
            _save_metrics(user_id, data)
        except Exception as e:
            logger.debug(f"Error guardando métricas: {e}")

    # Transcript capture for all personalities
    transcript = []
    start_time = datetime.now()

    @session.on("conversation_item_added")
    def on_conversation_item(event):
        item = event.item
        if hasattr(item, "role") and hasattr(item, "text_content"):
            text = item.text_content
            if text:
                if len(transcript) >= MAX_TRANSCRIPT_TURNS:
                    logger.warning("Transcripción alcanzó límite máximo, ignorando turnos adicionales")
                    return
                transcript.append({"role": item.role, "text": text})
                logger.info(f"Transcripción [{item.role}]: {len(text)} caracteres")

    notes_done = asyncio.Event()
    notes_done.set()  # Default: no notes needed

    @session.on("close")
    def on_close(event):
        # Fallback: extract from chat context if event-based capture missed messages
        if len(transcript) < 2:
            logger.info("Extrayendo transcripción desde chat_ctx como fallback...")
            try:
                chat_ctx = getattr(session, 'chat_ctx', None) or getattr(session, '_chat_ctx', None)
                if chat_ctx and hasattr(chat_ctx, 'items'):
                    for msg in chat_ctx.items:
                        if hasattr(msg, "role") and msg.role in ("user", "assistant"):
                            text = msg.text_content if hasattr(msg, "text_content") else None
                            if text:
                                transcript.append({"role": msg.role, "text": text})
            except Exception as e:
                logger.warning(f"No se pudo extraer chat_ctx: {e}")

        if len(transcript) < 2:
            logger.info("Sesión muy corta, no se guardan notas")
            return

        logger.info(f"Sesión terminada. {len(transcript)} turnos capturados.")

        # Save conversation log for all personalities
        conv_log.save(transcript, start_time)
        logger.info(f"Conversación guardada: {conv_log.get_log_dir()}")

        # Generate therapy notes only for Dra. Ana
        if manager is not None:
            notes_done.clear()
            asyncio.create_task(_generate_notes_and_signal(
                notes_done, manager, transcript, start_time
            ))

    has_vision = personality.get("has_vision", False) or personality_key in VISION_PERSONALITIES
    agent = ComercianteAgent(personality_key, instructions, tools, has_vision=has_vision)

    start_kwargs = {"agent": agent, "room": ctx.room}
    if has_vision:
        start_kwargs["room_input_options"] = RoomInputOptions(video_enabled=True)
        logger.info("Visión habilitada: el agente puede ver la pantalla del usuario")

    await session.start(**start_kwargs)

    # Keep process alive until notes finish generating
    await notes_done.wait()


async def _generate_notes_and_signal(
    done_event: asyncio.Event, manager: SessionManager, transcript: list, start_time: datetime
):
    """Wrapper that signals completion so the process can exit."""
    try:
        await _generate_notes(manager, transcript, start_time)
    finally:
        done_event.set()


async def _generate_notes(manager: SessionManager, transcript: list, start_time: datetime):
    """Generate notes after session ends."""
    status_file = manager.patient_dir / ".generating"
    try:
        status_file.write_text(datetime.now().isoformat(), encoding="utf-8")
        logger.info("Iniciando generación de notas...")
        session_num = manager.get_session_number()
        if manager.is_first_session():
            await generate_intake_notes(manager, transcript, start_time)
        else:
            await generate_session_notes(manager, transcript, session_num, start_time)
        logger.info("Notas generadas exitosamente")
    except Exception as e:
        logger.error(f"Error generando notas: {e}", exc_info=True)
    finally:
        status_file.unlink(missing_ok=True)


if __name__ == "__main__":
    cli.run_app(server)
