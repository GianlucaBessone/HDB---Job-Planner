# Migración: horas reales por tarea

Auditoría, faltante "Horas reales por tarea" (fase 2 de presupuestos de servicio). Agrega
`TimeEntry.proyectoTareaId` (opcional, FK a `ProyectoTarea` con `ON DELETE SET NULL`): el registro de horas puede
indicar en qué tarea del proyecto se trabajó, y el presupuestado vs. real y la lista de tareas muestran las horas
reales de cada una.

- **Aditiva: primero la base, después el código.** Los registros existentes quedan sin tarea ("sin tarea" en el
  reporte).
- `down.sql` quita la columna, el índice y la clave foránea (primero volver el código).

## Despliegue

1. `psql "$DATABASE_URL" -f prisma/sql/20261127_horas_por_tarea/up.sql`
2. Mergear el PR.
