# Migración: quitar `MaterialMaestro`

Borra la tabla `MaterialMaestro` (auditoría, P8 y E1). Era el inventario viejo de materiales; desde el PR
de P8 ningún código la lee ni la escribe: los precios de los materiales salen del catálogo de Productos
(`lib/ventas/precioMaterial.ts`).

- **Destructiva**: borra la tabla y sus filas. `down.sql` la recrea **vacía**; los datos solo se recuperan
  con la restauración puntual de Neon.
- **Primero el código, después la base** (al revés que una migración aditiva): el código anterior a P8 lee
  esta tabla. Aplicarla con P8 ya desplegado en producción.

| Archivo | Qué hace |
|---|---|
| `up.sql` | `DROP TABLE "MaterialMaestro"`, en una transacción |
| `down.sql` | La recrea vacía, con la misma estructura |

## Estado de los datos en producción (21/11/2026)

- 7402 materiales; 7393 con precio. Última modificación: 19/11/2026.
- 7299 tienen su producto en el catálogo (mismo código, con o sin ceros a la izquierda, o código de barras).
- **103 no están en el catálogo**. Seis de ellos figuran en materiales de obra: `00665` (ficha RJ45, 3 usos),
  `VIAT` (viáticos, 3), `00583`, `00657`, `00673` y `99` (certificación), 1 uso cada uno. Ninguno se usa en OT.
  Desde P8, esos códigos ya no traen precio automático: en una OT se cargan con el 999999 o se dan de alta
  en el catálogo.

## Prueba realizada (21/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso
`prisma migrate diff --exit-code` dio 0 diferencias contra el esquema que correspondía.

## Despliegue

> **Estado: aplicada en producción el 21/11/2026 (13:17 UTC)**, con P8 ya desplegado (13:14 UTC). Antes de
> borrarla se dieron de alta en el catálogo los códigos que no tenían producto (ver abajo). Se puede volver
> con la restauración puntual de Neon (6 horas de historial) a las 13:17 UTC. **No volver a ejecutar `up.sql`.**

### Importación previa al catálogo (21/11/2026 13:15 UTC)

- Se crearon 101 productos (`Producto.id` = `mm_` + md5 del código) con los códigos de `MaterialMaestro` que no
  tenían producto, salvo `VIAT` (viáticos) y `99` (certificación), que no son materiales. Unidad "Unidad".
  `precioBase` = precio de `MaterialMaestro` / 1,10: en el catálogo ese precio era el base más 10% (lista
  ARCOR_10) en 850 de los materiales que estaban en las dos tablas, así cada uno conserva su precio en esa lista.
- Ningún producto existente se modificó: se saltó todo código que ya estuviera en el catálogo (con o sin ceros a
  la izquierda o como código de barras).
- Quedaron **inactivos** 27 de los importados: 20 "ARTICULO GENERICO" (`99980`–`99999`), 3 "Contactor Modular
  Schneider Test" y 4 repetidos sin ceros del mismo material (`657`, `672`, `673`, `8002`; quedan activos
  `00657`, `00672`, `00673`, `08002`). `00672` tomó el precio de `672` ($41.045,45; el de `00672` era $77).
- `665` (farol LED) y `00665` (ficha RJ45) son productos distintos: la búsqueda por código prefiere el SKU exacto.

1. **Respaldo**: anotar la hora para la restauración puntual (o rama de Neon desde `production`).
2. **Ida**, con `DATABASE_URL` apuntando a producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261121_quitar_material_maestro/up.sql
   ```
3. **Verificación**: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` no debe mostrar `MaterialMaestro`.

**Vuelta** (solo si hace falta): `psql "$DATABASE_URL" -f prisma/sql/20261121_quitar_material_maestro/down.sql`
y restaurar los datos desde Neon.
