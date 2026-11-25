# Migración: quitar AccionMejora y PlanAccionKpi (P31 etapa 2, parte 2 de 2)

Auditoría, P31 / FU9. Las acciones de mejora y los planes de acción de KPI ahora son tareas (parte 1:
`20261125_tarea_accion_con_origen`). Se borran las tablas `AccionMejora` y `PlanAccionKpi`.

En producción (25/11/2026) las dos están **vacías**: no se pierden datos.

- **Destructiva: primero el código (PR mergeado y desplegado), después la base.** El código actual las usa.
- Antes de aplicar, verificar que sigan vacías: `select count(*) from "AccionMejora"` y `"PlanAccionKpi"` → 0.
- `down.sql` recrea las dos tablas vacías con sus índices y claves foráneas.

## Despliegue

> **Estado: aplicada en producción el 25/11/2026 (13:15 UTC)**, después del merge del PR #80 y de su despliegue. Antes: 0 acciones y 0 planes. Después: sin `AccionMejora` ni `PlanAccionKpi`; 16 tareas intactas; `VerificacionEficacia` apunta a `Tarea`.

1. Parte 1 aplicada, PR mergeado y desplegado.
2. Verificar que estén vacías.
3. `psql "$DATABASE_URL" -f prisma/sql/20261125_quitar_accionmejora_plankpi/up.sql`
