# Cotización: Plataforma de Entrenamiento por Roleplay para Aseguradora

**Fecha:** 24 de marzo de 2026
**Versión:** 1.0

---

## 1. Resumen Ejecutivo

Plataforma de entrenamiento por roleplay con IA conversacional por voz, diseñada para capacitar agentes de seguros mediante simulaciones realistas de venta. El sistema evalúa en tiempo real las habilidades del vendedor, registra progreso, y permite a supervisores configurar escenarios y dar seguimiento al desempeño de su equipo.

**Base tecnológica:** Se parte de una plataforma probada en producción con conversación por voz en tiempo real, ya demostrada con escenarios de seguros (vida y gastos médicos mayores).

---

## 2. Lo que ya existe (Activos reutilizables)

| Componente | Estado | Valor estimado |
|---|---|---|
| Motor de conversación por voz (LiveKit + WebRTC) | Producción | Ya incluido |
| Integración STT (Deepgram) + TTS (Cartesia, 33 voces) | Producción | Ya incluido |
| Integración LLM (Gemini/Claude vía OpenRouter) | Producción | Ya incluido |
| Panel de evaluación en tiempo real (emoción, intención, puntaje) | Demo funcional | Ya incluido |
| Function calling para actualizar estado y calificar | Demo funcional | Ya incluido |
| Autenticación básica (NextAuth, JWT) | Producción | Ya incluido |
| Transcripción automática de conversaciones | Producción | Ya incluido |
| Framework del agente Python con personalidades | Producción | Ya incluido |
| Frontend Next.js con UI componentes (Shadcn/Radix) | Producción | Ya incluido |

**Estimación de valor de activos reutilizables: ~800 horas de desarrollo ahorradas.**

---

## 3. Módulos a Desarrollar

### Módulo 1: Gestión de Usuarios y Equipos
> Sistema empresarial de usuarios con roles y estructura organizacional.

| Funcionalidad | Detalle |
|---|---|
| Roles | Admin empresa, Supervisor, Entrenador (trainee) |
| Equipos/Sucursales | Agrupación jerárquica de usuarios |
| Importación masiva | Carga de usuarios vía CSV/Excel |
| Directorio de usuarios | Búsqueda, filtros, estado activo/inactivo |
| SSO (opcional) | Integración con proveedor de identidad corporativo |

**Estimación: 120–160 horas**

---

### Módulo 2: Escenarios de Roleplay
> Constructor y biblioteca de escenarios de entrenamiento configurables.

| Funcionalidad | Detalle |
|---|---|
| Biblioteca de escenarios | Catálogo organizado por producto, dificultad, objetivo |
| Constructor de escenarios | Editor para crear perfiles de cliente simulado (personalidad, objeciones, contexto) |
| Productos de seguro | Vida, Gastos Médicos, Auto, Hogar, Empresarial (extensible) |
| Niveles de dificultad | Fácil, Medio, Difícil, Experto (configurable) |
| Perfiles de prospecto | Edad, perfil socioeconómico, motivaciones, objeciones predefinidas |
| Asignación de escenarios | Asignar escenarios específicos a usuarios o equipos |

**Estimación: 140–180 horas**

---

### Módulo 3: Sistema de Calificaciones
> Evaluación estructurada con rúbricas configurables y retroalimentación detallada.

| Funcionalidad | Detalle |
|---|---|
| Rúbricas por competencia | Apertura, detección de necesidades, manejo de objeciones, cierre, seguimiento |
| Puntaje en tiempo real | Panel durante la conversación (ya existe base) |
| Reporte post-sesión | Resumen automático con fortalezas, áreas de mejora, puntaje desglosado |
| Historial de calificaciones | Registro completo por usuario con tendencias |
| Calificación por supervisor | Opción de revisión/ajuste manual por supervisor |
| Exportación | PDF individual y reportes consolidados (CSV/Excel) |

**Estimación: 120–150 horas**

---

### Módulo 4: Progreso y Analytics
> Dashboard de seguimiento individual y grupal con KPIs.

| Funcionalidad | Detalle |
|---|---|
| Dashboard individual | Sesiones completadas, puntaje promedio, tendencia, áreas fuertes/débiles |
| Dashboard de equipo | Vista de supervisor con comparativos y rankings |
| Rutas de aprendizaje | Secuencia sugerida de escenarios por nivel |
| Metas y logros | Objetivos configurables (ej: "completar 10 sesiones", "puntaje >8 en cierre") |
| Reportes ejecutivos | Resumen para dirección: ROI de capacitación, métricas agregadas |
| Gráficas y tendencias | Evolución temporal por usuario, equipo, competencia |

**Estimación: 140–180 horas**

---

### Módulo 5: Configuración Empresarial
> Panel de administración para personalizar la plataforma.

| Funcionalidad | Detalle |
|---|---|
| Branding | Logo, colores, nombre de la empresa |
| Criterios de evaluación | Editar rúbricas, pesos por competencia, umbrales de aprobación |
| Gestión de escenarios | Activar/desactivar, ordenar, asignar por equipo |
| Configuración de voz | Selección de voz del prospecto simulado, velocidad, idioma |
| Políticas de uso | Límites de sesiones, horarios permitidos, duración máxima |

**Estimación: 80–100 horas**

---

