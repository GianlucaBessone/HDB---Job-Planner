# Migración: KPI como objetivo de calidad (P30, parte 1 de 2)

Auditoría, P30 / FU7. Agrega `Kpi.esSgi` (BOOLEAN, `false` por defecto): un objetivo de calidad del SGI pasa a
ser un KPI marcado "Objetivo de calidad (SGI)", con medición, meta numérica, historial y planes de acción.
Reemplaza a `ObjetivoCalidad` (indicador y meta como texto libre), que se quita en
`20261124_quitar_objetivo_calidad` (parte 2).

- **Aditiva: primero la base, después el código.** El código nuevo lee y escribe `esSgi`.
- `down.sql` quita la columna (primero volver el código).

## Despliegue

1. `psql "$DATABASE_URL" -f prisma/sql/20261124_kpi_objetivo_sgi/up.sql`
2. Mergear el PR.
3. Aplicar la parte 2.
