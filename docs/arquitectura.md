# Arquitectura - Comerciante con Voz

## Resumen

Sistema de agentes conversacionales por voz en tiempo real, construido sobre LiveKit. Soporta 11 personalidades distintas (incluyendo 6 guias espirituales), un sistema completo de terapia psicologica con 5 enfoques terapeuticos y soporte para terapia de pareja (Dra. Ana), persistencia de conversaciones para todos los agentes, y configuracion personalizable por personalidad.

## Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────┐
│                   Usuario (navegador)                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Frontend (Next.js 15)                    │  │
│  │  - Selector de personalidad (11 agentes)           │  │
│  │  - Selector de paciente (modo psicologico)         │  │
│  │  - Selector de enfoque terapeutico                 │  │
│  │  - Visualizador de audio (5 tipos configurables)   │  │
│  │  - Panel de notas terapeuticas (Tiptap)            │  │
│  │  - Visor de conversaciones (markdown)              │  │
│  │  - Panel de configuracion por personalidad         │  │
│  │  - Dashboard de metricas                           │  │
│  │  - Autenticacion (NextAuth.js)                     │  │
│  └──────────────┬─────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │ WebSocket (LiveKit SDK)
                  ▼
┌─────────────────────────────────────────┐
│         LiveKit Cloud                   │
│  wss://comerciante-de-voz-*.livekit.cloud│
│                                         │
│  - Salas de audio en tiempo real        │
│  - Dispatch automatico de agentes       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│               Agent (Python, livekit-agents 1.4.4)       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐       │
│  │ Deepgram │  │OpenRouter │  │    Cartesia      │       │
│  │  STT     │  │   LLM    │  │     TTS          │       │
│  │ nova-3   │  │ Gemini   │  │   sonic-3        │       │
│  │ (es)     │  │ 2.0 Flash│  │   (es, 33 voces) │       │
│  └──────────┘  └──────────┘  └──────────────────┘       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Modulo de Personalidades (11)          │    │
│  │  trader | abogado | psicologo | hippy | normal   │    │
│  │  estoico | sacerdote | monje | imam | rabino     │    │
│  │  pandit                                           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │       Sistema Dra. Ana (psicologo)                │    │
│  │  SessionManager + TherapyTools + NoteGenerator    │    │
│  │  5 enfoques: CBT, ACT, DBT, Mindfulness, Gestalt │    │
│  │  Soporte para terapia de pareja                   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │       ConversationLog (todos los agentes)         │    │
│  │  Guarda transcripciones .md por personalidad      │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Stack Tecnologico

| Capa | Tecnologia | Detalles |
|------|-----------|----------|
| **Frontend** | Next.js 15 + React 19 | Basado en `agent-starter-react` de LiveKit |
| **UI** | Tailwind CSS 4 + Radix UI + Tiptap | Editor Markdown para notas clinicas |
| **Auth** | NextAuth.js v5 (beta) | CredentialsProvider, JWT sessions, middleware |
| **STT** | Deepgram (nova-3) | Idioma: espanol |
| **LLM** | Google Gemini 2.0 Flash (configurable) | Via OpenRouter (`openrouter.ai/api/v1`), modelo cambiable por personalidad |
| **LLM Analisis** | Claude Sonnet 4 | Via OpenRouter, para notas clinicas post-sesion (`ANALYSIS_MODEL`) |
| **TTS** | Cartesia (sonic-3) | Idioma: espanol, 33 voces en espanol configurables |
| **Transporte** | LiveKit Cloud | WebRTC para audio en tiempo real |
| **Agent** | Python 3.12+ | `livekit-agents` 1.4.4 |

## Estructura de Archivos

