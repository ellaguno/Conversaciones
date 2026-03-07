# Seguridad - Comerciante con Voz

## Estado de Implementacion

| Capa | Estado | Descripcion |
|------|--------|-------------|
| Capa 1: Autenticacion | Implementado | NextAuth.js con middleware, login page, credentials provider |
| Capa 2: Autorizacion por paciente | Pendiente | Requiere BD de usuarios con relacion usuario-paciente |
| Capa 3: Path traversal | Implementado | Validacion de filenames, `isPathSafe()`, sanitizacion en agent y SessionManager |
| Capa 4: Rate limiting | Implementado | Token bucket in-memory en todas las API routes |
| Capa 5: Headers de seguridad | Implementado | X-Content-Type-Options, X-Frame-Options, Referrer-Policy en next.config.ts |
| Capa 6: Datos sensibles | Parcial | Logs sanitizados (implementado). Encripcion en reposo (pendiente) |
| Capa 7: Seguridad del agent | Implementado | MAX_TRANSCRIPT_TURNS, maxParticipants, warning de personalidad desconocida |

---

## Capa 1: Autenticacion (Implementado)

### Archivos creados/modificados

- `frontend/lib/auth.ts` — Configuracion de NextAuth.js v5 con CredentialsProvider
- `frontend/middleware.ts` — Protege todas las rutas excepto login y assets
- `frontend/app/api/auth/[...nextauth]/route.ts` — Handler de NextAuth
- `frontend/app/login/page.tsx` — Pagina de login

### Configuracion

La autenticacion esta **desactivada por defecto** en desarrollo. Para activarla:

```env
# En frontend/.env.local
AUTH_ENABLED=true
AUTH_SECRET=<generar_con_openssl_rand_base64_32>
AUTH_ADMIN_USER=admin
AUTH_ADMIN_PASSWORD=<password_seguro>
```

En produccion (`NODE_ENV=production`), la autenticacion esta **siempre activa**.

### Flujo

1. Usuario accede a cualquier ruta
2. Middleware verifica sesion JWT via NextAuth
3. Si no esta autenticado, redirige a `/login`
4. Login valida contra `AUTH_ADMIN_USER`/`AUTH_ADMIN_PASSWORD`
5. Se genera JWT de sesion

### Notas

- El guard `NODE_ENV !== 'development'` fue removido de `/api/token` (reemplazado por auth)
- La personalidad se valida contra un Set de valores permitidos en el token route
- El `patientId` se sanitiza en el token route antes de usarse en el room name

---

## Capa 2: Autorizacion por Paciente (Pendiente)

Requiere una base de datos con el modelo:

```
users (id, name, email, role)
patient_access (user_id, patient_id)
```

Cada API route de sesiones deberia verificar que el usuario autenticado tenga acceso al paciente solicitado. Esto queda pendiente hasta migrar de archivos .md a una BD.

---

## Capa 3: Validacion de Inputs / Path Traversal (Implementado)

### Frontend

**`frontend/app/api/sessions/[filename]/route.ts`**:
- `isValidSessionFilename()` — Solo acepta formato `YYYY-MM-DD_sesion_NNN.md`
- `isPathSafe()` — Verifica que el path resuelto quede dentro de `SESSIONS_BASE`

**`frontend/app/api/sessions/notes/route.ts`**:
- `VALID_NOTE_TYPES` — Set con los tipos permitidos
- `isValidSessionFilename()` — Valida filename para tipo `session`
- `isPathSafe()` — Verifica path en PUT y DELETE

**`frontend/app/api/token/route.ts`**:
- `VALID_PERSONALITIES` — Set que valida la personalidad recibida
- `patientId` se sanitiza con regex antes de usarse en room name

### Agent

**`agent/agent.py`**:
- `patient_id` se sanitiza con `re.sub(r'[^a-zA-Z0-9_-]', '', raw_id)` al parsearlo del room name

**`agent/session_manager.py`**:
- El constructor sanitiza el `patient_id` con la misma regex
- Verifica con `is_relative_to()` que el path del paciente quede dentro de `SESSIONS_DIR`
- Si el ID queda vacio tras sanitizar, usa `"default"`

---

## Capa 4: Rate Limiting (Implementado)

