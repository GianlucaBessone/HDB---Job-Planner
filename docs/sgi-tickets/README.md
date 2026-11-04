# Tickets de Soporte — HDB SGI

Sistema de tickets para que cualquier usuario reporte fallas, pida funciones o deje sugerencias desde el buscador del header, con una vista de gestión, triaje con Gemini y una API para que cualquier agente con acceso al repositorio proponga la corrección.

---

## 1. Qué incluye

| Pieza | Dónde | Qué hace |
|---|---|---|
| Acción rápida | `components/tickets/TicketQuickAction.tsx` | Registra "Reportar una falla o sugerencia" en el buscador (`Ctrl/Cmd + K`). |
| Botón de header | `app/layout.tsx` | Ícono de salvavidas junto al buscador. Abre el mismo formulario. |
| Formulario guiado | `components/tickets/ReportTicketModal.tsx` | Wizard de 4 pasos: tipo → detalle → impacto → contexto y envío. |
| Vista de gestión | `app/tickets/page.tsx` | KPIs, filtros, detalle, análisis del agente, historial, comentarios y cambio de estado. |
| API | `app/api/tickets/**` | CRUD, métricas, adjuntos y acceso para agentes. |
| API para agentes | `app/api/agente/**`, `lib/ticketsAgente.ts` | Instrucciones y acciones para un agente externo, con token. Ver [FLUJO-AGENTE.md](./FLUJO-AGENTE.md). |
| Datos | `prisma/schema.prisma` | Modelos `Ticket`, `TicketAdjunto`, `TicketAgenteToken`, `TicketHistorial`, `TicketComentario`, `TicketEventoAgente`, `TicketCounter`. |

---

## 2. Puesta en marcha

```bash
# 1. Dependencias (si no están instaladas)
npm install

# 2. Crear las tablas nuevas en la base
npx prisma generate
npx prisma db push

# 3. Desarrollo
npm run dev
```

> El proyecto usa `db push` en desarrollo porque el historial de migraciones no cubre todo el esquema actual. No ejecutes `prisma migrate` sin revisar el estado de la base.

Abrí `http://localhost:3333`.

> En local, `DATABASE_URL` tiene que apuntar a una rama de desarrollo de Neon, nunca a producción: `db push` modifica el esquema de la base a la que apunte.

---

## 3. Uso diario

### Reportar

1. `Ctrl/Cmd + K` → **Reportar una falla o sugerencia** (o el ícono de salvavidas del header).
2. Elegir tipo: error, nueva función, sugerencia o consulta.
3. Completar título y descripción. En errores se piden pasos y comportamiento esperado.
4. Elegir urgencia e impacto. El sistema calcula la prioridad P0–P3.
5. Adjuntar capturas o PDF (hasta 3, 3 MB cada uno) y enviar.
6. Se muestra el código `TCK-AAAA-####` para seguimiento.

### Gestionar

Entrar a **Calidad y Mejora Continua → Tickets de Soporte** (`/tickets`).

- Los usuarios comunes ven solo sus tickets.
- `admin`, `qa` y `supervisor` ven todos y pueden clasificar, asignar y cambiar estados.
- El detalle tiene 4 pestañas: Detalle, Análisis del agente, Historial y Comentarios.

### Triaje online con Gemini

Al crear un ticket desde el buscador, la app dispara automáticamente un triaje online contra Gemini
(`POST /api/tickets/[id]/analizar`). El análisis llena las pestañas **Análisis** del ticket con:

- tipo, urgencia, impacto y prioridad recalculada con las reglas de `lib/tickets.ts`;
- riesgo, esfuerzo, horas estimadas y confianza;
- resumen, hipótesis de causa raíz, alcance y plan sugerido;
- preguntas faltantes, respuesta sugerida para quien reportó y posibles duplicados.

También se puede lanzar a mano desde la pestaña **Análisis** con el botón **Analizar con IA**.
Un usuario común solo puede analizar su ticket una vez; `admin`, `qa` y `supervisor` pueden re-analizar
pasados 30 segundos.

**Qué no hace el triaje online:** no edita archivos, no ejecuta `tsc`, no crea respaldos y no
despliega. Para corregir código hace falta un agente con acceso al repositorio (ver "Delegar a un agente").
Si Gemini no está disponible (`GEMINI_API_KEY` ausente o error de red), el ticket se crea igual y
queda para análisis manual.

