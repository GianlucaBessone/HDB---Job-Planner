# Migración: tarifas de mano de obra con una sola regla

Auditoría, P20 / FU8. Agrega:

| Cambio | Uso |
|---|---|
| `Operator.manoObraCategoriaId` (TEXT, opcional, FK a `ManoObraCategoria`, `ON DELETE SET NULL`) | Categoría de mano de obra de cada persona (Oficial, Ayudante…) |
| Tabla `ClienteTarifaCategoria` (`clientId`, `categoriaId`, `valorHora`; única por cliente y categoría) | Valor hora propio de un cliente para una categoría |

Regla (`lib/manoObra/tarifa.ts`): excepción del cliente para la persona (`ClientOperatorRate`) → valor del cliente
para la categoría de la persona → valor de la categoría → valor por defecto (`SystemSetting.valorManoObra`).

- **Aditiva**: no modifica datos. Las personas quedan sin categoría y los clientes sin valores propios: hasta que se
  carguen, todo usa el valor por defecto (en OT, antes la hora sin tarifa por persona valía $0).

| Archivo | Qué hace |
|---|---|
| `up.sql` | Agrega la columna, la tabla, índices y claves foráneas, en una transacción |
| `down.sql` | Los quita (se pierden las categorías asignadas y los valores por cliente) |

## Prueba realizada (21/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso
`prisma migrate diff --exit-code` dio 0 diferencias contra el esquema que correspondía.

## Despliegue

> **Estado: aplicada en producción el 21/11/2026 (13:41 UTC)**, proyecto Neon `HDB-JobPlanner`, rama `production`,
> en una transacción. Antes y después: 25 personas y la misma huella de `Operator` (`12fc53de…`). Columna, tabla,
> 3 índices y 3 claves foráneas verificados. Se puede volver con la restauración puntual de Neon a las 13:40 UTC.
> **No volver a ejecutar `up.sql`**: falta solo desplegar el código (paso 4).

**Primero la base, después el código.** El código nuevo lee estas columnas: si se despliega antes, Usuarios,
las OT y el costo del proyecto dan error. El código actual las ignora.

1. **Respaldo**: anotar la hora para la restauración puntual (o rama de Neon desde `production`).
2. **Ida**, con `DATABASE_URL` de producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261121_tarifas_mano_obra/up.sql
   ```
3. **Verificación**: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` sin diferencias de `Operator` ni `ClienteTarifaCategoria`.
4. **Código**: mergear el PR.

**Vuelta**: primero volver el código, después `down.sql`.
