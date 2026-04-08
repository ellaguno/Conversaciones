# Plan: cifrado en disco de notas y transcripciones

## Objetivo y alcance

Hacer que **todos los `.md` que el sistema escribe en `data/`** queden ilegibles
con `cat`, pero se sirvan en claro cuando el usuario los lee desde la UI o los
recibe por correo.

No es protección contra un atacante con root y la clave en mano (la clave vive
en el mismo servidor), pero sí cubre:

- Backups en claro.
- Lecturas casuales / `cat` accidental.
- Fugas de archivos sueltos.
- Scraping del filesystem.

Si en el futuro queremos subir el listón (KMS, clave derivada del login del
usuario, etc.) este plan deja la base hecha.

## Archivos que escriben/leen notas hoy

### Python (agente)

- `agent/conversation_log.py:53` — transcripciones
  `data/{user}/conversations/{personality}/YYYY-MM-DD_HH-MM.md`.
- `agent/session_manager.py` — write en `:129,132,135,139,142,145,148`,
  read en `:76,103`. Cubre `perfil.md`, `agenda.md`, `resumen_general.md`,
  `sesiones/*.md`, `conclusiones/{plan_terapeutico,temas_recurrentes,progreso}.md`.
- `agent/summary_generator.py:48,105` — `summary.md` por personalidad.
- `agent/note_generator.py` — entry point de generación de notas.
- `agent/recover_notes.py:27` — recuperación a partir de transcripciones.

### Frontend (Next.js, lectura/edición/correo)

- `frontend/app/api/conversations/[filename]/route.ts` (GET / DELETE)
- `frontend/app/api/conversations/email/route.ts`
- `frontend/app/api/conversations/route.ts` (listado)
- `frontend/app/api/sessions/[filename]/route.ts`
- `frontend/app/api/sessions/notes/route.ts` (GET / PUT / DELETE)
- `frontend/app/api/sessions/email/route.ts`
- `frontend/app/api/sessions/route.ts`
- Cualquier otro consumidor que lea `perfil.md` / `agenda.md` directo desde
  disco para mostrar en la vista de notas.

`therapy_config.json`, `metrics.json` y `users.json` quedan **fuera** (no son
notas; se mantienen en claro).

## Diseño criptográfico