```
comerciante-con-voz/
├── agent/
│   ├── agent.py              # Punto de entrada, AgentServer + entrypoint
│   ├── personalities.py      # 11 personalidades, 5 metodos terapeuticos, prompts
│   ├── session_manager.py    # Persistencia de sesiones + therapy_config.json
│   ├── therapy_tools.py      # Function calling tools para Dra. Ana
│   ├── note_generator.py     # Generacion automatica de notas post-sesion
│   ├── conversation_log.py   # Log de conversaciones para todos los agentes
│   ├── pyproject.toml        # Dependencias Python
│   ├── .env.local            # Variables de entorno (no versionado)
│   ├── metrics.json          # Metricas acumuladas (no versionado)
│   ├── sessions/             # Datos de pacientes Dra. Ana (no versionado)
│   │   └── {patient_id}/
│   │       ├── perfil.md
│   │       ├── resumen_general.md
│   │       ├── agenda.md
│   │       ├── therapy_config.json   # Metodo terapeutico y modalidad
│   │       ├── sesiones/
│   │       │   └── YYYY-MM-DD_sesion_NNN.md
│   │       └── conclusiones/
│   │           ├── plan_terapeutico.md
│   │           ├── temas_recurrentes.md
│   │           └── progreso.md
│   └── conversations/        # Transcripciones de todos los agentes (no versionado)
│       └── {personality_key}/
│           └── YYYY-MM-DD_HH-MM.md
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── login/page.tsx                    # Pagina de login
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth handler
│   │       ├── auth/password/route.ts        # Cambio de contrasena
│   │       ├── token/route.ts                # Genera token LiveKit + crea sala
│   │       ├── sessions/route.ts             # GET: lista pacientes y sesiones
│   │       ├── sessions/notes/route.ts       # PUT/DELETE: editar notas
│   │       ├── sessions/[filename]/route.ts  # GET: leer sesion individual
│   │       ├── conversations/route.ts        # GET: lista conversaciones por personalidad
│   │       ├── conversations/[filename]/route.ts  # GET: leer conversacion
│   │       └── metrics/route.ts              # GET: metricas de uso
│   ├── components/
│   │   ├── app/
│   │   │   ├── app.tsx                  # Componente principal con estado global
│   │   │   ├── welcome-view.tsx         # Selector de personalidad + paciente + terapia
│   │   │   ├── view-controller.tsx      # Controlador de vistas (welcome/session/notes/logs)
│   │   │   ├── notes-view.tsx           # Panel de notas terapeuticas (Dra. Ana)
│   │   │   ├── conversation-log-view.tsx # Visor de conversaciones (todos los agentes)
│   │   │   ├── settings-view.tsx        # Configuracion por personalidad
│   │   │   └── markdown-editor.tsx      # Editor Markdown (Tiptap)
│   │   ├── agents-ui/                   # Componentes LiveKit (visualizadores, etc.)
│   │   └── ui/                          # Componentes Radix/shadcn
│   ├── lib/
│   │   ├── auth.ts                      # Configuracion NextAuth.js
│   │   ├── rate-limit.ts               # Token bucket rate limiter
│   │   └── personalities-config.ts     # Configs frontend (voces, visualizadores, temperatura)
│   ├── middleware.ts                    # Auth middleware
│   ├── package.json
│   └── .env.local                       # Variables de entorno (no versionado)
├── docs/                                # Documentacion
└── VERSION                              # Version actual del sistema
```

## Flujo de Datos

### 1. Conexion de Voz

```
Usuario selecciona personalidad
  → Frontend POST /api/token { personality, patientId?, voiceId?, temperature?, therapyMethod?, coupleTherapy? }
    → Crea sala en LiveKit con nombre: room_{personality}_{patientId?}_{random}
    → Almacena metadata JSON en la sala (personality, voiceId, temperature, therapyMethod, coupleTherapy)
    → Genera token JWT
  → Frontend conecta via WebSocket a LiveKit Cloud
  → LiveKit despacha agente Python automaticamente
  → Agente parsea room name para extraer personalidad y patient ID
  → Agente parsea room metadata para extraer voiceId, temperature, therapyMethod, coupleTherapy
  → Agente configura STT + LLM + TTS segun personalidad y configuracion custom
```

### 2. Conversacion en Tiempo Real

```
Audio del usuario → Deepgram STT → Texto
  → Gemini 2.0 Flash (con system prompt de personalidad + enfoque terapeutico) → Respuesta
    → Cartesia TTS (voz configurable por personalidad) → Audio de respuesta
```

### 3. Sistema Dra. Ana (Terapia)

