# Deployment - Comerciante con Voz

## Variables de Entorno

### Agent (`agent/.env.local`)

```env
LIVEKIT_URL=wss://comerciante-de-voz-e0sz8unl.livekit.cloud
LIVEKIT_API_KEY=<livekit_api_key>
LIVEKIT_API_SECRET=<livekit_api_secret>
DEEPGRAM_API_KEY=<deepgram_api_key>
OPENAI_API_KEY=<openrouter_api_key>   # Es la key de OpenRouter, no de OpenAI
CARTESIA_API_KEY=<cartesia_api_key>
```

### Frontend (`frontend/.env.local`)

```env
LIVEKIT_URL=wss://comerciante-de-voz-e0sz8unl.livekit.cloud
LIVEKIT_API_KEY=<livekit_api_key>
LIVEKIT_API_SECRET=<livekit_api_secret>

# Autenticacion (obligatorio en produccion)
AUTH_ENABLED=true
AUTH_SECRET=<generar_con_openssl_rand_base64_32>
AUTH_ADMIN_USER=admin
AUTH_ADMIN_PASSWORD=<password_seguro>
```

## Desarrollo Local

### Prerequisitos

- Python 3.12+
- Node.js 18+ con pnpm 9
- Cuentas activas en: LiveKit Cloud, Deepgram, OpenRouter, Cartesia

### 1. Clonar y configurar

```bash
git clone <repo_url>
cd "Comerciante con voz"

# Copiar variables de entorno
cp frontend/.env.example frontend/.env.local
# Editar frontend/.env.local con tus keys

# Crear agent/.env.local con las variables listadas arriba
```

### 2. Levantar el Agent

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -e .
python agent.py dev
```

El agente se conecta a LiveKit Cloud y espera por salas nuevas.

### 3. Levantar el Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Acceder a `http://localhost:3000`.

### 4. Usar la aplicacion

1. Iniciar sesion (usuario/contrasena configurados en .env.local, o `admin`/`admin` por defecto)
2. Seleccionar una personalidad en la pantalla de bienvenida
3. Para personalidades normales: hacer clic en "Conectar" para iniciar la conversacion
4. Para Dra. Ana:
   - Seleccionar paciente existente, o crear uno nuevo
   - Al crear nuevo: elegir enfoque terapeutico (CBT, ACT, DBT, Mindfulness, Gestalt)
   - Opcionalmente activar "Terapia de pareja"
   - Hacer clic en "Iniciar sesion"
5. Para ver conversaciones pasadas: hacer clic en "Ver conversaciones" (aparece cuando hay logs)
6. Para ver notas de Dra. Ana: hacer clic en "Ver notas"
7. Configuracion: acceder desde el enlace "Configuracion" en la pantalla principal
8. Cerrar sesion: enlace "Salir" en la pantalla principal

## Arquitectura de Deployment (Produccion)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend   │────▶│ LiveKit Cloud │◀────│    Agent     │
│  (Vercel /  │     │              │     │  (VPS /      │
│   Netlify)  │     └──────────────┘     │   Railway /  │
└─────────────┘                          │   Docker)    │
                                         └──────────────┘
```

### Frontend

El frontend es una app Next.js estandar. Se puede desplegar en:

- **Vercel** (recomendado para Next.js)
- **Netlify**
- Cualquier plataforma que soporte Next.js

**Importante**: En produccion la autenticacion esta siempre activa. Configurar `AUTH_SECRET`, `AUTH_ADMIN_USER` y `AUTH_ADMIN_PASSWORD` como variables de entorno.

### Agent

El agente es un proceso Python de larga duracion. Opciones:

- **Railway** / **Render** — PaaS con soporte para procesos worker
- **VPS** (DigitalOcean, Hetzner) — con systemd o Docker
- **Docker** — contenedor con el agente

Ejemplo de Dockerfile:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY agent/ .
RUN pip install -e .
CMD ["python", "agent.py", "start"]
```

Nota: `python agent.py dev` es para desarrollo (hot reload). En produccion usar `python agent.py start`.

### Datos Persistentes

El sistema almacena datos en dos directorios:

| Directorio | Contenido | Agente |
|-----------|-----------|--------|
| `agent/sessions/` | Datos de pacientes (perfiles, sesiones, notas, therapy_config.json) | Dra. Ana |
| `agent/conversations/` | Transcripciones de conversaciones | Todos |

En produccion:

- Montar un volumen persistente si se usa Docker/contenedores
- O migrar a una base de datos (PostgreSQL, SQLite) para mayor robustez
- El frontend lee estos archivos via API routes, por lo que frontend y agent deben compartir acceso al filesystem (o migrar a una API centralizada)
- `auth-config.json` (raiz del proyecto) almacena la contrasena si se cambia desde la UI

### Servicios Externos

| Servicio | Proposito | Tier Gratuito |
|----------|----------|---------------|
| [LiveKit Cloud](https://cloud.livekit.io) | Transporte de audio WebRTC | Si (limitado) |
| [Deepgram](https://deepgram.com) | Speech-to-Text | Si ($200 creditos iniciales) |
| [OpenRouter](https://openrouter.ai) | LLM Gateway | Pay-per-use |
| [Cartesia](https://cartesia.ai) | Text-to-Speech | Si (limitado) |

## Seguridad

Ver **[seguridad.md](seguridad.md)** para el analisis completo de vulnerabilidades y las 7 capas de seguridad implementadas.

## Monitoreo

- **Metricas internas**: El agente guarda metricas en `metrics.json` (tokens, costo, uso)
- **Dashboard**: El frontend muestra estas metricas via `/api/metrics`
- Para produccion, considerar integrar OpenTelemetry (ya incluido como dependencia)
