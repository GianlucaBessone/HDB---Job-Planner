# Política de Tickets y Auto-fix

**Versión:** 2.0.0
**Ámbito:** HDB SGI (Next.js 15 + Prisma + PostgreSQL, con escritorio Electron opcional)
**Reglas para agentes:** `GET /api/agente/instrucciones` (`app/api/agente/instrucciones/route.ts`)
**Última actualización:** 2026-10-30

---

## 1. Objetivo

Que cualquier persona pueda reportar una falla, pedir una función o dejar una sugerencia en menos de dos minutos, y que el equipo pueda clasificarla, priorizarla, resolverla y dejar trazabilidad. La corrección del código la puede proponer cualquier agente con acceso al repositorio, a través de la API `/api/agente`; publicar y dar por resuelto siempre lo hace una persona.

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

| Rol | Puede reportar | Ve tickets | Cambia estado / asigna | Delega a un agente | Toca código |
|---|---|---|---|---|---|
| `operador`, `vendedor` | Sí | Solo los propios | No | No | No |
| `supervisor` | Sí | Todos | Sí | Sí | No |
| `qa` | Sí | Todos | Sí | Sí | No |
| `admin` | Sí | Todos | Sí | Sí | Sí |
| Agente (con token) | No | Solo el del token, o los `listo_para_fix` | Solo `en_progreso`, `en_revision`, `pendiente_aprobacion` | No | Propone en una rama |

La identidad de las personas se toma de la cookie `sgi_session` (middleware) y de `x-user-id` / `x-user-role` en las rutas de API. Un usuario no puede reportar ni editar en nombre de otro. Los agentes se autentican con un token `Bearer` que genera un gestor.

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
| `triaje` | Se está clasificando y verificando. | Gestor / Gemini |
| `en_analisis` | Se evalúa causa y alcance. | Gestor |
| `pendiente_aprobacion` | Requiere decisión humana. | Gestor / Gemini / agente (escalar) |
| `listo_para_fix` | Analizado y aprobado para implementar. | Gestor / Gemini (riesgo bajo) |
| `en_progreso` | Se está implementando. | Gestor / agente (tomar) |
| `en_revision` | Cambio propuesto, pendiente de validar y publicar. | Agente (solución) / gestor |
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

Las transiciones inválidas se rechazan en la API. Un agente solo puede llevar un ticket a `en_progreso`, `en_revision` o `pendiente_aprobacion`. El autor puede comentar y cerrar/reabrir su ticket resuelto; no puede reclasificar.

## 7. Flujo end-to-end

1. **Reporte**: formulario guiado. Se captura ruta, navegador, SO, resolución, zona horaria y versión automáticamente. Adjuntos opcionales.
2. **Registro**: se calcula prioridad, se crea `TCK-AAAA-####` y el historial inicial.
3. **Triaje**: Gemini (o el gestor) confirma tipo, urgencia, impacto y posibles duplicados.
4. **Análisis**: causa raíz, alcance, esfuerzo, horas, confianza, riesgo y plan.
5. **Decisión**:
   - riesgo bajo + tipo error + auto-fix habilitado → `listo_para_fix`;
   - cualquier otro caso → `pendiente_aprobacion`.
6. **Implementación**: el gestor delega con **Copiar para agente**; el agente toma el ticket y trabaja en la rama `ticket/{codigo}`. El gestor también puede hacerlo a mano.
7. **Verificación**: el agente corre `tsc --noEmit` y registra la solución con rama, commit y PR → `en_revision`.
8. **Revisión y publicación**: una persona revisa el PR, mergea, publica y pasa a `resuelto`. Recién ahí se avisa al usuario.
9. **Cierre**: el autor confirma y se pasa a `cerrado`.

## 8. Clasificación de riesgo

| Riesgo | Definición | Autonomía |
|---|---|---|
| **Bajo** | Cambio localizado, reversible, sin datos ni permisos. | Se puede delegar a un agente. |
| **Medio** | Toca varias pantallas o lógica compartida, pero sin datos sensibles. | Delegar con aprobación previa. |
| **Alto** | Autenticación, permisos, facturación, datos personales, migraciones, dependencias, integraciones. | Requiere aprobación y revisión técnica. |
| **Crítico** | Borrado de datos, cambios de esquema, configuración de producción, seguridad. | Solo humano. |

