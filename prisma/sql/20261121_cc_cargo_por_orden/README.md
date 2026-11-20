# Migración: cargo por orden en la cuenta corriente

Agrega a `CuentaCorrienteMovimiento` dos columnas opcionales y un índice, para saber qué orden
originó un cargo por servicio (auditoría, P15):

| Columna | Tipo | Uso |
|---|---|---|
| `origenTipo` | TEXT, opcional | `OS` (orden de servicio) u `OT_CICLO` (ciclo firmado de una OT) |
| `origenId` | TEXT, opcional | `OrdenServicio.id` u `OtCiclo.id` |

Índice `CuentaCorrienteMovimiento_origenTipo_origenId_idx`, para listar las órdenes que faltan cargar
y no cargar dos veces la misma.

- **Aditiva**: columnas nuevas sin default ni `NOT NULL`. No modifica datos ni otras tablas.
- Los movimientos existentes quedan sin origen (son ventas, cobranzas y ajustes manuales).
- El tipo nuevo `CARGO_SERVICIO` es un valor de la columna `tipo` (TEXT): no necesita cambio de esquema.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Agrega columnas e índice, en una transacción |
| `down.sql` | Los quita, en una transacción (los cargos por servicio quedan sin origen) |

## Prueba realizada (20/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso
`prisma migrate diff --exit-code` dio 0 diferencias contra el esquema que correspondía (el de esta rama
después de la ida, el de `main` después de la vuelta).

## Despliegue

> **Estado: aplicada en producción el 20/11/2026 (21:14 UTC)**, proyecto Neon `HDB-JobPlanner`, rama
> `production`, en una transacción. La tabla tenía 0 movimientos antes y después. Columnas `origenTipo` y
> `origenId` (TEXT, opcionales) e índice `CuentaCorrienteMovimiento_origenTipo_origenId_idx` verificados.
> Se puede volver con la restauración puntual de Neon (6 horas de historial) a las 21:13 UTC.
> **No volver a ejecutar `up.sql`**: falta solo desplegar el código (paso 4).

**Primero la base, después el código.** El código nuevo lee y escribe estas columnas: si se despliega
antes de aplicar la migración, Cuentas corrientes y los cargos manuales dan error. El código actual las
ignora, así que aplicarla antes no afecta nada.

1. **Respaldo**: rama de Neon desde `production` (o anotar la hora para la restauración puntual).
2. **Ida**, con `DATABASE_URL` apuntando a producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261121_cc_cargo_por_orden/up.sql
   ```
3. **Verificación**: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` no debe mostrar diferencias de `CuentaCorrienteMovimiento`.
4. **Código**: mergear el PR y dejar que Vercel despliegue.

**Vuelta** (solo si hace falta): primero volver el código, después
`psql "$DATABASE_URL" -f prisma/sql/20261121_cc_cargo_por_orden/down.sql`.
