# Demo: Venta de Seguros

## Descripcion General

La demo de Venta de Seguros es una seccion de acceso publico (sin password) que permite practicar ventas de seguros con agentes de IA. Accesible en `/demo/seguros`.

Utiliza **Gemini 3 Flash** (preview) via OpenRouter para conversaciones mas inteligentes y naturales.

---

## Modos de Uso

### Modo 1: "Que te vendan" (IA es el vendedor)

Un agente de IA actua como vendedor de seguros e intenta venderte una poliza. Tu eres el prospecto y puedes practicar objeciones, escuchar tecnicas de venta y evaluar diferentes estilos.

**Perfiles de vendedor:**

| Perfil | Estilo | Descripcion |
|--------|--------|-------------|
| **Agresivo** | Presion alta | Usa urgencia, escasez, miedo. Interrumpe objeciones, insiste en cerrar rapido |
| **Asertivo** | Profesional | Escucha, hace preguntas consultivas, maneja objeciones con datos y empatia |
| **Pasivo** | Timido | Da informacion pero no pide la venta, acepta objeciones facilmente, se disculpa mucho |

### Modo 2: "Practica ventas" (IA es el prospecto)

Tu actuas como vendedor y el agente IA simula un prospecto/cliente potencial. El agente te evalua en tiempo real mostrando:

- **Emocion actual**: Como se siente el prospecto (confianza, interes, desconfianza, etc.)
- **Intencion de compra**: Porcentaje de 0% a 100% que cambia segun tu desempeno
- **Notas**: Explicacion de que le hizo sentir asi
- **Calificacion final**: Al cerrar la conversacion, muestra si cerraste la venta, abriste a seguimiento o perdiste la venta, con puntaje de 1 a 10

**Perfiles de prospecto:**

| Perfil | Dificultad | Descripcion |
|--------|-----------|-------------|
| **Facil** | Baja | Interesado, con presupuesto, reconoce la necesidad. Solo necesita un poco de convencimiento |
| **Normal** | Media | Dudas legitimas sobre precio, coberturas y necesidad. Abierto a escuchar pero pide comparativas |
| **Dificil** | Alta | Esceptico, desconfiado, muchas objeciones. Intenta terminar la conversacion varias veces |

---

## Tipos de Seguro

| Tipo | Cobertura |
|------|----------|
| **Seguro de Vida** | Fallecimiento, invalidez, ahorro y beneficios en vida |
| **Gastos Medicos Mayores** | Hospitalizacion, cirugias, medicamentos, maternidad, dental |

---

## Panel de Evaluacion en Vivo

En el modo "Practica ventas", se muestra un panel lateral derecho con evaluacion en tiempo real:

### Emociones

El prospecto reporta su estado emocional periodicamente. Las emociones posibles son:

| Emocion | Indicador | Significado |
|---------|-----------|-------------|
| Confianza | Verde | El vendedor le genera seguridad |
| Interes | Azul | Esta prestando atencion activa |
| Curiosidad | Cyan | Quiere saber mas |
| Entusiasmo | Verde esmeralda | Esta emocionado con la oferta |
| Incredulidad | Amarillo | No cree del todo lo que le dicen |
| Desconfianza | Naranja | Sospecha de las intenciones del vendedor |
| Molestia | Rojo claro | Algo le incomodo |
| Agresividad | Rojo | Esta enojado o a la defensiva |
| Bloqueo | Gris | Se cerro completamente a escuchar |
| Aburrimiento | Gris claro | Perdio el interes |

### Intencion de Compra

Barra de progreso de 0% a 100%:
- **0-30%** (rojo): No compraria
- **40-60%** (amarillo): Indeciso
- **70-100%** (verde): Quiere comprar

### Calificacion Final

Al terminar la conversacion, el prospecto emite un veredicto:

| Resultado | Significado |
|-----------|-------------|
| **Cerro la venta** | El vendedor logro que el prospecto aceptara comprar |
| **Abrio a seguimiento** | No compro pero acepto una segunda cita o llamada |
| **Perdio la venta** | El prospecto se fue sin interes en continuar |