Reglas de seguridad aplicadas en código, no en el prompt:

- la prioridad final siempre se recalcula con `computePrioridad()`;
- si el ticket menciona auth, permisos, roles, facturación, pagos, datos personales, esquema o
  configuración, el riesgo sube a `alto` como mínimo y se exige aprobación;
- `autoFixPermitido` solo queda en `true` si el usuario lo autorizó, la IA lo propuso, es un error,
  el riesgo es `bajo` y no hay aprobación pendiente;
- los duplicados sugeridos se descartan si el código no está entre los tickets abiertos enviados.

### Respuesta automática al usuario

Cuando una persona pasa un ticket a estado `resuelto` desde `/tickets` (un agente no puede hacerlo), el sistema:

1. Genera la respuesta final con el prompt `TICKET_RESOLUTION_RESPONSE` (Gemini, `gemini-2.5-flash`).
2. Guarda la respuesta como comentario **público** del ticket (autor `Equipo de soporte`).
3. Crea una actividad en el inbox (`Activity`, tipo `STATUS_UPDATED`) para el reportante.
4. Envía push vía OneSignal al reportante.
5. Registra el audit (`RESPONSE_CREATE`).

Reglas:

- Si falta `GEMINI_API_KEY`, la resolución igual se guarda; la respuesta automática se omite sin romper el flujo.
- La respuesta nunca se envía si el ticket no llegó a `resuelto`.
- El mensaje es orientado al usuario final: sin markdown, sin promesas de fechas, máximo 1500 caracteres.

### Delegar a un agente

En el ticket → pestaña **Análisis del agente** → **Copiar para agente**. Se copia un texto con el link a
las instrucciones y un token de 48 h válido solo para ese ticket. Pegalo en cualquier agente abierto en
el repositorio (Claude Code, OpenCode, Cursor, etc.).

El agente toma el ticket, trabaja en la rama `ticket/{codigo}` y registra la solución: el ticket queda en
`en_revision` con la rama, el commit y el PR a la vista. Si el cambio no le corresponde, lo escala a
`pendiente_aprobacion` con una pregunta. Vos revisás, publicás y marcás `resuelto`.

---

## 4. Reglas para los agentes

Las publica `GET /api/agente/instrucciones`, que es lo que lee el agente:

- Trabajar en una rama propia; nunca push a `main`, merge, deploy ni cambios en producción.
- Escalar si el cambio toca autenticación, permisos, esquema de la base, dependencias, configuración,
  borrado de datos, facturación o datos personales, o si es grande.
- Verificar con `npx tsc --noEmit`.
- No puede marcar `resuelto` ni cerrar: la API no lo permite.

El detalle está en [FLUJO-AGENTE.md](./FLUJO-AGENTE.md) y [POLITICA-TICKETS.md](./POLITICA-TICKETS.md).

---

## 5. Operación y mantenimiento

- **Adjuntos**: se guardan en la base (`TicketAdjunto`) y se descargan por `/api/tickets/adjuntos/{id}`, que exige ser el autor, quien lo subió o un gestor. El tipo se valida por el contenido del archivo. Los que no se vinculan a un ticket se borran a las 24 h.
- **Notificaciones**: al resolver se avisa al reportante; cuando un agente propone una solución o escala, se avisa a supervisores y admins.
- **SLA**: se calcula en `lib/tickets.ts` (`TICKET_SLA_HORAS`) y se muestra en la lista.

---

## 6. Checklist de validación

- [ ] `npx prisma generate` sin errores.
- [ ] `npx prisma db push` crea las tablas de tickets.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores nuevos (si hay configuración de ESLint).
- [ ] `Ctrl/Cmd + K` muestra la acción de reporte.
- [ ] Crear un ticket de prueba y verlo en `/tickets`.
- [ ] Crear un ticket con `GEMINI_API_KEY` configurada y ver el análisis en la pestaña **Análisis**.
- [ ] Verificar que un ticket sensible (login, permisos, pagos) quede con riesgo `alto` y sin auto-fix.
- [ ] Cerrar un ticket resuelto y verificar que se genere la respuesta automática con Gemini y quede como comentario público.
- [ ] **Copiar para agente** en un ticket, pegarlo en un agente y verificar que el ticket pase a `en_progreso` y luego a `en_revision` con rama y PR.
- [ ] Generar un acceso nuevo y verificar que el anterior devuelva `401`.
