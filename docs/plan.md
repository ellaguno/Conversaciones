# Plan de Desarrollo - Comerciante con Voz

## Fases Completadas

### Fase 1: Starter Kit Funcional
- [x] LiveKit agent-starter-react configurado
- [x] Deepgram STT (nova-3, espanol)
- [x] LLM via OpenRouter (Gemini 2.0 Flash)
- [x] Cartesia TTS (sonic-3, espanol)
- [x] Conexion a LiveKit Cloud

### Fase 2: Personalidades + Sistema Terapeutico
- [x] 4 personalidades con system prompts distintos (trader, abogado, psicologo, hippy)
- [x] Voces Cartesia distintas por personalidad
- [x] Paso de personalidad via room name
- [x] Frontend con selector de personalidad y forzado de remontaje
- [x] Sistema Dra. Ana con sesiones persistentes:
  - [x] SessionManager con almacenamiento en archivos .md
  - [x] 7 function tools para consultar datos del paciente
  - [x] Generacion automatica de notas post-sesion (perfil, plan, resumen, progreso, temas, agenda)
  - [x] Flujo diferenciado intake vs seguimiento
- [x] Soporte multi-paciente con patient ID en room name
- [x] Editor de notas en frontend (Tiptap Markdown)
- [x] Dashboard de metricas (tokens, costo, uso STT/TTS)
- [x] API routes para CRUD de notas y lectura de sesiones

### Fase 2.5: Seguridad + Nuevas Personalidades + Configuracion
- [x] Autenticacion con NextAuth.js v5 (middleware, login, JWT)
- [x] Rate limiting en todas las API routes (token bucket in-memory)
- [x] Validacion de path traversal en frontend y agent
- [x] Headers de seguridad (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] Limite de transcripcion (500 turnos) y participantes por sala (2)
- [x] Logs sanitizados (sin datos clinicos)
- [x] 7 nuevas personalidades: Alguien Normal + 6 guias espirituales
- [x] Transcripcion de conversaciones para todos los agentes (ConversationLog)
- [x] Visor de conversaciones pasadas con renderizado Markdown
- [x] Configuracion por personalidad (voz, visualizador, temperatura, nombre)
  - [x] 33 voces Cartesia en espanol
  - [x] 5 tipos de visualizador de audio
  - [x] Slider de temperatura/creatividad
  - [x] Persistencia en localStorage + room metadata
- [x] Cambio de contrasena desde configuracion
- [x] Boton de logout (Salir)
- [x] Fix: double-click disconnect bug en view-controller

### Fase 2.6: Enfoques Terapeuticos + Terapia de Pareja
- [x] 5 enfoques terapeuticos para Dra. Ana: CBT, ACT, DBT, Mindfulness, Gestalt/Sistemica
- [x] Selector de enfoque en formulario de nuevo paciente (solo primera sesion)
- [x] Persistencia de enfoque en therapy_config.json por paciente
- [x] Sesiones de seguimiento cargan automaticamente el enfoque guardado
- [x] System prompt dinamico con tecnicas especificas del enfoque elegido
- [x] Soporte para terapia de pareja (checkbox en nuevo paciente)
- [x] Instrucciones especializadas de terapia de pareja (neutralidad, espacio equitativo)

## Fase 3: Market Dashboard + RAG (Pendiente)

Objetivos:
- [ ] Dashboard de mercados financieros en tiempo real para el trader
- [ ] RAG (Retrieval-Augmented Generation) para dotar al agente de conocimiento contextual
- [ ] Integracion con APIs de mercado (precios, noticias, indicadores)
- [ ] El trader puede responder con datos actualizados del mercado
- [ ] Base de conocimiento para el abogado (leyes, regulaciones)

### Ideas Adicionales
- [ ] Autorizacion por paciente (requiere BD)
- [ ] Persistencia en base de datos (reemplazar archivos .md)
- [ ] Exportacion de notas clinicas a PDF
- [ ] Notificaciones de agenda (recordatorios de sesion)
- [ ] Multiples usuarios con roles
- [ ] Tests automatizados
- [ ] CI/CD pipeline
- [ ] Encripcion de datos clinicos en reposo
- [ ] Content-Security-Policy header
- [ ] Rate limiting distribuido (Redis)

## Decisiones Tecnicas

| Decision | Razon |
|----------|-------|
| OpenRouter en lugar de API directa de Google | Flexibilidad para cambiar modelo sin cambiar codigo |
| Cartesia en lugar de ElevenLabs | ElevenLabs se quedo sin creditos gratuitos |
| Archivos .md para persistencia | Simplicidad, legibilidad humana, sin setup de BD |
| Room name para pasar personalidad | Room metadata no funciona con auto-dispatch de LiveKit |
| Room metadata para config adicional | voiceId, temperature, therapyMethod, coupleTherapy |
| Gemini 2.0 Flash | Costo muy bajo ($0.10/$0.40 por 1M tokens), velocidad alta |
| livekit-agents 1.4.4 | API moderna con AgentServer + rtc_session decorator |
| therapy_config.json por paciente | Persiste enfoque terapeutico sin modificar perfil.md |
| localStorage para configs frontend | Configuracion por personalidad sin necesidad de backend |
| NextAuth.js v5 con CredentialsProvider | Auth simple, JWT sessions, middleware-based |
