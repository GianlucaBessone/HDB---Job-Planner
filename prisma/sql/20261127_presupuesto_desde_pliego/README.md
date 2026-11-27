# Migración: presupuesto desde el pliego

Auditoría, P36 (conectar Pliegos con Presupuestos). Agrega `PresupuestoServicio.pliegoId` (opcional, FK a `Pliego`
con `ON DELETE SET NULL`): el presupuesto armado desde el análisis de un pliego queda vinculado a él, y el pliego
lista sus presupuestos.

- **Aditiva: primero la base, después el código.** Los presupuestos existentes quedan sin pliego.
- `down.sql` quita la columna, el índice y la clave foránea (primero volver el código).

## Despliegue

> **Estado: aplicada en producción el 27/11/2026 (12:30 UTC)**, antes del merge. 1 presupuesto existente, sin pliego.


1. `psql "$DATABASE_URL" -f prisma/sql/20261127_presupuesto_desde_pliego/up.sql`
2. Mergear el PR.
