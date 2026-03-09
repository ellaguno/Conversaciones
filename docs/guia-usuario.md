# Guia del Usuario - Comerciante con Voz v0.6.0

## Que es Comerciante con Voz

Comerciante con Voz es una plataforma de conversacion por voz en tiempo real con 11 personalidades distintas. Puedes hablar con un trader financiero, un abogado, una psicologa, un guia espiritual, o simplemente una persona normal con quien platicar. Todo funciona por voz: tu hablas, el agente escucha, piensa y responde.

---

## Primeros Pasos

### 1. Iniciar sesion

Al acceder a la aplicacion, veras una pantalla de login. Ingresa tu usuario y contrasena proporcionados por el administrador.

### 2. Pantalla principal

Despues de iniciar sesion, veras la pantalla de bienvenida con:

- **Selector de personalidad**: tarjetas con las 11 personalidades disponibles
- **Boton de Configuracion**: para personalizar voces, modelos y visualizadores
- **Boton de Salir**: para cerrar sesion

---

## Personalidades Disponibles

### Conversaciones generales

| Personalidad | Descripcion |
|-------------|-------------|
| Carlos el Trader | Trader financiero, analitico y directo sobre mercados e inversiones |
| Lic. Martinez | Abogado corporativo, orientacion legal formal |
| Paz (Hippy) | Filosofo relajado, perspectivas alternativas de vida |
| Alguien Normal | Persona comun para platicar de cualquier tema |

### Guias espirituales

| Personalidad | Tradicion |
|-------------|-----------|
| Marco el Estoico | Filosofia estoica (Seneca, Marco Aurelio) |
| Padre Miguel | Sacerdote catolico |
| Monje Thich | Monje budista zen |
| Iman Ahmed | Iman musulman |
| Rabino David | Rabino judio |
| Pandit Arjun | Pandit hindu |

### Psicologa (Dra. Ana)

La Dra. Ana es una personalidad especial con funcionalidad completa de terapia psicologica. Tiene sesiones persistentes, notas clinicas automaticas y 5 enfoques terapeuticos. Se describe en detalle mas adelante.

---

## Como Tener una Conversacion

### Con cualquier personalidad (excepto Dra. Ana)

1. Selecciona la personalidad deseada en la pantalla principal
2. Haz clic en **"Conectar"**
3. Habla normalmente — el agente escucha y responde por voz
4. Para terminar, haz clic en **"Desconectar"**

### Ver conversaciones pasadas

Si ya tuviste conversaciones con una personalidad:

1. Selecciona la personalidad
2. Aparecera el boton **"Ver conversaciones"**
3. Haz clic para ver la lista de conversaciones anteriores
4. Selecciona una para leer la transcripcion completa con fecha, duracion y numero de turnos

---

## Dra. Ana: Sistema de Terapia

### Primera sesion (intake)

1. Selecciona **"Dra. Ana"** en la pantalla principal
2. Haz clic en **"Nuevo paciente"**
3. Ingresa un **ID de paciente** (identificador unico, por ejemplo tus iniciales o un alias)
4. Selecciona un **enfoque terapeutico**:

   | Enfoque | Descripcion |
   |---------|-------------|
   | **CBT** (Cognitivo-Conductual) | Identifica y reestructura pensamientos negativos. Usa el modelo ABC, activacion conductual |
   | **ACT** (Aceptacion y Compromiso) | Trabaja aceptacion, defusion cognitiva, valores personales y accion comprometida |
   | **DBT** (Dialectico-Conductual) | Regulacion emocional, tolerancia al malestar, habilidades interpersonales |
   | **Mindfulness** | Meditacion guiada, atencion plena, body scan. Basado en MBCT/MBSR |
   | **Gestalt / Sistemica** | Tecnicas vivenciales (silla vacia, dialogo de partes), patrones familiares |

5. **Terapia de pareja** (opcional): Activa esta opcion si asisten dos personas. La Dra. Ana adoptara un rol neutral, facilitando comunicacion equitativa entre ambos
6. Haz clic en **"Iniciar sesion"**
7. La Dra. Ana realizara una entrevista inicial para conocerte y crear tu perfil

### Sesiones de seguimiento

1. Selecciona **"Dra. Ana"**
2. En la lista de pacientes, selecciona tu ID
3. Haz clic en **"Iniciar sesion"**
4. La Dra. Ana recordara tu historial, enfoque elegido y temas anteriores
5. No necesitas volver a elegir el enfoque — se carga automaticamente

### Notas terapeuticas

Despues de cada sesion, la Dra. Ana genera automaticamente:

- **Notas de sesion**: Resumen clinico de lo trabajado
- **Resumen general**: Vision acumulativa de todo el proceso terapeutico
- **Plan terapeutico**: Objetivos y estrategias (se actualiza cada 3 sesiones)
- **Temas recurrentes**: Patrones que se repiten en las sesiones
- **Progreso**: Avances y areas de trabajo
- **Agenda**: Planificacion de proximas sesiones

