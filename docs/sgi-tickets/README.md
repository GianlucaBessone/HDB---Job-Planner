# Tickets de Soporte — HDB SGI

Sistema de tickets para que cualquier usuario reporte fallas, pida funciones o deje sugerencias desde el buscador del header, con una vista de gestión y un agente OpenCode conectado por MCP.

---

## 1. Qué incluye

| Pieza | Dónde | Qué hace |
|---|---|---|
| Acción rápida | `components/tickets/TicketQuickAction.tsx` | Registra "Reportar una falla o sugerencia" en el buscador (`Ctrl/Cmd + K`). |
| Botón de header | `app/layout.tsx` | Ícono de salvavidas junto al buscador. Abre el mismo formulario. |
| Formulario guiado | `components/tickets/ReportTicketModal.tsx` | Wizard de 4 pasos: tipo → detalle → impacto → contexto y envío. |
| Vista de gestión | `app/tickets/page.tsx` | KPIs, filtros, detalle, análisis del agente, historial, comentarios y cambio de estado. |
| API | `app/api/tickets/**` | CRUD, métricas y subida de adjuntos. |
| Datos | `prisma/schema.prisma` | Modelos `Ticket`, `TicketHistorial`, `TicketComentario`, `TicketEventoAgente`, `TicketCounter`. |
| MCP | `mcp/sgi-tickets/server.mjs` | Expone tickets y guardrails a OpenCode por stdio. |
| Política | `mcp/sgi-tickets/policy.json` | Fuente de verdad de límites, rutas y reglas de auto-fix. |
| Agente | `.opencode/agents/sgi-ticket-fixer.md` | Perfil con permisos restringidos y protocolo de trabajo. |

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

### Verificar el MCP

El archivo `opencode.json` ya declara el servidor `sgi`:

```json
{
  "mcp": {
    "servers": {
      "sgi": {
        "type": "local",
        "command": ["node", "mcp/sgi-tickets/server.mjs"],
        "cwd": "."
      }
    }
  }
}
```

Comprobación:

```bash
opencode mcp list
# ✓ sgi  connected
```

Si no conecta:

1. `node -v` (Node 20+ recomendado).
2. `npx prisma generate` (el server usa `@prisma/client`).
3. Que exista `.env` con `DATABASE_URL`.
4. `node mcp/sgi-tickets/server.mjs` y mirar el error por stderr.

---

## 3. Uso diario

### Reportar

1. `Ctrl/Cmd + K` → **Reportar una falla o sugerencia** (o el ícono de salvavidas del header).
2. Elegir tipo: error, nueva función, sugerencia o consulta.
3. Completar título y descripción. En errores se piden pasos y comportamiento esperado.
4. Elegir urgencia e impacto. El sistema calcula la prioridad P0–P3.
5. Adjuntar capturas (hasta 3, 5 MB cada una) y enviar.
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
despliega. Para corregir código hace falta OpenCode + MCP en una máquina con el repositorio.
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

Cuando un ticket pasa a estado `resuelto` (por el flujo web con verificación, por el agente con el MCP o por cualquier otro camino que escriba el estado vía API), el sistema:

1. Genera la respuesta final con el prompt `TICKET_RESOLUTION_RESPONSE` (Gemini, `gemini-2.5-flash`).
2. Guarda la respuesta como comentario **público** del ticket (autor `Equipo de soporte`).
3. Crea una actividad en el inbox (`Activity`, tipo `STATUS_UPDATED`) para el reportante.
4. Envía push vía OneSignal al reportante.
5. Registra el audit (`RESPONSE_CREATE`).

Reglas:

- Si falta `GEMINI_API_KEY`, la resolución igual se guarda; la respuesta automática se omite sin romper el flujo.
- La respuesta nunca se envía si el ticket no llegó a `resuelto`.
- El mensaje es orientado al usuario final: sin markdown, sin promesas de fechas, máximo 1500 caracteres.

### Pedirle al agente

En OpenCode, seleccionar el agente **sgi-ticket-fixer** y escribir, por ejemplo:

```text
Analizá el ticket TCK-2026-0001 y, si es de bajo riesgo, corregilo.
```

O simplemente:

```text
Revisá los tickets nuevos y hacé triaje.
```

El agente usa el MCP `sgi` para leer, analizar, validar guardrails, respaldar y registrar el cambio. Si el riesgo no es bajo, el ticket queda en `pendiente_aprobacion` y no toca código.

---

## 4. Reglas que aplica el agente

- Auto-fix **solo** para `tipo = error`, `riesgo = bajo`, `autoFixPermitido = true`.
- Máximo **4 archivos** y **150 líneas** por cambio.
- Rutas permitidas: `app/**`, `components/**`, `lib/**`, `docs/**`, `public/**`, `mcp/sgi-tickets/**`.
- Rutas prohibidas: `.env*`, `prisma/schema.prisma`, `prisma/migrations/**`, `middleware.ts`, `electron/**`, `next.config.js`, `package.json`, lockfiles, `scripts/**`, `public/uploads/**`.
- Verificación obligatoria: `npx tsc --noEmit`. Recomendada: `npm run lint` si hay configuración de ESLint.
- Respaldo automático en `.sgi-backups/<ticket>/<timestamp>/`.
- El agente deja el ticket en `en_revision`. Nunca lo cierra.

El detalle completo está en [POLITICA-TICKETS.md](./POLITICA-TICKETS.md) y [FLUJO-AGENTE.md](./FLUJO-AGENTE.md).

---

## 5. Operación y mantenimiento

- **Adjuntos**: se guardan en `public/uploads/tickets/`. En Vercel el filesystem es efímero; si se despliega ahí, migrar a S3/R2 o similar. Al estar en `public/`, las URLs son accesibles sin autenticación: no subas datos sensibles.
- **Notificaciones**: el cambio de estado no envía push todavía. Se puede enganchar `sendPushNotification` en `PATCH /api/tickets/[id]`.
- **SLA**: se calcula en `lib/tickets.ts` (`TICKET_SLA_HORAS`) y se muestra en la lista.
- **Respaldos**: `.sgi-backups/` está en `.gitignore`. Borrarlos es seguro una vez validado el cambio.

---

## 6. Checklist de validación

- [ ] `npx prisma generate` sin errores.
- [ ] `npx prisma db push` crea las 5 tablas nuevas.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores nuevos (si hay configuración de ESLint).
- [ ] `Ctrl/Cmd + K` muestra la acción de reporte.
- [ ] Crear un ticket de prueba y verlo en `/tickets`.
- [ ] Crear un ticket con `GEMINI_API_KEY` configurada y ver el análisis en la pestaña **Análisis**.
- [ ] Verificar que un ticket sensible (login, permisos, pagos) quede con riesgo `alto` y sin auto-fix.
- [ ] Cerrar un ticket resuelto y verificar que se genere la respuesta automática con Gemini y quede como comentario público.
- [ ] `opencode mcp list` muestra `sgi` conectado.
- [ ] Pedir un análisis y verificar que el ticket pase a `en_analisis` y luego a `listo_para_fix` o `pendiente_aprobacion`.
