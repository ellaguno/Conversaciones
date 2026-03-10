# Conversaciones con Voz

Plataforma de conversaciones por voz con agentes de IA especializados. Permite hablar en tiempo real con distintas personalidades: traders, abogados, psicologos, asesores de sistemas, guias espirituales y personajes famosos.

**Version**: 0.6.0

## Caracteristicas principales

- **Conversaciones por voz en tiempo real** con multiples personalidades de IA
- **30+ personalidades** organizadas por categoria (finanzas, legal, salud mental, tecnologia, etc.)
- **Modulo de terapia (Dra. Ana)** con expediente clinico, notas de sesion, plan terapeutico, seguimiento de progreso y agenda
- **Transcripcion de audio** con Deepgram
- **Compartir pantalla** para asesoria visual de sistemas
- **Sistema multi-usuario** con autenticacion y datos aislados por usuario
- **Panel de administracion** para gestion de usuarios
- **Visualizadores de audio** en multiples estilos (bar, wave, grid, radial, aura)
- **Temas claro/oscuro** con deteccion automatica

## Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  LiveKit Cloud   │◀────│   Agent (Python) │
│   (Next.js)     │     │  (WebRTC/Audio)  │     │                 │
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                │
         │  API Routes                          LLM (OpenRouter)
         │  /api/token                          STT (Deepgram)
         │  /api/sessions                       TTS (Cartesia)
         │  /api/conversations
         ▼                                                │
    ┌──────────┐                                         ▼
    │  data/   │◀────── Notas, transcripciones, perfiles
    └──────────┘
```

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| UI | shadcn/ui, Radix UI, Agents UI (LiveKit) |
| Backend | Python 3.12, LiveKit Agents SDK |
| Comunicacion | LiveKit Cloud (WebRTC) |
| Speech-to-Text | Deepgram |
| Text-to-Speech | Cartesia (primario), ElevenLabs (fallback) |
| LLM | OpenRouter — Gemini 2.0 Flash (conversacion), Claude Opus 4.6 (analisis) |
| Autenticacion | NextAuth 5 con JWT |
| Base de datos | Archivos (Markdown + JSON) |

## Personalidades disponibles

| Categoria | Personalidades |
|---|---|
| Finanzas | Trader General, Bolsa, Crypto, Forex, Finanzas Personales, Commodities |
| Legal | Abogado General, Corporativo, Laboral, Fiscal, Penal, Familiar, Inmobiliario |
| Salud Mental | Dra. Ana (psicologa clinica) — CBT, ACT, DBT, Mindfulness, Gestalt |
| Tecnologia | Asesor de Sistemas, Office, Web, Tecnico Avanzado (con vision) |
| Espiritual | Sabio Alternativo, Filosofo Estoico, Sacerdote, Monje Budista, Iman, Rabino, Pandit |
| Personajes | Nikola Tesla, Jesucristo, Santo Tomas de Aquino, San Francisco, Sun Tzu + personalizados |

## Estructura del proyecto

```
Conversaciones/
├── agent/                          # Backend Python
│   ├── agent.py                    # Servidor principal LiveKit
│   ├── personalities.py            # Definicion de 30+ personalidades
│   ├── session_manager.py          # Gestion de expedientes clinicos
│   ├── note_generator.py           # Generacion de notas con Claude
│   ├── therapy_tools.py            # Herramientas de terapia
│   ├── conversation_log.py         # Registro de conversaciones
│   └── .env.local                  # Variables de entorno (no incluido)
├── frontend/                       # Aplicacion Next.js
│   ├── app/
│   │   ├── api/                    # API Routes
│   │   │   ├── token/              # Generacion de tokens LiveKit
│   │   │   ├── sessions/           # API de notas terapeuticas
│   │   │   ├── conversations/      # Historial de conversaciones
│   │   │   ├── transcribe/         # Transcripcion con Deepgram
│   │   │   └── auth/               # Autenticacion NextAuth
│   │   ├── login/                  # Pagina de login
│   │   └── admin/                  # Panel de administracion
│   ├── components/
│   │   ├── app/                    # Vistas principales
│   │   ├── agents-ui/              # Componentes LiveKit personalizados
│   │   └── ui/                     # Componentes shadcn/ui
│   ├── lib/                        # Utilidades y configuracion
│   └── .env.local                  # Variables de entorno (no incluido)
├── data/                           # Datos por usuario
│   └── {user_id}/
│       ├── conversations/          # Transcripciones por personalidad
│       ├── sessions/{patient_id}/  # Expedientes clinicos
│       └── metrics.json            # Metricas de uso
├── docs/                           # Documentacion en espanol
└── scripts/                        # Scripts de utilidad
    ├── bump-version.sh             # Gestion de versiones
    └── migrate-to-multiuser.sh     # Migracion multi-usuario
