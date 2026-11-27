# Migración: solicitudes y aprobaciones

Auditoría, faltante "Solicitudes y aprobaciones como objeto propio" (F8). Crea la tabla `Solicitud`: un pedido de
autorización con tipo, objeto (`entidadTipo` + `entidadId`), motivo, cambio propuesto (`datos`), la función del
catálogo que lo puede aprobar, estado (`pendiente`, `aprobada`, `rechazada`, `cancelada`) y quién lo resolvió, cuándo
y con qué comentario.

Reemplaza a los avisos con botones `TIME_MODIFICATION_REQUEST` y `PROJECT_FINALIZE_REQUEST` (los pendientes viejos
se siguen pudiendo resolver desde la campana).

- **Aditiva: primero la base, después el código.** No toca tablas existentes (solo claves foráneas a `Operator`).
- `down.sql` borra la tabla (primero volver el código).

## Despliegue

> **Estado: aplicada en producción el 27/11/2026 (16:06 UTC)**, antes del merge. Tabla, 2 claves foráneas y 3 índices creados.


1. `psql "$DATABASE_URL" -f prisma/sql/20261127_solicitudes/up.sql`
2. Mergear el PR.