Para ver y editar estas notas:

1. Selecciona Dra. Ana y tu paciente
2. Haz clic en **"Ver notas"**
3. Navega entre las diferentes secciones
4. Puedes editar las notas con el editor Markdown integrado

### Herramientas de la Dra. Ana durante la sesion

Durante las sesiones de seguimiento, la Dra. Ana puede consultar automaticamente:

- Tu perfil y datos personales
- Sesiones anteriores
- Tareas pendientes (deberes terapeuticos)
- Plan terapeutico
- Agenda
- Temas recurrentes
- Progreso general

Esto sucede de forma transparente — la Dra. Ana decide cuando consultar informacion segun el flujo de la conversacion.

---

## Configuracion

Accede a la configuracion desde el enlace **"Configuracion"** en la pantalla principal. Cada personalidad tiene sus propios ajustes:

### Voz

Selecciona entre 33 voces en espanol de Cartesia. Cada personalidad tiene una voz por defecto, pero puedes cambiarla a cualquier otra. Voces disponibles incluyen:

- Voces masculinas formales, casuales, animadas
- Voces femeninas formales, casuales, nurturing
- Diferentes tonos y estilos

### Visualizador de audio

Elige como se muestra la animacion durante la conversacion:

| Tipo | Descripcion |
|------|-------------|
| **Bar** | Barras de ecualizador verticales |
| **Wave** | Onda sonora fluida |
| **Grid** | Cuadricula animada |
| **Radial** | Patron circular/radial |
| **Aura** | Efecto de aura ambient |

### Temperatura / Creatividad

Controla que tan creativas o precisas son las respuestas:

- **0.0 (Preciso)**: Respuestas conservadoras y consistentes
- **0.5 (Balanceado)**: Balance entre creatividad y precision
- **1.0 (Creativo)**: Respuestas mas variadas e imaginativas

Para Dra. Ana se recomienda una temperatura baja (0.2-0.4) para respuestas clinicas consistentes. Para Paz (hippy) o los guias espirituales, una temperatura mas alta (0.6-0.8) puede dar respuestas mas ricas.

### Modelo LLM

Puedes cambiar el modelo de inteligencia artificial que usa cada personalidad. El default es Gemini 2.0 Flash (rapido y economico). Otros modelos disponibles via OpenRouter incluyen Claude, GPT-4o, Llama, etc. Modelos mas grandes dan respuestas de mayor calidad pero son mas lentos y costosos.

### Guardar configuracion

Los cambios se guardan automaticamente en tu navegador. Si cambias de navegador o dispositivo, las configuraciones vuelven a sus valores default.

---

## Cambiar Contrasena

1. Accede a **Configuracion** desde la pantalla principal
2. Busca la seccion **"Cambiar contrasena"**
3. Ingresa tu contrasena actual
4. Ingresa la nueva contrasena
5. Confirma y guarda

---

## Cerrar Sesion

Haz clic en **"Salir"** en la pantalla principal. Seras redirigido a la pantalla de login.

---

## Preguntas Frecuentes

### Las notas de la Dra. Ana no aparecen despues de la sesion

Las notas se generan automaticamente **al desconectar** la sesion. El proceso puede tardar unos segundos. Espera un momento y recarga la pagina si es necesario.

### Puedo cambiar el enfoque terapeutico de un paciente existente?

No directamente. El enfoque se elige en la primera sesion y se mantiene durante todo el proceso terapeutico. Para cambiar de enfoque, crea un nuevo paciente con un ID diferente.

### Mis configuraciones de voz se perdieron

Las configuraciones se guardan en el `localStorage` del navegador. Si limpiaste los datos del navegador, cambiaste de navegador o de dispositivo, las configuraciones se resetean a los valores default.

### Puedo tener multiples sesiones simultaneas?

Cada sala de LiveKit permite maximo 2 participantes (tu y el agente). No puedes tener dos sesiones simultaneas con la misma personalidad, pero si puedes tener sesiones con diferentes personalidades en ventanas separadas.

### Que privacidad tienen mis conversaciones?

- Las conversaciones se transcriben y guardan como archivos de texto en el servidor
- Las notas terapeuticas de Dra. Ana se generan y guardan automaticamente
- Los logs del sistema **no** contienen contenido de conversaciones
- Consulta con tu administrador sobre las politicas de retencion y respaldo de datos
- Los datos no se comparten con terceros (excepto los servicios de procesamiento: Deepgram para voz-a-texto, OpenRouter/modelo para respuestas, Cartesia para texto-a-voz)

### La conexion se corta o no escucho al agente

- Verifica tu conexion a internet
- Asegurate de que el microfono este habilitado en el navegador
- Intenta refrescar la pagina y reconectar
- Si el problema persiste, contacta al administrador