Incluye un puntaje de 1 a 10 y un resumen explicando que hizo bien y que hizo mal el vendedor.

---

## Arquitectura Tecnica

### Acceso sin autenticacion

- La ruta `/demo/seguros` esta en `PUBLIC_PATHS` (auth.ts)
- El token route acepta personalidades `demo_*` sin sesion de usuario
- Se genera un userId temporal basado en IP: `demo_{ip}`
- No requiere que `guestEnabled` este activo en settings

### Personalidades (Backend)

4 personalidades en `agent/personalities.py`:

| Key | Tipo | Descripcion |
|-----|------|-------------|
| `demo_vendedor_vida` | Vendedor | Agente que vende seguro de vida |
| `demo_vendedor_gastos` | Vendedor | Agente que vende gastos medicos |
| `demo_cliente_vida` | Prospecto | Simula prospecto para seguro de vida |
| `demo_cliente_gastos` | Prospecto | Simula prospecto para gastos medicos |

El perfil (agresivo/asertivo/pasivo o facil/normal/dificil) se pasa como `demoProfile` en los metadatos de la sala LiveKit y se inyecta en el system prompt del agente.

### Herramientas de Evaluacion (agent/demo_tools.py)

Los agentes prospecto (`demo_cliente_*`) tienen 2 function calling tools:

1. **`actualizar_estado`**: El agente la invoca cada 2-3 intercambios para reportar su emocion, intencion de compra (0-100) y notas explicativas
2. **`calificar_venta`**: El agente la invoca al cierre para dar el resultado final, un resumen y un puntaje (1-10)

Estas herramientas publican mensajes de datos via el canal de datos de LiveKit (`room.local_participant.publish_data`). El frontend escucha estos mensajes con `RoomEvent.DataReceived` y actualiza el panel en tiempo real.

### Modelo LLM

Las personalidades de demo usan **Gemini 3 Flash** (`google/gemini-3-flash-preview`) via OpenRouter, en lugar del Gemini 2.0 Flash default. Esto proporciona respuestas mas inteligentes y naturales para la simulacion de ventas.

### Flujo de Datos

```
Frontend: Usuario selecciona modo + seguro + perfil
  -> POST /api/token { personality: "demo_cliente_vida", demoProfile: "normal" }
  -> Se crea sala LiveKit con metadata incluyendo demoProfile
  -> Agente Python se despacha automaticamente
  -> Agente lee demoProfile de metadata y ajusta comportamiento
  -> (Solo prospecto) Agente llama actualizar_estado periodicamente
     -> publish_data({ type: "demo_estado", emocion, intencion, notas })
     -> Frontend recibe via RoomEvent.DataReceived -> actualiza panel
  -> Al cerrar, agente llama calificar_venta
     -> publish_data({ type: "demo_calificacion", resultado, resumen, puntaje })
     -> Frontend muestra resultado final en panel
```

### Archivos

| Archivo | Descripcion |
|---------|-------------|
| `frontend/app/demo/seguros/page.tsx` | Pagina Next.js (server component) |
| `frontend/app/demo/seguros/demo-seguros.tsx` | Componente principal del demo (client component) |
| `agent/demo_tools.py` | Function tools para evaluacion del prospecto |
| `agent/personalities.py` | Definicion de 4 personalidades demo |
| `frontend/lib/personalities-config.ts` | Configuracion frontend (voces, modelo, visualizador) |
| `personality-defaults.json` | Override de modelo a Gemini 3 Flash |

---

## Limitaciones

- Las conversaciones demo no se guardan en el historial del usuario (no hay sesion persistente)
- No hay limite de tiempo como en el modo guest
- El panel de evaluacion solo aparece en modo "Practica ventas" (cuando el usuario es el vendedor)
- La evaluacion depende de que el LLM invoque las herramientas correctamente; Gemini 3 Flash tiene buen soporte de function calling pero no es 100% garantizado en cada turno