**Archivo**: `frontend/lib/rate-limit.ts`

Implementacion: Token bucket in-memory, sin dependencias externas. Limpieza automatica de buckets inactivos cada 5 minutos.

### Limites configurados

| Ruta | Limite | Clave |
|------|--------|-------|
| POST `/api/token` | 5/min por IP | `token:{ip}` |
| GET `/api/sessions` | 60/min por IP | `sessions:{ip}` |
| PUT `/api/sessions/notes` | 30/min por IP | `notes-put:{ip}` |
| DELETE `/api/sessions/notes` | 10/min por IP | `notes-del:{ip}` |

Respuesta cuando se excede: HTTP 429 Too Many Requests.

### Limitaciones

- In-memory: se resetea al reiniciar el servidor
- No distribuido: en un cluster multi-instancia, cada instancia tiene su propio contador
- Para produccion con multiples instancias, considerar Redis o Upstash

---

## Capa 5: Headers de Seguridad (Implementado)

**Archivo**: `frontend/next.config.ts`

Headers aplicados a todas las rutas (`/:path*`):

| Header | Valor | Proposito |
|--------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previene MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Previene clickjacking via iframe |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limita informacion en el referer |

### Pendiente

- **Content-Security-Policy**: Requiere ajuste fino por los recursos externos (LiveKit, fonts, etc.)
- **CORS explicito**: No implementado aun. Next.js por defecto no permite cross-origin en API routes, pero en produccion conviene configurar CORS explicitamente con whitelist de dominios

---

## Capa 6: Proteccion de Datos Sensibles (Parcial)

### Implementado: Logs sanitizados

**Archivo**: `agent/agent.py`

Antes:
```python
logger.info(f"Transcripción [{item.role}]: {text[:80]}...")
```

Ahora:
```python
logger.info(f"Transcripción [{item.role}]: {len(text)} caracteres")
```

Los logs ya no contienen contenido de las conversaciones terapeuticas.

### Pendiente: Encripcion en reposo

Las sesiones se almacenan como archivos .md en texto plano. Opciones para produccion:

1. **Encripcion de disco**: LUKS (Linux), EBS encrypted (AWS), Persistent Disk encrypted (GCP)
2. **Migracion a BD**: PostgreSQL con `pgcrypto` para encripcion de columnas
3. **Backups**: Usar herramientas de backup con encripcion (restic, borgbackup)
4. **Politica de retencion**: Definir tiempo maximo de conservacion de datos clinicos

---

## Capa 7: Seguridad del Agent (Implementado)

### Limite de transcripcion

**Archivo**: `agent/agent.py`

```python
MAX_TRANSCRIPT_TURNS = 500
```

Si la transcripcion alcanza 500 turnos, se ignoran los adicionales con un warning en el log. Esto previene crecimiento ilimitado de memoria.

### Limite de participantes por sala

**Archivo**: `frontend/app/api/token/route.ts`

```typescript
maxParticipants: 2  // solo el usuario y el agente
```

Previene que multiples usuarios se unan a la misma sala.

### Warning de personalidad desconocida

**Archivo**: `agent/agent.py`

Si el room name contiene una personalidad que no existe en `PERSONALITIES`, se loguea un warning. El agente usa la personalidad por defecto (`trader`) como fallback.

---

## Variables de Entorno de Seguridad

```env
# frontend/.env.local
AUTH_ENABLED=true              # Activar autenticacion (siempre activa en produccion)
AUTH_SECRET=<random_base64>    # Secreto para firmar JWTs de sesion
AUTH_ADMIN_USER=admin          # Usuario administrador
AUTH_ADMIN_PASSWORD=<seguro>   # Contraseña del administrador
```

Generar `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## Pendiente para Produccion

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Autorizacion por paciente (Capa 2) | P2 | Medio — requiere BD |
| Content-Security-Policy header | P2 | Bajo — requiere ajuste fino |
| CORS explicito con whitelist | P2 | Bajo |
| Encripcion de datos en reposo | P3 | Alto — requiere infraestructura |
| Rate limiting distribuido (Redis) | P3 | Medio — solo si hay multiples instancias |
| Multiples usuarios con roles | P3 | Alto — requiere BD de usuarios |