### Módulo 6: Notificaciones
> Sistema de alertas y comunicaciones automatizadas.

| Funcionalidad | Detalle |
|---|---|
| Email | Asignación de escenario, recordatorios, resumen semanal |
| In-app | Notificaciones dentro de la plataforma |
| Alertas a supervisores | Cuando un trainee tiene puntaje bajo o no practica |
| Recordatorios automáticos | "No has practicado en X días" |
| Resumen periódico | Email semanal/mensual con progreso del equipo |

**Estimación: 60–80 horas**

---

### Módulo 7: Infraestructura y Migración
> Preparación para escala empresarial.

| Funcionalidad | Detalle |
|---|---|
| Base de datos | Migración de archivos → PostgreSQL |
| API REST estructurada | Endpoints documentados para todos los módulos |
| Seguridad | Encriptación, auditoría de acceso, cumplimiento de datos personales |
| Multi-tenant (opcional) | Soporte para múltiples empresas en una instancia |
| Escalabilidad | Soporte para sesiones concurrentes (LiveKit Cloud escala automáticamente) |

**Estimación: 100–140 horas**

---

## 4. Resumen de Estimación

| Módulo | Horas estimadas |
|---|---|
| 1. Gestión de Usuarios y Equipos | 120–160 |
| 2. Escenarios de Roleplay | 140–180 |
| 3. Sistema de Calificaciones | 120–150 |
| 4. Progreso y Analytics | 140–180 |
| 5. Configuración Empresarial | 80–100 |
| 6. Notificaciones | 60–80 |
| 7. Infraestructura y Migración | 100–140 |
| **TOTAL** | **760–990 horas** |

---

## 5. Propuesta Económica

### Opción A: Proyecto Completo (7 módulos)

| Concepto | Rango |
|---|---|
| Desarrollo (760–990 hrs × $85 USD/hr) | $64,600 – $84,150 USD |
| Licencia de plataforma base | $15,000 USD |
| **Total proyecto** | **$79,600 – $99,150 USD** |

### Opción B: MVP (Módulos 1, 2, 3, 7) — Lanzamiento rápido

| Concepto | Rango |
|---|---|
| Desarrollo (480–630 hrs × $85 USD/hr) | $40,800 – $53,550 USD |
| Licencia de plataforma base | $15,000 USD |
| **Total MVP** | **$55,800 – $68,550 USD** |

### Opción C: Licencia + Implementación Asistida

| Concepto | Monto |
|---|---|
| Licencia de plataforma + demo actual | $25,000 USD |
| Capacitación y soporte (40 hrs) | $3,400 USD |
| Personalización básica (branding + 5 escenarios) | $8,500 USD |
| **Total** | **$36,900 USD** |

### Costos Recurrentes (todas las opciones)

| Concepto | Costo mensual estimado |
|---|---|
| LiveKit Cloud (WebRTC) | $200–800 USD (según uso) |
| Deepgram STT | $100–400 USD |
| LLM (Gemini/Claude vía OpenRouter) | $150–600 USD |
| Cartesia TTS | $100–300 USD |
| Hosting (servidor) | $50–150 USD |
| **Total operación mensual** | **$600–2,250 USD** |

> Nota: Los costos de APIs escalan con el número de sesiones. Estimación basada en 100–500 sesiones/mes de ~10 min cada una.

---

## 6. Cronograma Estimado

| Fase | Duración | Entregables |
|---|---|---|
| **Fase 1 — MVP** | 8–10 semanas | Usuarios, Escenarios, Calificaciones, Base de datos |
| **Fase 2 — Progreso** | 4–6 semanas | Dashboards, Analytics, Rutas de aprendizaje |
| **Fase 3 — Empresa** | 3–4 semanas | Configuración, Notificaciones, Branding |
| **Fase 4 — Pulido** | 2–3 semanas | QA, documentación, capacitación, go-live |
| **Total** | **17–23 semanas** |

---

## 7. Diferenciadores vs. Alternativas

| Característica | Esta plataforma | Alternativas típicas |
|---|---|---|
| Conversación por voz en tiempo real | Si (WebRTC, <500ms latencia) | Texto o voz grabada |
| Evaluación en tiempo real | Si (emoción + intención + puntaje) | Post-sesión únicamente |
| Personalidades de IA configurables | Si (perfiles de prospecto realistas) | Guiones fijos |
| Voces en español nativas | Si (33 voces, Cartesia sonic-3) | Voces robóticas o inglés |
| Transcripción automática | Si (Deepgram nova-3) | Manual o no disponible |
| Escalable sin hardware | Si (100% cloud) | Requiere infraestructura |

---

## 8. Notas Importantes

1. **Precios de APIs pueden variar** — Los proveedores de IA ajustan precios frecuentemente. Los costos recurrentes son estimaciones a marzo 2026.
2. **La tarifa por hora ($85 USD) es negociable** dependiendo del volumen y compromiso.
3. **Propiedad intelectual** — La plataforma base se licencia; los módulos custom desarrollados para el cliente son de su propiedad.
4. **Soporte post-lanzamiento** — Se puede contratar por separado ($2,500–5,000 USD/mes).
5. **Los costos de API se pueden optimizar** — Modelos más económicos para escenarios simples, caché de respuestas frecuentes, etc.

---

*Documento generado el 24 de marzo de 2026.*
