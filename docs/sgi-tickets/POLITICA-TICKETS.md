# Política de Tickets y Auto-fix

**Versión:** 1.0.0
**Ámbito:** HDB SGI (Next.js 15 + Prisma + PostgreSQL, con escritorio Electron opcional)
**Fuente de verdad:** `mcp/sgi-tickets/policy.json`
**Última actualización:** 2026-10-29

---

## 1. Objetivo

Que cualquier persona pueda reportar una falla, pedir una función o dejar una sugerencia en menos de dos minutos, y que el equipo pueda clasificarla, priorizarla, resolverla y dejar trazabilidad. Los errores de bajo riesgo pueden ser corregidos por el agente OpenCode a través del MCP `sgi`; todo lo demás requiere una persona.

## 2. Alcance

**Incluye**

- Incidentes de la aplicación (pantallas, formularios, datos, permisos de uso).
- Pedidos de funcionalidad y mejoras.
- Consultas de uso.
- Triage, estimación, implementación de bajo riesgo y verificación.
- Trazabilidad de estados, comentarios y cambios del agente.

**No incluye (por ahora)**

- Incidentes de infraestructura, red o servidores.
- Soporte a clientes externos (usar el módulo de Órdenes de Servicio / portal).
- Gestión de sugerencias ISO 9001 (usar `/gestion-sugerencias`).
- Cambios de esquema, migraciones, dependencias o configuración: se derivan al responsable técnico.
- Facturación, datos personales y autenticación: siempre con aprobación humana.

## 3. Roles y permisos

| Rol | Puede reportar | Ve tickets | Cambia estado / asigna | Aprueba auto-fix | Toca código |
|---|---|---|---|---|---|
| `operador`, `vendedor` | Sí | Solo los propios | No | No | No |
| `supervisor` | Sí | Todos | Sí | Sí | No |
| `qa` | Sí | Todos | Sí | Sí | No |
| `admin` | Sí | Todos | Sí | Sí | Sí |
| Agente OpenCode (`sgi`) | No crea tickets | Todos | Sí, vía MCP | No: solo propone | Solo riesgo bajo |

La identidad se toma de la cookie `sgi_session` (middleware) y de `x-user-id` / `x-user-role` en las rutas de API. Un usuario no puede reportar ni editar en nombre de otro.

## 4. Taxonomía

### Tipo

| Valor | Nombre | Cuándo usarlo |
|---|---|---|
| `error` | Error / falla | Algo no funciona como debería. Es el único tipo elegible para auto-fix. |
| `funcionalidad` | Nueva función | Falta una capacidad que hoy no existe. |
| `sugerencia` | Sugerencia / mejora | Algo funciona, pero puede ser mejor. |
| `consulta` | Consulta | Duda de uso o proceso. |

### Urgencia

| Valor | Significado | Ejemplo |
|---|---|---|
| `critica` | Bloquea la operación, no hay forma de trabajar. | No se puede facturar ni fichar. |
| `alta` | Impacta hoy; hay una vuelta manual costosa. | Un reporte no exporta y hay que hacerlo a mano. |
| `media` | Molesta, pero se puede seguir. | Un filtro recuerda mal el último valor. |
| `baja` | Mejora deseable, no urge. | Cambiar el orden de una columna. |

### Impacto

`organizacion` → toda la organización o clientes.
`area` → un área o equipo completo.
`varios_usuarios` → más de una persona.
`usuario_unico` → caso puntual.

### Prioridad (calculada, no elegida)

Puntaje = `urgencia × 2 + impacto`:

| Urgencia | Puntos | Impacto | Puntos |
|---|---|---|---|
| crítica | 4 | organización | 4 |
| alta | 3 | área | 3 |
| media | 2 | varios usuarios | 2 |
| baja | 1 | un usuario | 1 |

| Puntaje | Prioridad |
|---|---|
| ≥ 11 | **P0** — inmediata |
| 9–10 | **P1** — alta |
| 6–8 | **P2** — normal |
| ≤ 5 | **P3** — baja |

Las ideas (`funcionalidad`, `sugerencia`, `consulta`) nunca suben de **P2** salvo que sean críticas para la operación. La prioridad se puede corregir manualmente desde la vista de gestión.

## 5. SLA

| Urgencia | Primera respuesta | Resolución objetivo |
|---|---|---|
| Crítica | 4 h | 24 h |
| Alta | 24 h | 72 h |
| Media | 72 h | 10 días |
| Baja | 10 días | 30 días |