Ejemplos:

- **Bajo**: un `if` mal escrito, un texto, un placeholder, un filtro que no refresca, una validación de formulario.
- **Medio**: cambiar un componente compartido usado en 5 pantallas, refactor de una función de cálculo.
- **Alto**: tocar `middleware.ts`, cambiar roles, modificar `prisma/schema.prisma`, agregar una librería.
- **Crítico**: `prisma migrate`, `db push`, borrar registros, rotar secretos, tocar `electron/`.

## 9. Reglas para agentes

Las publica `GET /api/agente/instrucciones`, que es lo primero que lee el agente. Resumen:

1. Tomar el ticket (`POST /tomar`) antes de tocar código.
2. Leer `AGENTS.md` y seguir las convenciones del repo.
3. Trabajar en la rama `ticket/{codigo}`, nunca en `main`. Nada de push a `main`, merge, deploy ni cambios en producción.
4. Hacer el cambio mínimo y verificar con `npx tsc --noEmit`.
5. Commitear con el código del ticket en el mensaje y, si puede, abrir un PR.
6. Registrar la solución (`POST /solucion`) con resumen, archivos, verificaciones, rama, commit y PR.

**Escalar en vez de resolver** (`POST /escalar`) si el cambio:

- toca autenticación, sesiones, permisos o roles (`lib/auth*`, `lib/portalAuth.ts`, `lib/viewAccess.ts`, `middleware.ts`, `app/api/auth/**`);
- cambia el esquema (`prisma/schema.prisma`), requiere migraciones o `prisma db push`;
- agrega dependencias o cambia configuración (`package.json`, `next.config.js`, `.env*`);
- borra datos, toca facturación o datos personales;
- es grande (más de ~5 archivos o ~200 líneas) o el problema no está claro.

**Lo que el servidor impone**, aunque el agente no siga las instrucciones:

- el token solo da acceso a la API de tickets, y el de un ticket solo a ese ticket;
- no hay forma de pasar a `resuelto` ni `cerrado` desde la API;
- `/solucion` exige haber tomado el ticket con el mismo token;
- un ticket tomado queda bloqueado 4 h para otros tokens.

El control final es humano: el agente propone en una rama y una persona decide qué se publica.

## 10. Seguridad y datos

- Los tickets pueden contener datos de clientes. No se exponen fuera del equipo gestor y del agente al que se delegó el ticket.
- Los adjuntos se guardan en la base (`TicketAdjunto`), se validan por contenido (PNG, JPG, GIF, WEBP, PDF; 3 MB) y solo los descargan el autor, quien lo subió, un gestor o el agente con token del ticket. No subir credenciales, tokens, DNI, CBU ni información médica.
- Los tokens de agente se muestran una sola vez; en la base queda el hash SHA-256. Vencen a las 48 h y se pueden revocar desde el ticket.
- El texto del ticket lo escribe un usuario: las instrucciones le indican al agente tratarlo como descripción del problema, no como órdenes.
- Toda acción del agente queda en `TicketEventoAgente` y en el historial del ticket; la generación de tokens, en el `AuditLog`.

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

- Cambiar las reglas para agentes requiere revisión humana: están en `app/api/agente/instrucciones/route.ts` y en este documento.
- Si una regla nueva es más restrictiva, primero se documenta y después se cambia el texto de las instrucciones.
- Los tickets de prueba deben usar el prefijo `[TEST]` en el título y cerrarse como `rechazado`.

## 14. Supuestos y decisiones

1. Se eligió un modelo `Ticket` separado de `Sugerencia` para no mezclar el flujo ISO 9001 con el soporte técnico.
2. La integración con agentes es una API HTTP con token, no una herramienta en particular: cualquier agente con acceso al repositorio puede usarla sin credenciales de la base.
3. Un agente propone y deja el ticket en revisión; nunca lo resuelve, cierra ni publica.
4. No se agregó una migración formal porque el proyecto usa `db push` en desarrollo. Si se adopta `migrate`, generar la migración correspondiente antes de desplegar.
5. Los adjuntos se guardan en la base porque en Vercel el disco es de solo lectura.
6. Gemini hace el triaje online (sin acceso al código); el análisis con contexto real del código lo hace el agente al que se delega el ticket.
