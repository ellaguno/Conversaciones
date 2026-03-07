# Arquitectura - Comerciante con Voz

## Resumen

Sistema de agentes conversacionales por voz en tiempo real, construido sobre LiveKit. Soporta 4 personalidades distintas, incluyendo un sistema de terapia con persistencia de sesiones (Dra. Ana).

## Diagrama de Componentes

```
┌──────────────────────────────────────────────────────┐
│                   Usuario (navegador)                │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │           Frontend (Next.js 15)                │  │
│  │  - Selector de personalidad                    │  │
│  │  - Selector de paciente (modo psicologico)     │  │
│  │  - Visualizador de audio                       │  │
│  │  - Panel de notas terapeuticas (Tiptap)        │  │
│  │  - Dashboard de metricas                       │  │
│  └──────────────┬─────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────┘
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
┌──────────────────────────────────────────────────────┐
│               Agent (Python, livekit-agents 1.4.4)   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Deepgram │  │OpenRouter │  │    Cartesia      │   │
│  │  STT     │  │   LLM    │  │     TTS          │   │
│  │ nova-3   │  │ Gemini   │  │   sonic-3        │   │
│  │ (es)     │  │ 2.0 Flash│  │   (es)           │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │            Modulo de Personalidades           │    │
│  │  trader | abogado | psicologo | hippy         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │       Sistema Dra. Ana (psicologo)            │    │
│  │  SessionManager + TherapyTools + NoteGenerator│    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

## Stack Tecnologico

| Capa | Tecnologia | Detalles |
|------|-----------|----------|
| **Frontend** | Next.js 15 + React 19 | Basado en `agent-starter-react` de LiveKit |
| **UI** | Tailwind CSS 4 + Radix UI + Tiptap | Editor Markdown para notas clinicas |
| **STT** | Deepgram (nova-3) | Idioma: espanol |
| **LLM** | Google Gemini 2.0 Flash | Via OpenRouter (`openrouter.ai/api/v1`) |
| **TTS** | Cartesia (sonic-3) | Idioma: espanol, voz distinta por personalidad |
| **Transporte** | LiveKit Cloud | WebRTC para audio en tiempo real |
| **Agent** | Python 3.12+ | `livekit-agents` 1.4.4 |

## Estructura de Archivos

```
comerciante-con-voz/
├── agent/
│   ├── agent.py              # Punto de entrada, AgentServer + entrypoint
│   ├── personalities.py      # 4 personalidades con system prompts y voice IDs
│   ├── session_manager.py    # Persistencia de sesiones (archivos .md)
│   ├── therapy_tools.py      # Function calling tools para Dra. Ana
│   ├── note_generator.py     # Generacion automatica de notas post-sesion
│   ├── pyproject.toml        # Dependencias Python
│   ├── .env.local            # Variables de entorno (no versionado)
│   ├── metrics.json          # Metricas acumuladas (no versionado)
│   └── sessions/             # Datos de pacientes (no versionado)
│       └── {patient_id}/
│           ├── perfil.md
│           ├── resumen_general.md
│           ├── agenda.md
│           ├── sesiones/
│           │   └── YYYY-MM-DD_sesion_NNN.md
│           └── conclusiones/
│               ├── plan_terapeutico.md
│               ├── temas_recurrentes.md
│               └── progreso.md
├── frontend/
│   ├── app/
│   │   ├── page.tsx                     # Pagina principal
│   │   ├── layout.tsx                   # Layout root
│   │   └── api/
│   │       ├── token/route.ts           # Genera token LiveKit + crea sala
│   │       ├── sessions/route.ts        # GET: lista pacientes y sesiones
│   │       ├── sessions/notes/route.ts  # PUT/DELETE: editar notas
│   │       ├── sessions/[filename]/route.ts
│   │       └── metrics/route.ts         # GET: metricas de uso
│   ├── components/
│   │   ├── app/
│   │   │   ├── app.tsx                  # Componente principal
│   │   │   ├── welcome-view.tsx         # Vista de seleccion de personalidad
│   │   │   ├── view-controller.tsx      # Controlador de vistas
│   │   │   ├── notes-view.tsx           # Panel de notas terapeuticas
│   │   │   └── markdown-editor.tsx      # Editor Markdown (Tiptap)
│   │   ├── agents-ui/                   # Componentes LiveKit (visualizadores, etc.)
│   │   └── ui/                          # Componentes Radix/shadcn
│   ├── package.json
│   └── .env.local                       # Variables de entorno (no versionado)
└── docs/                                # Documentacion
```

## Flujo de Datos

### 1. Conexion de Voz

```
Usuario selecciona personalidad
  → Frontend POST /api/token { personality, patientId? }
    → Crea sala en LiveKit con nombre: room_{personality}_{patientId?}_{random}
    → Genera token JWT
  → Frontend conecta via WebSocket a LiveKit Cloud
  → LiveKit despacha agente Python automaticamente
  → Agente parsea room name para extraer personalidad y patient ID
  → Agente configura STT + LLM + TTS segun personalidad
```

### 2. Conversacion en Tiempo Real

```
Audio del usuario → Deepgram STT → Texto
  → Gemini 2.0 Flash (con system prompt de personalidad) → Respuesta
    → Cartesia TTS → Audio de respuesta
```

### 3. Sistema Dra. Ana (Terapia)

```
Sesion de intake (primera vez):
  → DRA_ANA_INTAKE_PROMPT se agrega al system prompt
  → Al terminar: genera perfil, plan terapeutico, agenda, notas de sesion

Sesion de seguimiento:
  → SessionManager carga contexto completo del paciente
  → DRA_ANA_FOLLOWUP_PROMPT + contexto se agregan al system prompt
  → Dra. Ana tiene 7 function tools para consultar datos del paciente
  → Al terminar: actualiza notas, resumen, temas, progreso, agenda
```

### 4. Metricas

```
Cada llamada LLM/TTS/STT emite evento "metrics_collected"
  → Se acumulan en metrics.json (tokens, costo, caracteres TTS, audio STT)
  → Frontend consulta GET /api/metrics para dashboard
```

## Personalidades

| Key | Nombre | Voz Cartesia | Descripcion |
|-----|--------|-------------|-------------|
| `trader` | Carlos el Trader | Manuel - Newsman | Trader financiero, analitico y directo |
| `abogado` | Lic. Martinez | Pedro - Formal Speaker | Abogado corporativo, formal |
| `psicologo` | Dra. Ana | Mariana - Nurturing Guide | Psicologa clinica TCC, con sesiones persistentes |
| `hippy` | Paz | Alejandro - Calm Mentor | Hippie filosofico, relajado |

## Patron de Comunicacion de Personalidad

La personalidad se comunica via **room name** (`room_{personality}_{random}`), no via metadata de sala (que no funciono con el dispatch automatico de LiveKit). El frontend fuerza remontaje con `TokenSource.custom()` y `key={sessionId}` al cambiar personalidad.

## Costos por Uso

- **LLM**: Gemini 2.0 Flash via OpenRouter — $0.10/1M input, $0.40/1M output
- **STT**: Deepgram nova-3 — segun plan
- **TTS**: Cartesia sonic-3 — segun plan (ElevenLabs se descarto por creditos)
