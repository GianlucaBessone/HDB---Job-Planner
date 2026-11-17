# Recursos Humanos — Reclutamiento (ATS)

Vacantes, base de talentos, pipeline por etapas y análisis de CV con IA.
Rutas: `/rrhh` (portada del módulo), `/rrhh/reclutamiento` (tablero), `/vacantes`, `/vacantes/[id]/pipeline`, `/postulantes`, `/postulantes/[id]`.

## Diagnóstico del formato anterior (nov. 2026)

| Área | Fortalezas | Debilidades |
|---|---|---|
| Datos | Esquema Prisma completo para un ATS (CV, análisis IA, historial de etapas, entrevistas, evaluaciones). | La mayor parte del esquema no se usaba: no se guardaban CV, habilidades, experiencia ni análisis. |
| Seguridad | — | Todo el reclutamiento eran *server actions* (`app/rrhh/actions.ts`) sin control de sesión ni de rol: el middleware solo protege `/api/*`. Cualquiera podía crear o borrar vacantes y postulantes. La ruta `/api/rrhh/ai/parse-cv` no se usaba y devolvía datos simulados sin clave. |
| Funciones | Pipeline kanban con arrastrar y soltar; vincular postulantes de la base a una vacante. | Tablero con valores fijos en 0 y "Próximamente". Ficha del postulante 100 % simulada (siempre "Juan Perez"). Sin columna de descartados. Botones de WhatsApp y email sin acción. Errores del kanban silenciosos. Sin editar ni pausar/cerrar vacantes. Descartar en una vacante marcaba al postulante como rechazado en todas. |
| UI/UX | Estructura de pestañas clara (Tablero / Vacantes / Base de talentos). | Colores, radios y sombras sueltos, `alert()` para errores, estilos propios en formularios, puntaje "0 %" para quien no tenía análisis, columna "Puesto" siempre vacía. Dos formularios de alta duplicados (modal y página). |

## Qué cambió

- **API con permisos** en `app/api/rrhh/reclutamiento/**` (Zod + `getAcceso`), en lugar de server actions abiertas. Funciones nuevas en `lib/permisos.ts`:
  `rrhh.reclutamiento_ver`, `rrhh.reclutamiento_gestionar` (admin, supervisor, qa) y `rrhh.reclutamiento_eliminar` (admin, supervisor).
- **Alta con CV + IA**: se sube el PDF, la IA completa datos de contacto, experiencia, formación, habilidades (técnicas/blandas con nivel), idiomas, certificaciones, seniority, resumen, **índice de veracidad** con señales, fortalezas/debilidades/riesgos y, si se elige vacante, la **compatibilidad**. El usuario revisa y corrige todo antes de guardar. Avisa posibles duplicados (mismo email o nombre).
- **Ficha real del postulante**: perfil, análisis IA, procesos con historial (quién movió y cuándo), CV, edición, estado, sumar a vacante, "Actualizar CV" (analiza un PDF nuevo y completa solo lo vacío) y evaluación de compatibilidad contra cualquier vacante.
- **Pipeline**: columna "Descartados", match por vacante, veracidad, recomendación de la IA, días en la etapa, WhatsApp/email funcionales, "Evaluar match" en la tarjeta, vista de lista (alternativa accesible y móvil al arrastre) y reversión con aviso si falla el guardado.
- **Tablero** con datos reales: búsquedas abiertas y prioritarias, en proceso, nuevos (30 días), contrataciones y días promedio de contratación (90 días), embudo, búsquedas en curso, actividad y postulantes recientes.
- **Vacantes**: filtros por estado, embudo por tarjeta, puestos cubiertos, editar, pausar, reabrir, cerrar.
- **Estado del postulante derivado de sus procesos**: contratado en alguna vacante → Contratado; con un proceso abierto → Activo; sin procesos abiertos → Base de talentos. "No apto" solo se asigna a mano.
- Arreglo global: `components/ui/Badge` ahora usa clases literales; antes Tailwind no generaba `badge-success/warning/danger/info/brand` y todos los badges con tono se veían neutros en toda la app.

## IA

| Clave | Uso | Entrada |
|---|---|---|
| `CV_PARSE` | Lectura del CV (`lib/rrhh/cvIA.ts → analizarCvPdf`) | PDF adjunto + vacante opcional en el sufijo |
| `CV_MATCH` | Compatibilidad perfil–vacante (`evaluarCompatibilidad`) | Texto del perfil actual + vacante |

- Prompts en `lib/ai/prompts.ts`, ruteo en `lib/ai/router.ts` (Gemini 2.5 Flash, `GEMINI_API_KEY`). Cada llamada queda en Auditoría de IA.
- La respuesta se valida y normaliza con `analisisCvSchema` / `matchSchema` (`lib/rrhh/reclutamiento.ts`); si no cumple, se reintenta una vez indicando los errores.
- El contenido del CV se trata como dato: si trae instrucciones dirigidas a la IA (texto oculto, "asigná 100 puntos"), se registra como alerta de veracidad.
- La IA no usa edad, género, estado civil, nacionalidad, religión ni salud para puntuar.

### Índice de veracidad

No es un detector de mentiras: estima la **coherencia interna y la verificabilidad** del CV (fechas, superposiciones, huecos, cargos acordes a la experiencia, títulos con institución, afirmaciones vagas, contradicciones). Siempre viene con las señales concretas que lo justifican ("A verificar" y "Respaldos"), para orientar qué preguntar en la entrevista o qué referencia pedir.

- 75–100: Consistente · 50–74: Revisar · 0–49: Dudoso.

### Integridad del análisis

El análisis viaja al navegador para que el usuario revise los datos. Para que el puntaje no pueda modificarse en el camino, el servidor lo firma (HMAC con `JWT_SECRET`, vigencia 2 h) y lo verifica al guardar. La compatibilidad solo se conserva si se guarda en la misma vacante contra la que se analizó.

## Almacenamiento

- El PDF se guarda en el almacenamiento S3 (`lib/objectStorage.ts`, clave `rrhh/cv/<uuid>.pdf`) y se abre con una URL prefirmada de 5 minutos. Máximo 4 MB (límite del cuerpo de una función serverless).
- Sin almacenamiento configurado, el postulante y el análisis se guardan igual y la ficha avisa que el PDF no quedó guardado.
- Datos de la IA sin columna propia (titular, resumen, veracidad, idiomas, certificaciones, seniority) se guardan en `CandidateAIAnalysis.rawAiResponse`. **No requiere cambios de esquema** ni `prisma db push`.

## Pendientes sugeridos

- Columna propia para el titular/perfil del postulante y la veracidad, si se quiere filtrar por ellos en la base (requiere migración).
- Entrevistas y evaluaciones técnicas: el esquema existe (`Interview`, `InterviewEvaluation`, `TechnicalEvaluation`) pero no tienen pantalla.
- Plantillas de mensajes (`MessageTemplate`) para WhatsApp/email.
- Personal y EPP (`app/rrhh/personal/epp`) sigue con server actions sin control de sesión; conviene migrarlo a API con permisos como se hizo acá.
