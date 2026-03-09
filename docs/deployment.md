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
ANALYSIS_MODEL=anthropic/claude-sonnet-4  # Modelo para analisis clinico (notas post-sesion)
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

## Arquitectura de Produccion

```
Internet
   │
   ▼
┌─────────────────────────────┐
│  Nginx (SSL + reverse proxy)│  conversaciones.concurrir.com:443
│  Let's Encrypt certificates │
└─────────┬───────────────────┘
          │
          ▼ http://127.0.0.1:3004
┌─────────────────────────────┐     ┌──────────────┐
│  Frontend (Next.js)         │────▶│ LiveKit Cloud │
│  Puerto 3004                │     │              │
└─────────────────────────────┘     └──────┬───────┘
                                           │
┌─────────────────────────────┐            │
│  Agent (Python)             │◀───────────┘
│  Se conecta a LiveKit Cloud │
│  via WebSocket              │
└─────────────────────────────┘

Datos compartidos: /ruta/proyecto/data/ y /ruta/proyecto/users.json
```

Frontend y Agent corren en el mismo servidor. El Agent no necesita puerto expuesto — se conecta a LiveKit Cloud por WebSocket saliente.

## Deployment en VPS (Produccion)

### Requisitos del servidor

- **OS**: Ubuntu 22.04 / 24.04
- **RAM**: 2GB minimo (Agent Python ~250MB, Next.js ~200MB)
- **CPU**: 1-2 cores
- **Disco**: 10GB+ (datos clinicos crecen con el uso)
- **Software**: Node.js 20+, Python 3.12+, Nginx, Certbot

### Paso 1: Preparar el servidor

```bash
# Instalar dependencias del sistema
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx \
  python3.12 python3.12-venv nodejs npm git

# Instalar pnpm
npm install -g pnpm@9

# Crear usuario de aplicacion (opcional, recomendado)
sudo useradd -m -s /bin/bash conversaciones
sudo su - conversaciones
```

### Paso 2: DNS

Crear un registro A en tu proveedor de DNS:

```
conversaciones.concurrir.com  →  <IP_DEL_SERVIDOR>
```

Esperar a que propague (puede tardar minutos u horas).

### Paso 3: Clonar y configurar el proyecto

```bash
cd /home/conversaciones  # o la ruta que prefieras
git clone <repo_url> "Comerciante con voz"
cd "Comerciante con voz"

# Configurar variables de entorno del frontend
cp frontend/.env.example frontend/.env.local
nano frontend/.env.local
# Asegurar: AUTH_ENABLED=true, AUTH_SECRET generado, keys de servicios

# Configurar variables de entorno del agent
nano agent/.env.local
# Agregar todas las keys de servicios
```

**Generar AUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Paso 4: Build del Frontend

```bash
cd frontend
pnpm install
pnpm build
```

### Paso 5: Configurar el Agent