El vencimiento se calcula desde `createdAt` hasta `fechaResolucion`. Un ticket abierto pasado el objetivo se marca **SLA vencido** en la lista y suma en el KPI.

## 6. Estados y transiciones

| Estado | Significado | Quién lo mueve |
|---|---|---|
| `nuevo` | Reportado, sin revisar. | Sistema / usuario |
| `triaje` | Se está clasificando y verificando. | Gestor / agente |
| `en_analisis` | Se evalúa causa y alcance. | Gestor / agente |
| `pendiente_aprobacion` | Requiere decisión humana. | Agente / gestor |
| `listo_para_fix` | Analizado y aprobado para implementar. | Gestor / agente (riesgo bajo) |
| `en_progreso` | Se está implementando. | Gestor / agente |
| `en_revision` | Cambio aplicado, pendiente de validar. | Agente / gestor |
| `resuelto` | Validado y disponible. | Gestor |
| `cerrado` | Confirmado por quien reportó. | Gestor / autor |
| `rechazado` | No se implementará. | Gestor |
| `duplicado` | Ya existe otro ticket. | Gestor |

```
nuevo → triaje → en_analisis → listo_para_fix → en_progreso → en_revision → resuelto → cerrado
                      ↘ pendiente_aprobacion ↗
nuevo / triaje / en_analisis → rechazado | duplicado
rechazado / duplicado → triaje (reabrir)
```

Las transiciones inválidas se rechazan en la API y en el MCP. El autor puede comentar y cerrar/reabrir su ticket resuelto; no puede reclasificar.

## 7. Flujo end-to-end

1. **Reporte**: formulario guiado. Se captura ruta, navegador, SO, resolución, zona horaria y versión automáticamente. Adjuntos opcionales.
2. **Registro**: se calcula prioridad, se crea `TCK-AAAA-####` y el historial inicial.
3. **Triaje**: el gestor (o el agente) confirma tipo, urgencia, impacto y posibles duplicados.
4. **Análisis**: causa raíz, alcance, esfuerzo, horas, confianza, riesgo y plan.
5. **Decisión**:
   - riesgo bajo + tipo error + auto-fix habilitado → `listo_para_fix`;
   - cualquier otro caso → `pendiente_aprobacion`.
6. **Implementación**: el agente valida guardrails, respalda y edita. El gestor puede hacerlo a mano.
7. **Verificación**: `tsc --noEmit` + `lint`; prueba funcional del caso reportado.
8. **Revisión**: `en_revision`. Una persona valida y pasa a `resuelto`.
9. **Cierre**: el autor confirma y se pasa a `cerrado`.

## 8. Clasificación de riesgo

| Riesgo | Definición | Autonomía |
|---|---|---|
| **Bajo** | Cambio localizado, reversible, sin datos ni permisos. ≤ 4 archivos, ≤ 150 líneas. | Auto-fix permitido. |
| **Medio** | Toca varias pantallas o lógica compartida, pero sin datos sensibles. | Requiere aprobación. |
| **Alto** | Autenticación, permisos, facturación, datos personales, migraciones, dependencias, integraciones. | Requiere aprobación y revisión técnica. |
| **Crítico** | Borrado de datos, cambios de esquema, configuración de producción, seguridad. | Solo humano. El agente no edita. |

Ejemplos:

- **Bajo**: un `if` mal escrito, un texto, un placeholder, un filtro que no refresca, una validación de formulario.
- **Medio**: cambiar un componente compartido usado en 5 pantallas, refactor de una función de cálculo.
- **Alto**: tocar `middleware.ts`, cambiar roles, modificar `prisma/schema.prisma`, agregar una librería.
- **Crítico**: `prisma migrate`, `db push`, borrar registros, rotar secretos, tocar `electron/`.

## 9. Reglas de auto-fix

El agente **solo** puede aplicar cambios si se cumplen **todas**:

1. `POLICY.autoFix.enabled = true`.
2. `ticket.tipo = error`.
3. `ticket.autoFixPermitido = true`.
4. `riesgo = bajo`.
5. `requiereAprobacion = false`.
6. ≤ 4 archivos.
7. ≤ 150 líneas agregadas + eliminadas.
8. Todas las rutas están en la allowlist y ninguna en la denylist.
9. Ninguna categoría sensible.
10. `tickets_begin_fix` devolvió `permitido: true`.