- **Algoritmo:** AES-256-GCM (autenticado, evita manipulación silenciosa).
  - Python: `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
  - Node: `node:crypto` con `createCipheriv('aes-256-gcm', …)`.
  - Mismo formato binario en ambos lados.
- **Clave:** una sola clave maestra de 32 bytes en env var
  `NOTES_ENCRYPTION_KEY` (codificada en base64). Cargada por agente y frontend.
  Se almacena en `.env` / `EnvironmentFile` de systemd, fuera de git.
- **Formato del archivo en disco** (la extensión sigue siendo `.md` para no
  romper rutas/regex existentes):

  ```
  CONVENC1\n              ← magic + versión (9 bytes)
  <12 bytes nonce>
  <16 bytes tag GCM>
  <ciphertext...>         ← markdown UTF-8 cifrado
  ```

  El magic permite distinguir archivos cifrados de los legacy en claro durante
  la migración.
- **AAD (datos asociados):** ruta relativa del archivo
  (`{user}/sessions/{patient}/perfil.md`). Así un archivo cifrado no se puede
  mover a otra ruta y seguir validando: protege contra reordenado malicioso.

## Implementación

### Paso 1 — módulo cripto compartido (mismo formato, dos lenguajes)

- `agent/notes_crypto.py` con:
  - `encrypt_note(path: Path, plaintext: str) -> bytes`
  - `decrypt_note(path: Path) -> str`
  - `is_encrypted(path: Path) -> bool`
  - `read_note(path: Path) -> str` (auto-detecta cifrado vs legacy)
  - `write_note(path: Path, text: str) -> None` (siempre cifra)
- `frontend/lib/notes-crypto.ts` con la misma API:
  - `readNote(absPath: string): string`
  - `writeNote(absPath: string, content: string): void`
  - `isEncrypted(buf: Buffer): boolean`
- Tests cruzados: cifrar en Python y descifrar en Node, y viceversa, con un
  fixture compartido en `scripts/`.

### Paso 2 — sustituir todas las llamadas de I/O de notas

Reemplazar puntualmente, **no globalmente**:

- En Python, donde haya `path.write_text(content, encoding="utf-8")` para un
  `.md` de notas → `write_note(path, content)`. Donde haya
  `path.read_text(encoding="utf-8")` para esos mismos archivos →
  `read_note(path)`.
- En TS, donde haya `readFileSync(filePath, 'utf-8')` y
  `writeFileSync(filePath, content, 'utf-8')` en las rutas listadas →
  `readNote(filePath)` / `writeNote(filePath, content)`.
- Las rutas de email (`conversations/email`, `sessions/email`) llaman a
  `readNote` y mandan el texto descifrado tal cual al template — no requieren
  más cambios.
- DELETE y listado de directorios no cambian.

### Paso 3 — capa de compatibilidad legacy

`read_note` debe:

1. Leer los primeros 9 bytes; si son `CONVENC1\n`, descifrar.
2. Si no, asumir markdown en claro (legacy) y devolverlo tal cual.

Esto permite arrancar en producción sin migrar de inmediato; los archivos se
van re-cifrando "naturalmente" cuando se actualizan, y el script del paso 4
termina el resto.

### Paso 4 — script de migración

`scripts/encrypt_existing_notes.py`:

- Recorre:
  - `data/*/conversations/**/*.md`
  - `data/*/sessions/**/*.md`
  - `data/*/sessions/**/conclusiones/*.md`
  - `perfil.md`, `agenda.md`, `resumen_general.md`, `summary.md`
- Para cada archivo: si `is_encrypted` → skip; si no → leer, cifrar, escribir
  atómico (`tempfile` + `os.replace`).
- Modo `--dry-run` por defecto, `--apply` para ejecutar.
- Antes de correrlo: snapshot/`tar` de `data/` por si algo sale mal.

### Paso 5 — clave y despliegue

- Generar clave:
  ```bash
  python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
  ```
- Añadir `NOTES_ENCRYPTION_KEY` al `.env` del agente y del frontend (mismo
  valor). Verificar que `.env*` está en `.gitignore`.
- Documentar en `docs/seguridad.md`:
  - Dónde vive la clave.
  - Cómo rotarla (script de re-cifrado: descifra con clave vieja, cifra con
    nueva).
  - Qué pasa si se pierde (los notes son irrecuperables — es el trade-off).
- Si el proceso corre bajo systemd: usar
  `EnvironmentFile=/etc/conversa/notes.env` con `chmod 600`.

### Paso 6 — pruebas

- Unit test del módulo crypto en ambos lenguajes:
  - Round-trip básico.
  - AAD mismatch debe fallar.
  - Archivo legacy se devuelve igual.
- Test de integración mínimo:
  1. Crear sesión vía agente.
  2. `cat data/.../sesiones/*.md` debe mostrar binario con magic `CONVENC1`.
  3. API `/api/sessions/[filename]` devuelve JSON con markdown legible.
  4. Endpoint de email envía correo con el contenido legible.
- Verificar manualmente con un usuario real (`admin/eduardo_llaguno`) tras
  correr la migración.

## Riesgos y notas

- **Pérdida de la clave = pérdida de todas las notas.** Documentar respaldo de
  la clave (gestor de secretos, sobre físico, etc.) antes de migrar.
- **`grep` y búsquedas sobre `data/` dejan de funcionar.** Si hay scripts ops
  que dependen de esto, hay que adaptarlos (descifrar al vuelo).
- **Backups** ahora son cifrados — bueno para confidencialidad, pero el
  restore depende de tener la clave.
- **No protege contra un atacante con shell en el server**: con la env var
  visible puede leer todo. Subir el listón (KMS, clave por usuario derivada
  de su passphrase de login) queda fuera de este plan.
- `metrics.json`, `users.json` y `therapy_config.json` siguen en claro.

## Orden sugerido de PRs

1. Módulo `notes_crypto` (Python + TS) + tests + doc de clave. Sin tocar nada
   más. **Mergeable solo.**
2. Sustitución de I/O en agente Python + lectura legacy. Deploy con la clave
   ya configurada.
3. Sustitución de I/O en rutas Next.js + verificación de email.
4. Script de migración + ejecución en producción tras snapshot.
5. (Opcional) Limpiar la rama legacy de `read_note` después de confirmar 0
   archivos en claro.
