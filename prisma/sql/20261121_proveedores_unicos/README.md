# Migración: proveedores únicos

Auditoría, P24 / FU5. Había dos maestros de proveedores: `Proveedor` (Gastos y facturas, CUIT obligatorio) y
`ProveedorVentas` (productos, CUIT opcional), y el mismo proveedor se cargaba dos veces, a veces con el CUIT
escrito distinto. Queda uno solo: `ProveedorVentas`.

| Cambio | Detalle |
|---|---|
| Proveedores de Gastos → `ProveedorVentas` | Conservan su `id` (las facturas no cambian de `proveedorId` salvo en las fusiones). `domicilio` pasa a `direccion` |
| CUIT con formato único | `30-12345678-9` en todo el maestro |
| Fusión de duplicados | Mismo CUIT escrito con o sin guiones = un proveedor (queda el más antiguo, o el de Ventas si ya existía). Un CUIT con dígito verificador inválido (error de escaneo) se fusiona con el CUIT válido de la misma razón social |
| `FacturaConsumo.proveedorId` | Clave foránea a `ProveedorVentas` (`ON DELETE RESTRICT`) |
| `ProveedorVentas.cuit` | Pasa a ser único (antes índice simple) |
| Tabla `Proveedor` | Se borra |

En producción (21/11/2026): 28 proveedores de Gastos, 63 facturas y 2 proveedores de Ventas, sin CUIT en común.
Quedan 26 proveedores: STRUMIA ARIEL JOSE (2 → 1) y CORREDORES VIALES SOCIEDAD ANONIMA (4 → 1, dos de ellos con el
CUIT mal escaneado: `30715304812` y `30715804612`, que no pasan el dígito verificador).

**Mueve datos y borra una tabla.** Hacer respaldo antes (restauración puntual de Neon).

| Archivo | Qué hace |
|---|---|
| `up.sql` | Todo lo anterior, en una transacción |
| `down.sql` | Recrea `Proveedor` con los proveedores que tienen facturas y vuelve la clave foránea. Las fusiones **no** se separan: para el estado exacto, restauración puntual |

## Prueba realizada (21/11/2026)

Base local PostgreSQL 16 con el esquema de `main` y los 28 proveedores de Gastos y 2 de Ventas de producción
(facturas de prueba): ida, vuelta e ida otra vez. En cada paso `prisma migrate diff --exit-code` dio 0
diferencias contra el esquema que correspondía. Tras la ida: 26 proveedores, todas las facturas conservadas,
CORREDORES VIALES con las facturas de los 4 registros bajo `30-71580481-2`.

## Despliegue

> **Estado: aplicada en producción el 21/11/2026 (14:19 UTC)**, proyecto Neon `HDB-JobPlanner`, rama `production`,
> en una transacción. Antes: 28 proveedores de Gastos, 2 de Ventas, 63 facturas, 3727 vínculos producto-proveedor.
> Después: 26 proveedores, 63 facturas (ninguna sin proveedor), 3727 vínculos; STRUMIA con 3 facturas y
> CORREDORES VIALES (`30-71580481-2`) con 6; tabla `Proveedor` borrada; clave foránea e índice único verificados.
> Se puede volver con la restauración puntual de Neon a las 14:18 UTC. **No volver a ejecutar `up.sql`**: falta
> solo desplegar el código (paso 4).

**La base y el código van juntos.** El código actual usa la tabla `Proveedor` (Gastos deja de funcionar apenas se
aplica `up.sql`) y el nuevo necesita la clave foránea a `ProveedorVentas`. Aplicar `up.sql` y mergear el PR
uno detrás del otro, en un momento sin carga de gastos.

1. **Respaldo**: anotar la hora para la restauración puntual.
2. **Ida**, con `DATABASE_URL` de producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261121_proveedores_unicos/up.sql
   ```
3. **Verificación**: 26 proveedores, 63 facturas, ninguna factura sin proveedor;
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` sin diferencias.
4. **Código**: mergear el PR enseguida.

**Vuelta**: primero volver el código, después `down.sql` (o restauración puntual).