Si falla cualquier punto: `tickets_escalate` o `tickets_record_analysis` dejan el ticket en `pendiente_aprobacion` y se prohíbe editar.

### Rutas permitidas

```
app/**  components/**  lib/**  docs/**  public/**  mcp/sgi-tickets/**
```

### Rutas prohibidas

```
.env  .env.*  .git/**  .sgi-backups/**  node_modules/**
prisma/schema.prisma  prisma/migrations/**  prisma/seed*
middleware.ts  electron/**  next.config.js
package.json  package-lock.json  pnpm-lock.yaml
scripts/**  public/uploads/**  dist_electron/**
```

### Patrones prohibidos en el diff

`process.env[`, `child_process`, `eval(`, `new Function(`, `dangerouslySetInnerHTML`, `DROP TABLE`, `TRUNCATE TABLE`, `deleteMany(`, `prisma migrate`, `prisma db push`, `git push --force`, `rm -rf`.

### Verificación obligatoria

```bash
npx tsc --noEmit
```

Recomendada si el proyecto tiene configuración de ESLint:

```bash
npm run lint
```

Si no se pueden ejecutar, el ticket queda en `en_revision` con `verificado = false` y se informa la limitación.

### Respaldos y rollback

`tickets_begin_fix` copia cada archivo a tocar en:

```
.sgi-backups/<ticketId>/<timestamp>/<ruta-relativa>
```

Rollback manual: copiar el archivo desde el respaldo a su ruta original. Si el cambio ya se registró, se puede volver de `en_revision` a `en_progreso` (transición permitida).

## 10. Seguridad y datos

- Los tickets pueden contener datos de clientes. No se exponen fuera del equipo gestor.
- Los adjuntos se guardan en `public/uploads/tickets/` con nombre aleatorio. No subir credenciales, tokens, DNI, CBU ni información médica.
- El MCP corre localmente con el `DATABASE_URL` del proyecto. No se publica por red.
- El agente no tiene permitido leer `.env`, secretos ni ejecutar comandos de red.
- Los permisos de opencode para el agente deniegan `webfetch`, `websearch`, `subagent`, commits, push y migraciones.
- Toda acción del agente queda en `TicketEventoAgente` y en el `AuditLog` del sistema.

## 11. Definition of Done

Un ticket se considera resuelto cuando:

- [ ] La causa raíz está identificada y documentada.
- [ ] El cambio está aplicado (o se decidió no hacerlo y está justificado).
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm run lint` pasa sin errores nuevos.
- [ ] Se verificó el caso reportado y al menos un caso borde.
- [ ] El ticket tiene resolución escrita y las verificaciones registradas.
- [ ] Una persona lo revisó y pasó a `resuelto`.
- [ ] El autor confirmó el cierre (o pasaron 7 días sin objeción).

## 12. Métricas

- Tickets abiertos por estado, tipo y urgencia.
- Críticos abiertos.
- Tickets fuera de SLA.
- Resueltos en los últimos 7 días.
- Tiempo medio de primera respuesta y de resolución.
- Porcentaje de auto-fix exitoso vs. escalado.
- Reaperturas y rollbacks.

La vista `/tickets` muestra los cuatro primeros. El resto se puede consultar en `GET /api/tickets/metrics` o con SQL.

## 13. Gobernanza

- Cambiar `policy.json` requiere revisión humana y actualizar este documento.
- El agente lee la política al inicio de cada sesión (`tickets_policy`), por lo que los cambios aplican sin reiniciar OpenCode.
- Si una regla nueva es más restrictiva, primero se documenta y después se cambia el JSON.
- Los tickets de prueba deben usar el prefijo `[TEST]` en el título y cerrarse como `rechazado`.

## 14. Supuestos y decisiones

1. Se eligió un modelo `Ticket` separado de `Sugerencia` para no mezclar el flujo ISO 9001 con el soporte técnico.
2. El auto-fix es de **bajo riesgo** y deja el ticket en revisión; nunca cierra ni despliega.
3. No se agregó una migración formal porque el proyecto usa `db push` en desarrollo. Si se adopta `migrate`, generar la migración correspondiente antes de desplegar.
4. Los adjuntos usan el filesystem local, igual que el módulo de sugerencias existente.
5. La IA generativa del módulo de sugerencias no se reutiliza: el análisis lo hace OpenCode vía MCP para tener contexto real del código.
