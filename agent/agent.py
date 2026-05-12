import asyncio
import json
import logging
import os
import re
import time
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
from demo_tools import create_demo_client_tools
from session_manager import SessionManager
from conversation_log import ConversationLog
from therapy_tools import create_therapy_tools
from note_generator import generate_session_notes, generate_intake_notes
from summary_generator import generate_summary, read_summary

logger = logging.getLogger("comerciante-con-voz")
logger.setLevel(logging.INFO)

DATA_DIR = Path(__file__).parent.parent / "data"

# Cost per 1M tokens (Gemini 2.0 Flash via OpenRouter)
LLM_COST_PER_1M_INPUT = 0.10
LLM_COST_PER_1M_OUTPUT = 0.40
# Cartesia TTS: $0.15 per 1K characters (pay-as-you-go)
TTS_COST_PER_1K_CHARS = 0.15
# Deepgram STT: $0.0043 per minute (nova-3 pay-as-you-go)
STT_COST_PER_MINUTE = 0.0043
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
            "total_cost_usd": 0.0, "llm_cost_usd": 0.0, "tts_cost_usd": 0.0, "stt_cost_usd": 0.0,
            "llm_calls": 0, "tts_characters": 0, "stt_audio_seconds": 0.0}


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


# shutdown_process_timeout=30 da tiempo a generate_summary (Gemini puede tardar
# 5-15s con transcript largo) sin tener que ramificar el worker. Para pláticas
# el resumen se omite, pero esto cubre las sesiones normales (Tato, Dra. Ana,
# etc.) donde la nota/resumen sí se reinyecta en sesiones futuras.
server = AgentServer(shutdown_process_timeout=30.0)


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    room = ctx.room

    # Parse room name: room_{personality}_{patient_id}_{random} or room_{personality}_{random}
    personality_key = DEFAULT_PERSONALITY
    patient_id = None
    custom_voice_id = None
    custom_temperature = None
    custom_speed = None
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
    demo_profile = ""
    platica_id = None
    try:
        meta = json.loads(room_metadata) if room_metadata.startswith("{") else {}
        custom_voice_id = meta.get("voiceId")
        custom_temperature = meta.get("temperature")
        custom_speed = meta.get("speed")
        custom_model = meta.get("model")
        therapy_method = meta.get("therapyMethod")
        couple_therapy = bool(meta.get("coupleTherapy", False))
        user_id = meta.get("userId", "default")
        demo_profile = meta.get("demoProfile", "")
        platica_id = meta.get("platicaId")
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

    # Plática mode: load presentation guion if a platicaId came in the metadata.
    # If found, this disables session-memory injection (the guion supersedes prior
    # conversation context) and adds slide-control tools after agent construction.
    platica = None
    pres_state = None
    if platica_id:
        from platica_loader import load_platica
        platica = load_platica(platica_id, DATA_DIR)
        if platica is None:
            logger.warning(f"Plática '{platica_id}' no encontrada — corriendo en modo normal")
        else:
            logger.info(
                f"Plática cargada: '{platica.manifest.title}' "
                f"({platica.manifest.slide_count} slides)"
            )

    # Build instructions and tools
    tools = []
    instructions = personality["system_prompt"]
    manager = None

    # Plática con presenter_persona en texto libre: sustituye el system_prompt
    # de la personalidad por el texto que el usuario escribió en el formulario.
    # Si además hay nombre/género, los anteponemos como una línea breve para
    # asegurar concordancias correctas (presentador/presentadora) sin depender
    # de que el usuario lo haya escrito.
    if platica is not None and platica.manifest.presenter_persona:
        prefix_parts: list[str] = []
        if platica.manifest.presenter_name:
            label = (
                "presentadora" if platica.manifest.presenter_gender == "mujer" else "presentador"
            )
            prefix_parts.append(f"Te llamas {platica.manifest.presenter_name} y eres {label}.")
        prefix = ("\n".join(prefix_parts) + "\n\n") if prefix_parts else ""
        instructions = prefix + platica.manifest.presenter_persona
        logger.info(
            f"Plática usa presenter_persona libre — nombre={platica.manifest.presenter_name}, "
            f"género={platica.manifest.presenter_gender}"
        )

    if personality.get("has_therapy_tools"):
        # Dra. Ana with full session management + therapy tools
        manager = SessionManager(patient_id=patient_id or "default", user_id=user_id)
        tools = create_therapy_tools(manager)

        # "First session" = no therapy config persisted yet for this patient.
        # We use therapy_config.json (not perfil.md) because perfil.md is only
        # written after notes are generated; if the user cuts the first session
        # short, perfil.md never appears and the next connection would otherwise
        # be re-treated as a first session and overwrite the chosen method.
        has_stored_config = (manager.patient_dir / "therapy_config.json").exists()
        if not has_stored_config:
            # First session: use therapy method from metadata (selected by user)
            method_key = therapy_method if therapy_method in THERAPY_METHODS else DEFAULT_THERAPY_METHOD
            method_info = THERAPY_METHODS[method_key]
            instructions += f"\n\n--- ENFOQUE TERAPÉUTICO ---\n{method_info['description']}"
            if couple_therapy:
                instructions += DRA_ANA_COUPLE_ADDON
            instructions += "\n\n" + DRA_ANA_INTAKE_PROMPT
            # Persist the chosen config so subsequent connections honor it
            manager.save_therapy_config(method_key, couple_therapy)
            logger.info(f"Primera sesión (intake) - Método: {method_info['name']}, Pareja: {couple_therapy}")
        elif manager.is_first_session():
            # Config exists but no profile yet (previous first session was too
            # short to generate notes). Reuse stored config and run intake again.
            stored_config = manager.get_therapy_config()
            method_key = stored_config.get("method", DEFAULT_THERAPY_METHOD)
            is_couple = stored_config.get("couple", False)
            if method_key in THERAPY_METHODS:
                instructions += f"\n\n--- ENFOQUE TERAPÉUTICO ---\n{THERAPY_METHODS[method_key]['description']}"
            if is_couple:
                instructions += DRA_ANA_COUPLE_ADDON
            instructions += "\n\n" + DRA_ANA_INTAKE_PROMPT
            logger.info(f"Re-intake (sin perfil aún) - Método: {method_key}, Pareja: {is_couple}")
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

    # Demo: attach evaluation tools for client/prospect agents
    if personality.get("has_demo_tools"):
        tools = create_demo_client_tools(room)
        # Inject demo profile into instructions
        if demo_profile:
            instructions += f"\n\n--- PERFIL DE DEMO ---\nTu perfil de cliente es: '{demo_profile}'. Ajusta tu comportamiento según las instrucciones de ese perfil."
            logger.info(f"Demo tools activados, perfil: {demo_profile}")
    elif personality.get("is_demo") and demo_profile:
        # Seller demo: inject profile into instructions
        instructions += f"\n\n--- PERFIL DE DEMO ---\nTu perfil de vendedor es: '{demo_profile}'. Ajusta tu estilo de venta según las instrucciones de ese perfil."
        logger.info(f"Demo vendedor, perfil: {demo_profile}")

    # Inject session memory for non-therapy personalities with has_sessions.
    # Skip when in Plática mode — the guión replaces conversational continuity.
    if manager is None and personality.get("has_sessions") and platica is None:
        existing_summary = read_summary(user_id, personality_key)
        if existing_summary:
            instructions += (
                "\n\n--- CONTEXTO DE SESIONES ANTERIORES ---\n"
                "A continuación tienes un resumen de tus conversaciones previas con este usuario. "
                "Úsalo para dar continuidad, recordar temas tratados y personalizar la conversación. "
                "No menciones explícitamente que leíste un resumen, simplemente recuerda naturalmente.\n\n"
                + existing_summary
            )
            logger.info(f"Contexto de sesiones previas inyectado para {personality_key}")

    # Plática mode: stitch the three-block presentation prompt and register
    # slide-control tools. The agent reference inside pres_state is back-filled
    # after ComercianteAgent is instantiated below.
    if platica is not None:
        from presentation_tools import PresentationState, create_presentation_tools
        # State file scopeado por room — dos usuarios viendo la misma plática
        # corren en rooms distintos y NO deben pisarse el slide actual ni
        # disparar warnings cruzados de "ya hay sesión activa".
        safe_room = "".join(c for c in room_name if c.isalnum() or c in "_-") or "default"
        state_file = DATA_DIR / "platicas" / platica.manifest.id / f"_state_{safe_room}.json"
        pres_state = PresentationState(
            platica=platica,
            room=room,
            base_personality_prompt=instructions,
            state_file=state_file,
            window=5,
        )
        instructions = pres_state.build_instructions()
        tools = list(tools) + create_presentation_tools(pres_state)
        logger.info(
            f"Modo plática activo — slide inicial=1, ventana=±{pres_state.window}, "
            f"{len(tools)} herramientas registradas"
        )

    # Conversation log for all personalities (user-scoped)
    conv_log = ConversationLog(personality_key, personality["name"], user_id=user_id)

    # Use custom voice/temperature/model if provided, otherwise use personality defaults.
    # Plática voice_id and model, when set on the manifest, take precedence over
    # both metadata override and personality default — the plática's "casting" wins.
    voice_id = (
        (platica.manifest.voice_id if platica else None)
        or custom_voice_id
        or personality["voice_id"]
    )
    if platica is not None and platica.manifest.model:
        custom_model = platica.manifest.model
    temperature = custom_temperature if custom_temperature is not None else 0.7
    llm_model = custom_model or "google/gemini-2.5-flash"
    # Speed: precedencia manifest > metadata > 1.0 (mismo patrón que voice_id).
    # En vivo, el slider del modo live puede sobrescribir esto vía data channel.
    speed = (
        (platica.manifest.speed if platica and platica.manifest.speed is not None else None)
        or custom_speed
        or 1.0
    )
    # Clamp speed to Cartesia Sonic-3 valid range (0.6 - 2.0)
    speed = max(0.6, min(2.0, float(speed)))
    # Language settings: personality can override STT/TTS language (for language teachers)
    stt_language = personality.get("stt_language", "es")
    tts_language = personality.get("tts_language", "es")
    logger.info(f"Voice: {voice_id}, Temperature: {temperature}, Speed: {speed}, Model: {llm_model}, STT: {stt_language}, TTS: {tts_language}")

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
            speed=speed,
            api_key=os.getenv("CARTESIA_API_KEY"),
        ),
    )

    # Metrics collection for all personalities (user-scoped)
    @session.on("metrics_collected")
    def on_metrics(event):
        m = event.metrics
        try:
            data = _load_metrics(user_id)
            # Ensure cost breakdown fields exist (migration for old metrics files)
            data.setdefault("llm_cost_usd", 0.0)
            data.setdefault("tts_cost_usd", 0.0)
            data.setdefault("stt_cost_usd", 0.0)
            if hasattr(m, "total_tokens"):  # LLM metrics
                data["total_tokens"] += m.total_tokens
                data["prompt_tokens"] += m.prompt_tokens
                data["completion_tokens"] += m.completion_tokens
                cost = (m.prompt_tokens * LLM_COST_PER_1M_INPUT / 1_000_000 +
                        m.completion_tokens * LLM_COST_PER_1M_OUTPUT / 1_000_000)
                data["llm_cost_usd"] += cost
                data["total_cost_usd"] += cost
                data["llm_calls"] += 1
            elif hasattr(m, "characters_count"):  # TTS metrics
                data["tts_characters"] += m.characters_count
                tts_cost = m.characters_count * TTS_COST_PER_1K_CHARS / 1_000
                data["tts_cost_usd"] += tts_cost
                data["total_cost_usd"] += tts_cost
            elif hasattr(m, "audio_duration"):  # STT metrics
                data["stt_audio_seconds"] += m.audio_duration
                stt_cost = (m.audio_duration / 60) * STT_COST_PER_MINUTE
                data["stt_cost_usd"] += stt_cost
                data["total_cost_usd"] += stt_cost
            _save_metrics(user_id, data)
        except Exception as e:
            logger.debug(f"Error guardando métricas: {e}")

    # Control channel: mensajes del cliente. SOLO setean state — el conductor
    # decide cuándo aplicarlos (cuando el agente está idle).
    @ctx.room.on("data_received")
    def on_data_received(packet):
        if packet.topic and packet.topic != "control":
            return
        try:
            msg = json.loads(packet.data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return
        if not isinstance(msg, dict):
            return
        msg_type = msg.get("type")
        if msg_type == "speed":
            # Cartesia TTS speed slider — independiente del flujo de slides.
            try:
                new_speed = max(0.6, min(2.0, float(msg["value"])))
                session.tts.update_options(speed=new_speed)
                logger.info(f"Speed actualizado a {new_speed:.2f}x")
            except (KeyError, TypeError, ValueError, Exception) as e:
                logger.warning(f"speed update fallo: {e}")
            return
        if pres_state is None:
            return  # los mensajes siguientes solo aplican en modo plática
        if msg_type == "hand_raised":
            try:
                slide = int(msg["slide"])
            except (KeyError, TypeError, ValueError):
                return
            if 1 <= slide <= pres_state.platica.manifest.slide_count:
                pres_state.pending_hand_at = slide
                logger.info(f"Mano levantada en slide {slide}")
        elif msg_type == "advance":
            target = pres_state.next_visible_after(pres_state.current_slide)
            if target is None:
                logger.info("client advance ignorado: último slide visible")
                return
            pres_state.pending_target = target
            logger.info(f"client advance: pending {target}")
        elif msg_type == "goto":
            try:
                target = int(msg["slide"])
            except (KeyError, TypeError, ValueError):
                return
            if 1 <= target <= pres_state.platica.manifest.slide_count:
                pres_state.pending_target = target
                logger.info(f"client goto: pending {target}")

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

    async def _on_shutdown():
        # Plática mode: stop the watchdog loop and clean up the live state file
        # so the next session starts fresh and the process can exit cleanly.
        if pres_state is not None:
            for task_attr in ("_conductor_task", "_watchdog_task", "_pacing_task", "_heartbeat_task"):
                t = getattr(pres_state, task_attr, None)
                if t is not None and not t.done():
                    t.cancel()
                    try:
                        await t
                    except (asyncio.CancelledError, Exception):
                        pass
            try:
                if pres_state.state_file.exists():
                    pres_state.state_file.unlink()
                    logger.info(f"State file eliminado: {pres_state.state_file}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar state file: {e}")

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

        # Generate therapy notes for Dra. Ana, or lightweight summary for other
        # personalities. Awaited inline so livekit's shutdown sequence waits for
        # completion before killing the process.
        #
        # Skip for plática sessions: el guion sustituye el contexto de sesiones
        # previas (agent.py:302 evita inyectarlo cuando platica is not None), así
        # que generar el resumen es trabajo desperdiciado — además es lento (LLM
        # call) y se come el shutdown_process_timeout de LiveKit (default 10s),
        # provocando que se mate el process con SIGUSR1. La transcripción y el
        # conv_log ya están persistidos arriba de este bloque.
        if manager is not None:
            await _generate_notes(manager, transcript, start_time)
        elif personality.get("has_sessions") and platica is None:
            try:
                logger.info(f"Generando resumen de sesión para {personality_key}...")
                await generate_summary(user_id, personality_key, personality["name"], transcript)
                logger.info(f"Resumen de sesión generado para {personality_key}")
            except Exception as e:
                logger.error(f"Error generando resumen: {e}", exc_info=True)
        elif platica is not None:
            logger.info("Modo plática: se omite resumen de sesión (no se reinyecta en futuras pláticas)")

    ctx.add_shutdown_callback(_on_shutdown)

    has_vision = personality.get("has_vision", False) or personality_key in VISION_PERSONALITIES
    agent = ComercianteAgent(personality_key, instructions, tools, has_vision=has_vision)

    # Back-fill the agent + session references so presentation tools can
    # mutate `agent.update_instructions(...)` when the slide changes and the
    # Q&A silence detector can read session.user_state / session.agent_state.
    if pres_state is not None:
        pres_state.agent = agent
        pres_state.session = session

    start_kwargs = {"agent": agent, "room": ctx.room}
    if has_vision:
        start_kwargs["room_input_options"] = RoomInputOptions(video_enabled=True)
        logger.info("Visión habilitada: el agente puede ver la pantalla del usuario")

    await session.start(**start_kwargs)

    # Demo vendor agents greet first so the prospect doesn't have to initiate
    if personality.get("is_demo") and not personality.get("has_demo_tools"):
        await session.generate_reply(
            instructions="Saluda al prospecto de forma breve y natural, preséntate y comienza tu pitch de ventas. No esperes a que el prospecto hable primero."
        )

    # Plática mode: kick off proactively so the audience hears narration
    # immediately. La instruction tiene que ser meta-mínima — palabras como
    # "saluda", "DETALLE", "audiencia" se filtran al TTS con modelos chicos.
    # Pedimos contenido directo: la apertura natural del primer slide.
    if pres_state is not None:
        await session.generate_reply(
            instructions=(
                "Empieza ahora con el tema del primer slide, abriendo con un saludo cálido "
                "y breve. Sin meta-comentarios."
            )
        )

    # ─── Conductor: única autoridad para cambiar de slide ───────────────
    # Loop que vigila state.pending_target y ejecuta la transición SOLO cuando
    # el agente está idle (no hablando, no pensando). Esto garantiza que el
    # slide visible nunca se adelante al audio.
    #
    # También maneja:
    # - Q&A (cuando hay mano levantada en silent mode + se quiere avanzar)
    # - Force-advance (slide se atoró > 2x target sin que el LLM llame avanzar)
    # - final_qa_start (último slide, mic abre permanente para preguntas)
    if pres_state is not None:

        async def _wait_idle() -> bool:
            """Return True si el agente está idle (user listening + agent listening)
            ahora mismo. False si alguno está activo."""
            us = getattr(session, "user_state", "listening")
            ag = getattr(session, "agent_state", "listening")
            return us == "listening" and ag == "listening"

        async def _run_qa_round() -> None:
            """Abre Q&A, invita a preguntar, espera pregunta+respuesta+3s silencio,
            cierra Q&A. Una sola ronda por slide. La mano se baja al final."""
            pres_state.qa_active = True
            await pres_state.publish(
                {"type": "qa_window_start", "slide": pres_state.current_slide}
            )
            logger.info(f"Q&A abierta en slide {pres_state.current_slide}")
            try:
                session.generate_reply(
                    instructions=(
                        "Alguien levantó la mano. Invítalo/a brevemente a hacer "
                        "su pregunta con UNA frase corta y cálida ('te escucho, "
                        "¿cuál es tu pregunta?'). Después espera en silencio."
                    )
                )
            except Exception as e:
                logger.warning(f"qa invite fallo: {e}")
            # Esperar: al menos un turno de usuario + agente responde + 3s de
            # silencio mutuo. Bail después de 90s sin preguntas.
            started = time.monotonic()
            user_spoke = False
            silent_since: float | None = None
            while time.monotonic() - started < 90.0:
                await asyncio.sleep(0.3)
                us = getattr(session, "user_state", "listening")
                ag = getattr(session, "agent_state", "listening")
                if us == "speaking":
                    user_spoke = True
                    silent_since = None
                elif ag in ("speaking", "thinking"):
                    silent_since = None
                else:
                    if user_spoke:
                        if silent_since is None:
                            silent_since = time.monotonic()
                        elif time.monotonic() - silent_since >= 3.0:
                            break
            pres_state.qa_active = False
            pres_state.pending_hand_at = None
            await pres_state.publish({"type": "qa_window_end"})
            logger.info(
                f"Q&A cerrada ({'silencio' if user_spoke else 'sin pregunta'}, "
                f"{int(time.monotonic() - started)}s)"
            )

        async def _conductor():
            """Loop principal. Tick rápido (0.3s) para reaccionar fluido."""
            try:
                # Grace: dejar al kickoff del slide 1 echar a andar sin interferencia.
                await asyncio.sleep(2.0)
                while True:
                    await asyncio.sleep(0.3)
                    if pres_state.qa_active:
                        # Q&A en curso — el _run_qa_round se maneja solo.
                        continue

                    # 1. Force-advance: slide atascado > 2x target sin pending_target.
                    if (
                        pres_state.pending_target is None
                        and not pres_state.is_last_slide()
                    ):
                        block = pres_state.block_for(pres_state.current_slide)
                        if block and block.duration_sec:
                            elapsed = time.monotonic() - pres_state.slide_entered_at
                            if elapsed > block.duration_sec * 2.0:
                                next_vis = pres_state.next_visible_after(
                                    pres_state.current_slide
                                )
                                if next_vis is not None:
                                    logger.warning(
                                        f"FORCE-ADVANCE: slide {pres_state.current_slide} "
                                        f"elapsed {int(elapsed)}s > 2x target "
                                        f"{block.duration_sec}s → {next_vis}"
                                    )
                                    pres_state.pending_target = next_vis

                    # 2. Último slide + agente idle: emitir final_qa_start una vez.
                    if (
                        pres_state.pending_target is None
                        and pres_state.is_last_slide()
                        and not pres_state.final_qa_emitted
                    ):
                        elapsed = time.monotonic() - pres_state.slide_entered_at
                        # Espera ~5s después de entrar al último slide para que
                        # alcance a narrar al menos algo antes de abrir mic.
                        if elapsed > 5.0 and await _wait_idle():
                            pres_state.final_qa_emitted = True
                            await pres_state.publish({"type": "final_qa_start"})
                            logger.info("Final Q&A: mic abierta permanentemente")

                    if pres_state.pending_target is None:
                        continue

                    # 3. Hay pending_target: esperar a que el agente esté idle.
                    if not await _wait_idle():
                        continue

                    # 4. Q&A primero si aplica (mano levantada en slide actual + silent).
                    if (
                        pres_state.audience_mode == "silent"
                        and pres_state.pending_hand_at == pres_state.current_slide
                    ):
                        await _run_qa_round()
                        # Tras Q&A, seguimos al commit del pending_target.

                    # 5. Commit transición.
                    target = pres_state.pending_target
                    if target is not None:
                        await pres_state.do_transition(target)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Conductor fallo: {e}", exc_info=True)

        pres_state._conductor_task = asyncio.create_task(_conductor())
        logger.info("Conductor activo (tick=0.3s)")

    # ─── Watchdog mínimo: prod "continúa" si el LLM se calla mid-slide ──
    # SOLO aplica en auto/hybrid. NO toca slides — solo prompts al LLM para
    # mantener narración continua. El conductor maneja transitions.
    if pres_state is not None and pres_state.platica.manifest.advance_mode != "on_cue":
        watchdog_started = time.monotonic()
        last_activity = time.monotonic()
        last_trigger = 0.0

        @session.on("user_state_changed")
        def _on_user_state(_event):
            nonlocal last_activity
            last_activity = time.monotonic()

        @session.on("conversation_item_added")
        def _on_item_added_for_silence(_event):
            nonlocal last_activity
            last_activity = time.monotonic()

        async def _silence_watchdog():
            nonlocal last_activity, last_trigger
            try:
                while True:
                    await asyncio.sleep(1.5)
                    if time.monotonic() - watchdog_started < 8.0:
                        continue
                    # Si hay pending_target o qa_active, el conductor lo maneja.
                    if pres_state.pending_target is not None or pres_state.qa_active:
                        continue
                    us = getattr(session, "user_state", "listening")
                    ag = getattr(session, "agent_state", "listening")
                    if us == "speaking":
                        continue
                    if ag in ("speaking", "thinking", "initializing"):
                        last_activity = time.monotonic()
                        continue
                    idle = time.monotonic() - last_activity
                    cooldown = time.monotonic() - last_trigger
                    if idle > 3.0 and cooldown > 5.0:
                        logger.info(
                            f"Watchdog prod: slide={pres_state.current_slide}, "
                            f"idle={idle:.1f}s"
                        )
                        try:
                            session.generate_reply(
                                instructions=(
                                    "Continúa narrando el slide actual. Si ya "
                                    "cubriste todo su contenido, llama "
                                    "avanzar_diapositiva. Sin meta-comentarios."
                                )
                            )
                            last_trigger = time.monotonic()
                            last_activity = time.monotonic()
                        except Exception as e:
                            logger.warning(f"Watchdog generate_reply fallo: {e}")
            except asyncio.CancelledError:
                pass

        pres_state._watchdog_task = asyncio.create_task(_silence_watchdog())
        logger.info(
            f"Watchdog activo (modo plática '{pres_state.platica.manifest.advance_mode}', grace=8s)"
        )

    # ─── Pacing nudge: refresca el detail block con time hints ───────────
    # Solo refresca instructions (el LLM ve el "transcurrido" actualizado). No
    # cambia slides. Útil para que el detalle muestre "TIEMPO EXCEDIDO" cuando
    # el LLM se demora.
    if pres_state is not None:

        async def _pacing_nudge():
            try:
                while True:
                    await asyncio.sleep(10.0)
                    if pres_state.qa_active or pres_state.pending_target is not None:
                        continue
                    block = pres_state.block_for(pres_state.current_slide)
                    if block is None or not block.duration_sec:
                        continue
                    elapsed = time.monotonic() - pres_state.slide_entered_at
                    if elapsed > block.duration_sec * 0.85:
                        try:
                            await pres_state.refresh_instructions()
                        except Exception as e:
                            logger.warning(f"Pacing nudge fallo: {e}")
            except asyncio.CancelledError:
                pass

        pres_state._pacing_task = asyncio.create_task(_pacing_nudge())

        # State heartbeat: refresca `updated_at` cada 20s para que la UI poll
        # distinga sesión viva de archivo huérfano de crash.
        async def _state_heartbeat():
            try:
                while True:
                    await asyncio.sleep(20.0)
                    pres_state.write_state_to_disk()
            except asyncio.CancelledError:
                pass

        pres_state._heartbeat_task = asyncio.create_task(_state_heartbeat())


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