```

## Requisitos previos

- Node.js 18+ y pnpm
- Python 3.12+
- Cuenta en [LiveKit Cloud](https://cloud.livekit.io)
- API keys: Deepgram, OpenRouter, Cartesia

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/ellaguno/Conversaciones.git
cd Conversaciones
```

### 2. Configurar el frontend

```bash
cd frontend
pnpm install
cp .env.example .env.local  # Editar con tus credenciales
```

Variables de entorno del frontend (`.env.local`):

```env
LIVEKIT_URL=wss://tu-servidor.livekit.cloud
LIVEKIT_API_KEY=tu_api_key
LIVEKIT_API_SECRET=tu_api_secret
AUTH_SECRET=generado_con_openssl_rand_base64_32
AUTH_ADMIN_USER=admin
AUTH_ADMIN_PASSWORD=contraseña_segura
```

### 3. Configurar el agent

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env.local  # Editar con tus credenciales
```

Variables de entorno del agent (`.env.local`):

```env
LIVEKIT_URL=wss://tu-servidor.livekit.cloud
LIVEKIT_API_KEY=tu_api_key
LIVEKIT_API_SECRET=tu_api_secret
DEEPGRAM_API_KEY=tu_deepgram_key
OPENAI_API_KEY=tu_openrouter_key
CARTESIA_API_KEY=tu_cartesia_key
ANALYSIS_MODEL=anthropic/claude-opus-4.6
```

### 4. Ejecutar en desarrollo

```bash
# Terminal 1 — Frontend
cd frontend && pnpm dev

# Terminal 2 — Agent
cd agent && python agent.py dev
```

## Despliegue en produccion

El proyecto incluye una guia completa de despliegue en `docs/deployment.md` con:

- Configuracion de Nginx como reverse proxy
- Certificados SSL con Let's Encrypt
- Servicios systemd para frontend y agent
- Gestion de procesos y logs

Ejemplo de servicios systemd:

```bash
# Frontend
systemctl start conversaciones-frontend

# Agent
systemctl start conversaciones-agent
```

## Modulo de terapia (Dra. Ana)

La Dra. Ana es una psicologa clinica de IA que mantiene un expediente completo por paciente:

- **Perfil clinico** — datos del paciente, motivo de consulta, impresion diagnostica
- **Notas de sesion** — resumen, observaciones clinicas, tareas asignadas
- **Plan terapeutico** — objetivos, tecnicas, indicadores de progreso
- **Temas recurrentes** — patrones, esquemas cognitivos, conflictos
- **Progreso** — avances, retrocesos, adherencia al tratamiento
- **Agenda** — programacion de sesiones futuras

Las notas se generan automaticamente al terminar cada sesion usando Claude Opus via OpenRouter.

Soporta multiples enfoques terapeuticos:
- CBT (Cognitivo-Conductual)
- ACT (Aceptacion y Compromiso)
- DBT (Dialectico-Conductual)
- Mindfulness (Atencion Plena)
- Gestalt / Sistemica

## Scripts

```bash
# Actualizar version en todo el proyecto
./scripts/bump-version.sh 0.7.0

# Migrar datos al sistema multi-usuario
./scripts/migrate-to-multiuser.sh
```

## Documentacion

Disponible en la carpeta `docs/`:

- `deployment.md` — Guia de despliegue en produccion
- `arquitectura.md` — Arquitectura del sistema
- `guia-usuario.md` — Guia de usuario
- `guia-administrador.md` — Guia de administrador
- `seguridad.md` — Consideraciones de seguridad

## Licencia

Uso privado.
