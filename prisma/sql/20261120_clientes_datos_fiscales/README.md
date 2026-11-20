# Migración: datos fiscales del cliente

Agrega a `HdbClient` tres columnas opcionales y un índice:

| Columna | Tipo | Uso |
|---|---|---|
| `razonSocial` | TEXT, opcional | Nombre legal; si falta, se usa `nombre` |
| `cuit` | TEXT, opcional | Formato `30-12345678-9` (lo normaliza la API) |
| `condicionIva` | TEXT, opcional | Una de `CONDICIONES_IVA` (`lib/ventas/proveedorVentas.ts`) |

Índice `HdbClient_cuit_idx` sobre `cuit`, para buscar clientes por CUIT.

- **Aditiva**: columnas nuevas sin default ni `NOT NULL`. No modifica datos ni otras tablas.
- Los clientes existentes quedan sin datos fiscales; se completan desde la ficha del cliente.
- Ventas y cotizaciones siguen guardando su copia (`clienteIdentificacion`) en cada documento: el
  dato del cliente solo se usa para precargarla.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Agrega columnas e índice, en una transacción |
| `down.sql` | Los quita, en una transacción (se pierden los datos fiscales cargados) |

## Prueba realizada (20/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso
`prisma migrate diff --exit-code` dio 0 diferencias contra el esquema que correspondía (el de esta rama
después de la ida, el de `main` después de la vuelta).

## Despliegue

> **Estado: aplicada en producción el 20/11/2026 (10:06 UTC)**, proyecto Neon `HDB-JobPlanner`, rama
> `production`, en una transacción. Sin rama de respaldo nueva: se puede volver con la restauración
> puntual de Neon (6 horas de historial) a las 10:06 UTC. Antes y después: 36 clientes y la misma huella
> MD5 de las columnas existentes (`2423e96e…`). Columnas `razonSocial`, `cuit` y `condicionIva` (TEXT,
> opcionales) e índice `HdbClient_cuit_idx` verificados. **No volver a ejecutar `up.sql`**: falta solo
> desplegar el código (paso 4).

**Primero la base, después el código.** El código nuevo lee estas columnas: si se despliega antes de
aplicar la migración, la sección Clientes y todo lo que lista clientes da error. El código actual
las ignora, así que aplicarla antes no afecta nada.

1. **Respaldo**: rama de Neon desde `production` (o anotar la hora para la restauración puntual).
2. **Ida**, con `DATABASE_URL` apuntando a producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261120_clientes_datos_fiscales/up.sql
   ```
3. **Verificación**: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` no debe mostrar diferencias de `HdbClient`.
4. **Código**: mergear el PR y dejar que Vercel despliegue.

**Vuelta** (solo si hace falta): primero volver el código, después
`psql "$DATABASE_URL" -f prisma/sql/20261120_clientes_datos_fiscales/down.sql`.
