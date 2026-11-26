# Migración: permisos del portal del cliente

Auditoría, faltante "Portal del cliente completo". Agrega a `ClientResponsable` dos permisos por responsable,
**apagados por defecto** (ningún responsable existente gana acceso al aplicar la migración):

- `verCuentaCorriente`: ve el estado de cuenta del cliente en el portal.
- `aprobarPresupuestos`: puede aceptar o rechazar desde el portal los presupuestos de servicio enviados.

Se tildan en la ficha del cliente → Tarifas, responsables y sectores → Responsables.

- **Aditiva: primero la base, después el código.**
- `down.sql` quita las dos columnas (primero volver el código).

## Despliegue

1. `psql "$DATABASE_URL" -f prisma/sql/20261126_portal_permisos/up.sql`
2. Mergear el PR.
