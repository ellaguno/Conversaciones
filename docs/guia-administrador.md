# Guia del Administrador - Comerciante con Voz v0.6.0

## Indice

1. [Requisitos del sistema](#requisitos-del-sistema)
2. [Instalacion](#instalacion)
3. [Configuracion de variables de entorno](#configuracion-de-variables-de-entorno)
4. [Autenticacion y seguridad](#autenticacion-y-seguridad)
5. [Modelo LLM configurable](#modelo-llm-configurable)
6. [Gestion de datos](#gestion-de-datos)
7. [Monitoreo y metricas](#monitoreo-y-metricas)
8. [Despliegue en produccion](#despliegue-en-produccion)
9. [Mantenimiento](#mantenimiento)
10. [Solucion de problemas](#solucion-de-problemas)

---

## Requisitos del Sistema

| Componente | Version Minima |
|-----------|---------------|
| Python | 3.12+ |
| Node.js | 18+ |
| pnpm | 9+ |
| Sistema operativo | Linux, macOS, Windows (WSL) |

### Cuentas de servicios externos requeridas

| Servicio | Uso | Registro |
|----------|-----|----------|
| LiveKit Cloud | Transporte de audio WebRTC | https://cloud.livekit.io |
| Deepgram | Speech-to-Text (STT) | https://deepgram.com |
| OpenRouter | Gateway de LLMs | https://openrouter.ai |
| Cartesia | Text-to-Speech (TTS) | https://cartesia.ai |

---

## Instalacion

### 1. Clonar el repositorio

```bash
git clone <repo_url>
cd "Comerciante con voz"
```

### 2. Configurar el Agent (Python)

```bash
cd agent
python -m venv .venv
source .venv/bin/activate    # Linux/macOS
# .venv\Scripts\activate     # Windows
pip install -e .
```

### 3. Configurar el Frontend (Node.js)

```bash
cd frontend
pnpm install
```

### 4. Configurar variables de entorno

Copiar los templates y rellenar con tus keys:

```bash
cp frontend/.env.example frontend/.env.local
# Crear agent/.env.local manualmente (ver seccion siguiente)
```

### 5. Arrancar los servicios

**Terminal 1 - Agent:**
```bash
cd agent
source .venv/bin/activate
python agent.py dev          # Desarrollo (hot reload)
# python agent.py start      # Produccion
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev                     # Desarrollo
# pnpm build && pnpm start   # Produccion
```

Acceder a `http://localhost:3000`.

---

## Configuracion de Variables de Entorno

### Agent (`agent/.env.local`)

```env
# LiveKit Cloud
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
LIVEKIT_API_KEY=<tu_api_key>
LIVEKIT_API_SECRET=<tu_api_secret>

# Speech-to-Text
DEEPGRAM_API_KEY=<tu_deepgram_key>

# LLM (OpenRouter - la variable se llama OPENAI_API_KEY por compatibilidad con el plugin)
OPENAI_API_KEY=<tu_openrouter_key>

# Text-to-Speech
CARTESIA_API_KEY=<tu_cartesia_key>

# Modelo de analisis para generacion de notas terapeuticas (opcional)
# Default: anthropic/claude-sonnet-4 via OpenRouter
ANALYSIS_MODEL=anthropic/claude-sonnet-4
```

### Frontend (`frontend/.env.local`)

```env
# LiveKit Cloud (mismas keys que el agent)
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
LIVEKIT_API_KEY=<tu_api_key>
LIVEKIT_API_SECRET=<tu_api_secret>

# Autenticacion
AUTH_ENABLED=true                    # 'true' para activar login (siempre activo en produccion)
AUTH_SECRET=<generar_con_openssl>    # Secreto JWT
AUTH_ADMIN_USER=admin                # Usuario administrador
AUTH_ADMIN_PASSWORD=<password_seguro> # Contrasena (cambiar el default 'admin')

# Opcional (dejar en blanco si no aplica)
AGENT_NAME=
NEXT_PUBLIC_APP_CONFIG_ENDPOINT=
SANDBOX_ID=
```

**Generar AUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## Autenticacion y Seguridad

### Sistema de autenticacion

La aplicacion usa **NextAuth.js v5** con CredentialsProvider y sesiones JWT.

| Aspecto | Detalle |
|---------|---------|
| Framework | NextAuth.js v5 (beta) |
| Proveedor | CredentialsProvider (usuario/contrasena) |
| Sesiones | JWT (no requiere BD) |
| Middleware | Protege todas las rutas excepto `/login` y assets estaticos |

### Comportamiento segun entorno

| Entorno | AUTH_ENABLED | Resultado |
|---------|-------------|-----------|
| Desarrollo | no definido o `false` | Auth desactivada, acceso libre |
| Desarrollo | `true` | Auth activada, requiere login |
| Produccion (`NODE_ENV=production`) | cualquier valor | Auth **siempre activa** |

### Credenciales por defecto

- Usuario: `admin`
- Contrasena: `admin`

**IMPORTANTE**: Cambiar la contrasena inmediatamente en produccion, ya sea via variable de entorno o desde la interfaz de configuracion.

### Cambio de contrasena

Dos formas de cambiar la contrasena del administrador:

1. **Desde la interfaz**: Configuracion > Cambiar contrasena (ingresa contrasena actual y nueva)
2. **Variable de entorno**: Cambiar `AUTH_ADMIN_PASSWORD` en `frontend/.env.local`

Cuando se cambia desde la interfaz, la nueva contrasena se guarda en `auth-config.json` en la raiz del proyecto. Este archivo tiene **prioridad** sobre la variable de entorno `AUTH_ADMIN_PASSWORD`.

Para resetear la contrasena al valor de la variable de entorno, eliminar `auth-config.json`.

### Rate limiting

Todas las API routes tienen limites de peticiones por IP (token bucket in-memory):

| Ruta | Limite |
|------|--------|
| POST `/api/token` (crear sesion) | 20/min |
| GET `/api/sessions` | 60/min |
| PUT `/api/sessions/notes` | 30/min |
| DELETE `/api/sessions/notes` | 10/min |
| GET `/api/conversations` | 60/min |
| GET `/api/conversations/[filename]` | 60/min |
| PUT `/api/auth/password` | 5/min |

Cuando se excede: respuesta HTTP 429. Los buckets se limpian cada 5 minutos de inactividad.

**Limitacion**: El rate limiter es in-memory. Se resetea al reiniciar el servidor y no se comparte entre instancias. Para clusters multi-instancia, implementar rate limiting con Redis.

### Headers de seguridad

Configurados automaticamente en `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Validacion de inputs

- **Personalidades**: Se validan contra un Set de 11 valores permitidos
- **Patient ID**: Sanitizado con regex (solo alfanumericos, guion, guion bajo)
- **Filenames**: Validados contra patrones esperados (ej: `YYYY-MM-DD_sesion_NNN.md`)
- **Path traversal**: Todos los paths se verifican con `resolve()` + validacion de prefijo

---

## Modelo LLM Configurable

### Modelo de conversacion (por personalidad)

El modelo LLM usado para las conversaciones se puede cambiar de dos formas:

1. **Desde el frontend**: Cada personalidad tiene su propia configuracion de modelo en Configuracion > Modelo LLM
2. **Default global**: `google/gemini-2.0-flash-001` (Gemini 2.0 Flash via OpenRouter)

Los modelos disponibles son todos los soportados por OpenRouter. Ejemplos:

| Modelo | Costo (input/output por 1M tokens) | Uso sugerido |
|--------|-------------------------------------|-------------|
| `google/gemini-2.0-flash-001` | $0.10 / $0.40 | Default, rapido y economico |
| `anthropic/claude-sonnet-4` | $3.00 / $15.00 | Mayor calidad de respuesta |
| `openai/gpt-4o` | $2.50 / $10.00 | Alternativa de alta calidad |
| `meta-llama/llama-3.1-70b-instruct` | $0.52 / $0.75 | Open source, buen balance |

La configuracion se guarda en `localStorage` del navegador y se transmite al agent via metadata de la sala LiveKit.

### Modelo de analisis (notas terapeuticas)

La generacion de notas clinicas post-sesion usa dos modelos:

| Tarea | Modelo | Variable |
|-------|--------|----------|
| Tareas simples (agenda) | Gemini 2.0 Flash (default del agente) | N/A |
| Analisis clinico (sesion, plan, resumen, temas, progreso) | Claude Sonnet 4 | `ANALYSIS_MODEL` |

Para cambiar el modelo de analisis, modificar `ANALYSIS_MODEL` en `agent/.env.local`.

---

## Gestion de Datos

### Estructura de almacenamiento

Todos los datos se almacenan como archivos en el filesystem del agent:

```
agent/
├── sessions/                    # Datos de Dra. Ana (por paciente)
│   └── {patient_id}/
│       ├── perfil.md            # Perfil del paciente (intake)
│       ├── resumen_general.md   # Resumen acumulativo
│       ├── agenda.md            # Agenda de proximas sesiones
│       ├── therapy_config.json  # Enfoque terapeutico + modalidad pareja
│       ├── sesiones/
│       │   └── YYYY-MM-DD_sesion_NNN.md
│       └── conclusiones/
│           ├── plan_terapeutico.md
│           ├── temas_recurrentes.md
│           └── progreso.md
├── conversations/               # Transcripciones de TODOS los agentes
│   └── {personality_key}/
│       └── YYYY-MM-DD_HH-MM.md
├── metrics.json                 # Metricas acumuladas
└── .env.local                   # Variables de entorno (no versionado)
```

### Archivos sensibles (no versionados)

Los siguientes directorios/archivos estan en `.gitignore`:

- `agent/sessions/` — Datos clinicos de pacientes
- `agent/conversations/` — Transcripciones de conversaciones
- `agent/metrics.json` — Metricas de uso
- `agent/.env.local` — Credenciales del agent
- `frontend/.env.local` — Credenciales del frontend
- `auth-config.json` — Contrasena persistida

### Respaldos

Se recomienda respaldar periodicamente:

- `agent/sessions/` — Datos criticos de pacientes
- `agent/conversations/` — Historiales de conversacion
- `auth-config.json` — Si se cambio la contrasena desde la UI

Los archivos son Markdown plano y JSON, legibles y portables.

### Limpieza de datos

- Las conversaciones se acumulan en `agent/conversations/{personalidad}/`
- Las sesiones de Dra. Ana se acumulan en `agent/sessions/{paciente}/sesiones/`
- No hay politica de retencion automatica; el administrador debe definir y ejecutar limpieza manual si es necesario

---

## Monitoreo y Metricas

### Dashboard de metricas

El frontend incluye un dashboard accesible que muestra:

- **Tokens LLM**: Total de tokens de entrada/salida consumidos
- **Costo estimado**: Basado en los precios del modelo usado
- **Uso STT**: Segundos de audio procesados por Deepgram
- **Uso TTS**: Caracteres sintetizados por Cartesia

Los datos se leen de `agent/metrics.json` via `GET /api/metrics`.

### Logs del agent

El agent usa el sistema de logging de Python. En desarrollo, los logs aparecen en la terminal. Informacion logueada:

- Conexion/desconexion de sesiones
- Personalidad y paciente detectados
- Numero de turnos en la transcripcion (sin contenido clinico)
- Errores en generacion de notas o guardado de archivos

**IMPORTANTE**: Los logs estan sanitizados y NO contienen contenido de conversaciones terapeuticas por privacidad.

---

## Despliegue en Produccion

### Arquitectura recomendada

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────>│ LiveKit Cloud │<────│    Agent     │
│  (Vercel)    │     │              │     │  (VPS con    │
│              │     └──────────────┘     │   Docker)    │
└──────────────┘                          └──────────────┘
```

### Frontend (Vercel recomendado)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno en el dashboard de Vercel:
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `AUTH_ENABLED=true`, `AUTH_SECRET`, `AUTH_ADMIN_USER`, `AUTH_ADMIN_PASSWORD`
3. Deploy automatico con cada push

### Agent (Docker recomendado)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY agent/ .
RUN pip install -e .
CMD ["python", "agent.py", "start"]
```

```bash
docker build -t comerciante-agent .
docker run -d \
  --name comerciante-agent \
  --env-file agent/.env.local \
  -v /data/sessions:/app/sessions \
  -v /data/conversations:/app/conversations \
  comerciante-agent
```

**Nota critica**: Montar volumenes persistentes para `sessions/` y `conversations/`. Sin volumenes, los datos se pierden al reiniciar el contenedor.

### Checklist de produccion

- [ ] `AUTH_ENABLED=true` en frontend
- [ ] `AUTH_SECRET` generado con `openssl rand -base64 32`
- [ ] `AUTH_ADMIN_PASSWORD` cambiado del default `admin`
- [ ] Volumenes persistentes montados para `sessions/` y `conversations/`
- [ ] Agent corriendo con `python agent.py start` (no `dev`)
- [ ] Variables de entorno configuradas en el proveedor de hosting
- [ ] Respaldo automatico de `agent/sessions/` configurado
- [ ] HTTPS habilitado (Vercel lo maneja automaticamente)

---

## Mantenimiento

### Actualizar el sistema

```bash
git pull origin main

# Agent
cd agent
source .venv/bin/activate
pip install -e .

# Frontend
cd frontend
pnpm install
pnpm build
```

### Resetear contrasena del administrador

Si se olvida la contrasena:

1. Eliminar `auth-config.json` de la raiz del proyecto
2. Reiniciar el frontend
3. La contrasena vuelve al valor de `AUTH_ADMIN_PASSWORD` en `.env.local`

### Agregar nuevas personalidades

1. Editar `agent/personalities.py`: agregar entrada en `PERSONALITIES` dict con `name`, `system_prompt`, `voice_id`, `description`
2. Editar `frontend/lib/personalities-config.ts`: agregar configuracion frontend con voz default, visualizador, temperatura
3. Agregar la key al `VALID_PERSONALITIES` Set en `frontend/app/api/token/route.ts`

### Cambiar voces de personalidad

Las voces se pueden cambiar de dos formas:

1. **Desde la interfaz**: Configuracion de la personalidad > Selector de voz (33 voces Cartesia en espanol)
2. **En codigo**: Modificar `voice_id` en `agent/personalities.py` (default) o `defaultVoice` en `frontend/lib/personalities-config.ts`

---

## Solucion de Problemas

### El agent no se conecta a LiveKit

- Verificar que `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` sean correctos en `agent/.env.local`
- Verificar que el agent este corriendo (`python agent.py dev`)
- Verificar conectividad a `wss://` del LiveKit Cloud

### No se escucha audio

- Verificar permisos de microfono en el navegador
- Verificar que `DEEPGRAM_API_KEY` y `CARTESIA_API_KEY` sean validos
- Revisar logs del agent para errores de STT/TTS

### Login no funciona

- Si `AUTH_ENABLED` no esta en `true`, el login puede ser saltado en desarrollo
- Verificar que `AUTH_SECRET` este configurado
- Si se cambio la contrasena y se olvido: eliminar `auth-config.json` y reiniciar

### Las notas de Dra. Ana no se generan

- Verificar que `OPENAI_API_KEY` (OpenRouter) tenga credito suficiente
- Si se configuro `ANALYSIS_MODEL`, verificar que el modelo exista en OpenRouter
- Revisar logs del agent para errores en `note_generator.py`
- Las notas se generan **al finalizar la sesion** (al desconectar), no durante la conversacion

### Error 429 (Too Many Requests)

- El rate limiter esta bloqueando peticiones. Esperar 1 minuto.
- Si es un problema recurrente, ajustar los limites en los archivos de API routes correspondientes

### Personalidad desconocida

- Si se pasa una personalidad no registrada, el agent usa `trader` como fallback
- Agregar la personalidad al `VALID_PERSONALITIES` Set y a `PERSONALITIES` dict
