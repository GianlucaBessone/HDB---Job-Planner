# Migración: quitar ObjetivoCalidad (P30, parte 2 de 2)

Auditoría, P30 / FU7. Los objetivos de calidad ahora son KPI con `esSgi = true` (parte 1:
`20261124_kpi_objetivo_sgi`). Se quitan la tabla `ObjetivoCalidad` y la columna `AccionMejora.objetivoId`, con su
API (`/api/sgi/objetivos`) y su pantalla vieja.

En producción (24/11/2026): **0 objetivos de calidad** y 0 acciones vinculadas; no se pierden datos.

- **Destructiva: primero el código (el PR mergeado), después la base.** El código actual todavía usa la tabla.
- `down.sql` recrea la tabla vacía y la columna (después volver el código).

## Despliegue

> **Estado: aplicada en producción el 25/11/2026 (11:43 UTC)**, después del merge del PR #79 y de su despliegue. Antes: 0 objetivos y 0 acciones vinculadas. Después: sin `ObjetivoCalidad` ni `AccionMejora.objetivoId`; 5 KPI con `esSgi`.


1. Parte 1 aplicada y PR mergeado.
2. Verificar que siga vacía: `select count(*) from "ObjetivoCalidad"` → 0.
3. `psql "$DATABASE_URL" -f prisma/sql/20261124_quitar_objetivo_calidad/up.sql`