```bash
cd ../agent
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Paso 6: Certificado SSL con Let's Encrypt

```bash
# Configuracion temporal de Nginx para validacion
sudo tee /etc/nginx/sites-available/conversaciones <<'EOF'
server {
    listen 80;
    server_name conversaciones.concurrir.com;
    location / {
        return 200 'ok';
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/conversaciones /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Obtener certificado
sudo certbot --nginx -d conversaciones.concurrir.com
```

### Paso 7: Configurar Nginx como reverse proxy

```bash
sudo tee /etc/nginx/sites-available/conversaciones <<'NGINX'
server {
    listen 80;
    server_name conversaciones.concurrir.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name conversaciones.concurrir.com;

    ssl_certificate /etc/letsencrypt/live/conversaciones.concurrir.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/conversaciones.concurrir.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Seguridad
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts largos para WebSocket de LiveKit
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX

sudo nginx -t && sudo systemctl reload nginx
```

### Paso 8: Servicios systemd

Crear servicios para que frontend y agent se ejecuten automaticamente y se reinicien si fallan.

**Frontend** — `/etc/systemd/system/conversaciones-frontend.service`:

```ini
[Unit]
Description=Conversaciones con Voz - Frontend
After=network.target

[Service]
Type=simple
User=conversaciones
WorkingDirectory=/home/conversaciones/Comerciante con voz/frontend
ExecStart=/usr/bin/npx next start --port 3004
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Agent** — `/etc/systemd/system/conversaciones-agent.service`:

```ini
[Unit]
Description=Conversaciones con Voz - Agent
After=network.target

[Service]
Type=simple
User=conversaciones
WorkingDirectory=/home/conversaciones/Comerciante con voz/agent
ExecStart=/home/conversaciones/Comerciante con voz/agent/.venv/bin/python agent.py start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Activar y arrancar:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable conversaciones-frontend conversaciones-agent
sudo systemctl start conversaciones-frontend conversaciones-agent

# Verificar estado
sudo systemctl status conversaciones-frontend
sudo systemctl status conversaciones-agent

# Ver logs en tiempo real
sudo journalctl -u conversaciones-frontend -f
sudo journalctl -u conversaciones-agent -f
```

### Paso 9: Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirect a HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

Los puertos internos (3004 del frontend, puerto dinamico del agent) solo escuchan en localhost y no necesitan abrirse.

### Paso 10: Renovacion automatica de SSL

Certbot instala un timer de systemd automaticamente. Verificar:

```bash
sudo systemctl status certbot.timer
```

El certificado se renueva automaticamente cada ~60 dias.

## Datos Persistentes

El sistema almacena datos en el directorio `data/` del proyecto, organizados por usuario:

```
data/
├── admin/
│   ├── sessions/           # Datos de pacientes (Dra. Ana)
│   │   └── paciente_1/
│   │       ├── perfil.md
│   │       ├── therapy_config.json
│   │       ├── sesiones/
│   │       └── conclusiones/
│   ├── conversations/      # Transcripciones de conversaciones (todos)
│   │   ├── trader/
│   │   ├── hippy/
│   │   └── psicologo/
│   └── metrics.json        # Metricas de uso
├── ellaguno/
│   ├── sessions/
│   ├── conversations/
│   └── metrics.json
users.json                  # Usuarios y credenciales (raiz del proyecto)
```

**En produccion:**

- Hacer backup regular de `data/` y `users.json` (contienen datos clinicos sensibles)
- Si se usa Docker, montar `data/` y `users.json` como volumenes persistentes
- Los pacientes eliminados se conservan como `{id}_deleted_{timestamp}` en el directorio de sesiones

## Actualizaciones

```bash
cd "/home/conversaciones/Comerciante con voz"
git pull

# Rebuild frontend
cd frontend
pnpm install
pnpm build

# Reinstalar agent si hay cambios en dependencias
cd ../agent
source .venv/bin/activate
pip install -e .

# Reiniciar servicios
sudo systemctl restart conversaciones-frontend conversaciones-agent
```

## Servicios Externos

| Servicio | Proposito | Tier Gratuito |
|----------|----------|---------------|
| [LiveKit Cloud](https://cloud.livekit.io) | Transporte de audio WebRTC | Si (limitado) |
| [Deepgram](https://deepgram.com) | Speech-to-Text | Si ($200 creditos iniciales) |
| [OpenRouter](https://openrouter.ai) | LLM Gateway | Pay-per-use |
| [Cartesia](https://cartesia.ai) | Text-to-Speech | Si (limitado) |

## Troubleshooting

### El frontend no arranca
```bash
sudo journalctl -u conversaciones-frontend -n 50
# Verificar que el build existe:
ls frontend/.next/
# Si no existe, hacer build: cd frontend && pnpm build
```

### El agent no se conecta
```bash
sudo journalctl -u conversaciones-agent -n 50
# Verificar env vars:
cat agent/.env.local
# Verificar que el venv funciona:
cd agent && source .venv/bin/activate && python -c "import livekit; print('OK')"
```

### Error 502 Bad Gateway en Nginx
El frontend no esta corriendo. Verificar:
```bash
sudo systemctl status conversaciones-frontend
curl http://127.0.0.1:3004/  # Debe responder (302 redirect a /login)
```

### Datos no se guardan / van a directorio incorrecto
Verificar permisos del directorio `data/`:
```bash
ls -la data/
# El usuario del servicio debe tener permisos de escritura
sudo chown -R conversaciones:conversaciones data/ users.json
```

### Certificado SSL expiro
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Documentacion Adicional

- **[seguridad.md](seguridad.md)** — Analisis de vulnerabilidades y 7 capas de seguridad
- **[guia-administrador.md](guia-administrador.md)** — Guia completa de instalacion, configuracion y mantenimiento
- **[guia-usuario.md](guia-usuario.md)** — Guia de uso para usuarios finales

## Monitoreo

- **Metricas internas**: El agente guarda metricas por usuario en `data/{userId}/metrics.json` (tokens, costo, uso)
- **Dashboard**: El frontend muestra estas metricas via `/api/metrics`
- **Logs de sistema**: `journalctl -u conversaciones-frontend` y `journalctl -u conversaciones-agent`
- Para produccion avanzada, considerar integrar OpenTelemetry (ya incluido como dependencia)
