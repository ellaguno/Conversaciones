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

## Fase 3: Market Dashboard + RAG (Pendiente)

Objetivos:
- [ ] Dashboard de mercados financieros en tiempo real para el trader
- [ ] RAG (Retrieval-Augmented Generation) para dotar al agente de conocimiento contextual
- [ ] Integracion con APIs de mercado (precios, noticias, indicadores)
- [ ] El trader puede responder con datos actualizados del mercado
- [ ] Base de conocimiento para el abogado (leyes, regulaciones)

### Ideas Adicionales
- [ ] Autenticacion de usuarios
- [ ] Persistencia en base de datos (reemplazar archivos .md)
- [ ] Historial de conversaciones para todas las personalidades (no solo psicologo)
- [ ] Exportacion de notas clinicas a PDF
- [ ] Notificaciones de agenda (recordatorios de sesion)
- [ ] Tests automatizados
- [ ] CI/CD pipeline

## Decisiones Tecnicas

| Decision | Razon |
|----------|-------|
| OpenRouter en lugar de API directa de Google | Flexibilidad para cambiar modelo sin cambiar codigo |
| Cartesia en lugar de ElevenLabs | ElevenLabs se quedo sin creditos gratuitos |
| Archivos .md para persistencia | Simplicidad, legibilidad humana, sin setup de BD |
| Room name para pasar personalidad | Room metadata no funciona con auto-dispatch de LiveKit |
| Gemini 2.0 Flash | Costo muy bajo ($0.10/$0.40 por 1M tokens), velocidad alta |
| livekit-agents 1.4.4 | API moderna con AgentServer + rtc_session decorator |