```
Sesion de intake (primera vez):
  → Usuario selecciona enfoque terapeutico (CBT/ACT/DBT/Mindfulness/Gestalt)
  → Usuario puede activar modalidad de terapia de pareja
  → therapy_config.json se guarda en directorio del paciente
  → Descripcion del enfoque + DRA_ANA_INTAKE_PROMPT se agregan al system prompt
  → Si es terapia de pareja: DRA_ANA_COUPLE_ADDON se agrega al prompt
  → Al terminar: genera perfil, plan terapeutico, agenda, notas de sesion

Sesion de seguimiento:
  → SessionManager carga therapy_config.json (metodo + pareja)
  → SessionManager carga contexto completo del paciente
  → Descripcion del enfoque + DRA_ANA_FOLLOWUP_PROMPT + contexto se agregan al system prompt
  → Dra. Ana tiene 7 function tools para consultar datos del paciente
  → Al terminar: actualiza notas, resumen, temas, progreso, agenda
```

### 4. Conversaciones (Todos los Agentes)

```
Cada sesion de voz captura transcripcion completa
  → Al terminar la sesion: ConversationLog guarda .md en conversations/{personality}/
  → Frontend puede listar y visualizar conversaciones via /api/conversations
```

### 5. Metricas

```
Cada llamada LLM/TTS/STT emite evento "metrics_collected"
  → Se acumulan en metrics.json (tokens, costo, caracteres TTS, audio STT)
  → Frontend consulta GET /api/metrics para dashboard
```

## Personalidades

| Key | Nombre | Voz Default | Descripcion |
|-----|--------|-------------|-------------|
| `trader` | Carlos el Trader | Manuel - Newsman | Trader financiero, analitico y directo |
| `abogado` | Lic. Martinez | Pedro - Formal Speaker | Abogado corporativo, formal |
| `psicologo` | Dra. Ana | Mariana - Nurturing Guide | Psicologa clinica, 5 enfoques, terapia de pareja |
| `hippy` | Paz | Alejandro - Calm Mentor | Hippie filosofico, relajado |
| `normal` | Alguien Normal | Alejandro - Calm Mentor | Persona comun para platicar |
| `estoico` | Marco el Estoico | Pedro - Formal Speaker | Filosofo estoico |
| `sacerdote` | Padre Miguel | Pedro - Formal Speaker | Sacerdote catolico |
| `monje` | Monje Thich | Alejandro - Calm Mentor | Monje budista zen |
| `imam` | Iman Ahmed | Manuel - Newsman | Iman musulman |
| `rabino` | Rabino David | Manuel - Newsman | Rabino judio |
| `pandit` | Pandit Arjun | Alejandro - Calm Mentor | Pandit hindu |

## Enfoques Terapeuticos (Dra. Ana)

| Key | Nombre | Tecnicas Principales |
|-----|--------|---------------------|
| `cbt` | Terapia Cognitivo-Conductual | Reestructuracion cognitiva, modelo ABC, activacion conductual |
| `act` | Aceptacion y Compromiso | Defusion cognitiva, valores, accion comprometida |
| `dbt` | Dialectico-Conductual | Regulacion emocional, tolerancia al malestar, habilidades TIPP |
| `mindfulness` | Mindfulness | Meditacion guiada, body scan, atencion plena, MBCT/MBSR |
| `gestalt` | Gestalt / Sistemica | Silla vacia, dialogo de partes, patrones transgeneracionales |

El enfoque se selecciona solo en la primera sesion y se persiste en `therapy_config.json`. Las sesiones de seguimiento lo cargan automaticamente.

## Configuracion por Personalidad

Cada personalidad es configurable desde el frontend (Settings):

- **Nombre**: Nombre personalizado del interlocutor
- **Voz**: Seleccion entre 33 voces Cartesia en espanol
- **Visualizador de audio**: bar, wave, grid, radial, aura
- **Temperatura/Creatividad**: 0.0 (preciso) a 1.0 (creativo)

Las configuraciones se persisten en `localStorage` del navegador y se pasan al agente via room metadata.

## Patron de Comunicacion de Personalidad

La personalidad se comunica via **room name** (`room_{personality}_{random}`), no via metadata de sala (que no funciono con el dispatch automatico de LiveKit). Configuraciones adicionales (voz, temperatura, metodo terapeutico) van en **room metadata** como JSON. El frontend fuerza remontaje con `TokenSource.custom()` y `key={sessionId}` al cambiar personalidad.

## Costos por Uso

- **LLM**: Gemini 2.0 Flash via OpenRouter — $0.10/1M input, $0.40/1M output
- **STT**: Deepgram nova-3 — segun plan
- **TTS**: Cartesia sonic-3 — segun plan (ElevenLabs se descarto por creditos)
