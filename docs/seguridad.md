# Seguridad - Comerciante con Voz

## Estado de Implementacion

| Capa | Estado | Descripcion |
|------|--------|-------------|
| Capa 1: Autenticacion | Implementado | NextAuth.js con middleware, login, credentials, cambio de contrasena |
| Capa 2: Autorizacion por paciente | Pendiente | Requiere BD de usuarios con relacion usuario-paciente |
| Capa 3: Path traversal | Implementado | Validacion de filenames, `isPathSafe()`, sanitizacion en agent y SessionManager |
| Capa 4: Rate limiting | Implementado | Token bucket in-memory en todas las API routes |
| Capa 5: Headers de seguridad | Implementado | X-Content-Type-Options, X-Frame-Options, Referrer-Policy en next.config.ts |
| Capa 6: Datos sensibles | Parcial | Logs sanitizados (implementado). Encripcion en reposo (pendiente) |
| Capa 7: Seguridad del agent | Implementado | MAX_TRANSCRIPT_TURNS, maxParticipants, warning de personalidad desconocida |

---

## Capa 1: Autenticacion (Implementado)

### Archivos

- `frontend/lib/auth.ts` — Configuracion de NextAuth.js v5 con CredentialsProvider
- `frontend/middleware.ts` — Protege todas las rutas excepto login y assets
- `frontend/app/api/auth/[...nextauth]/route.ts` — Handler de NextAuth
- `frontend/app/api/auth/password/route.ts` — Endpoint para cambio de contrasena
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

### Cambio de Contrasena

- Disponible desde la pagina de Configuracion
- PUT `/api/auth/password` valida contrasena actual y guarda la nueva en `auth-config.json`
- Rate limited a 5 peticiones por minuto
- `auth-config.json` se lee antes que las variables de entorno (prioridad)

### Logout

- Boton "Salir" en la pantalla principal
- Llama a `signOut()` de NextAuth y redirige a `/login`

### Notas

- El guard `NODE_ENV !== 'development'` fue removido de `/api/token` (reemplazado por auth)
- La personalidad se valida contra un Set de 11 valores permitidos en el token route
- El `patientId` se sanitiza en el token route antes de usarse en el room name
- `therapyMethod` se acepta como string libre (validado en el agent contra THERAPY_METHODS)

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
- `VALID_PERSONALITIES` — Set con las 11 personalidades validas
- `patientId` se sanitiza con regex antes de usarse en room name

**`frontend/app/api/conversations/[filename]/route.ts`**:
- `isValidFilename()` — Solo acepta formato `YYYY-MM-DD_HH-MM.md`
- `isValidPersonality()` — Solo alfanumerico, guion y guion bajo
- Path traversal check con `resolve()` + prefijo

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
| POST `/api/token` | 20/min por IP | `token:{ip}` |
| GET `/api/sessions` | 60/min por IP | `sessions:{ip}` |
| PUT `/api/sessions/notes` | 30/min por IP | `notes-put:{ip}` |
| DELETE `/api/sessions/notes` | 10/min por IP | `notes-del:{ip}` |
| GET `/api/conversations` | 60/min por IP | `conversations:{ip}` |
| GET `/api/conversations/[filename]` | 60/min por IP | `conv-file:{ip}` |
| PUT `/api/auth/password` | 5/min por IP | `password:{ip}` |

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

Los logs ya no contienen contenido de las conversaciones terapeuticas:
```python
logger.info(f"Transcripcion [{item.role}]: {len(text)} caracteres")
```

### Pendiente: Encripcion en reposo

Las sesiones y conversaciones se almacenan como archivos .md en texto plano. Opciones para produccion:

1. **Encripcion de disco**: LUKS (Linux), EBS encrypted (AWS), Persistent Disk encrypted (GCP)
2. **Migracion a BD**: PostgreSQL con `pgcrypto` para encripcion de columnas
3. **Backups**: Usar herramientas de backup con encripcion (restic, borgbackup)
4. **Politica de retencion**: Definir tiempo maximo de conservacion de datos clinicos

---

## Capa 7: Seguridad del Agent (Implementado)

### Limite de transcripcion

```python
MAX_TRANSCRIPT_TURNS = 500
```

Si la transcripcion alcanza 500 turnos, se ignoran los adicionales con un warning en el log.

### Limite de participantes por sala

```typescript
maxParticipants: 2  // solo el usuario y el agente
```

### Warning de personalidad desconocida

Si el room name contiene una personalidad que no existe en `PERSONALITIES`, se loguea un warning y se usa la personalidad por defecto (`trader`) como fallback.

### Validacion de metodo terapeutico

El agent valida `therapyMethod` contra `THERAPY_METHODS` dict. Si el valor no existe, usa `DEFAULT_THERAPY_METHOD` (CBT) como fallback.

---

## Variables de Entorno de Seguridad

```env
# frontend/.env.local
AUTH_ENABLED=true              # Activar autenticacion (siempre activa en produccion)
AUTH_SECRET=<random_base64>    # Secreto para firmar JWTs de sesion
AUTH_ADMIN_USER=admin          # Usuario administrador
AUTH_ADMIN_PASSWORD=<seguro>   # Contrasena del administrador
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
