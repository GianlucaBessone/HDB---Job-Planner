# Migración: presupuestos de servicio → proyectos

Migración **aditiva** para el módulo de presupuestos de servicio y el wizard de proyectos.

- Crea 11 tablas nuevas, sus índices y claves foráneas, un trigger que vuelve inmutable la
  copia congelada del presupuesto aceptado y 4 categorías iniciales de mano de obra
  (valor hora en 0).
- **No altera, renombra ni borra** columnas o tablas existentes. La tabla `Project` no cambia:
  el vínculo opcional proyecto ↔ presupuesto vive en `PresupuestoServicio.proyectoId`.
- No está en `prisma/migrations` a propósito: el proyecto trabaja con `db push` y ese historial
  está desactualizado, así que `prisma migrate deploy` no se debe usar.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Ida, en una transacción |
| `down.sql` | Vuelta: borra solo lo que creó `up.sql`, en una transacción |

Tablas nuevas: `ManoObraCategoria`, `PresupuestoServicioCounter`, `PresupuestoServicio`,
`PresupuestoServicioVersion`, `PresupuestoServicioTarea`, `PresupuestoServicioManoObra`,
`PresupuestoServicioMaterial`, `PresupuestoServicioSnapshot`, `ProyectoTarea`,
`ProyectoAsignacion`, `ProyectoBorrador`.

## Prueba realizada (18/11/2026)

1. **Base local vacía** (PostgreSQL 16) con el esquema anterior: ida, vuelta e ida otra vez.
   `prisma migrate diff` contra el esquema nuevo y contra el anterior dio 0 diferencias en cada paso.
2. **Copia de producción** (rama de Neon `test-presupuestos-2026-11-18`, PostgreSQL 17, con
   datos reales: 117 proyectos, 1929 registros de horas, 892 materiales de proyecto):
   - Antes y después de la ida, y después de la vuelta, la huella (cantidad de filas + MD5) de
     `Project`, `TimeEntry`, `MaterialProyecto`, `MaterialUso`, `Planning`, `Operator`,
     `HdbClient`, `ListaPrecio`, `Producto`, `Cotizacion`, `Venta` y `ChecklistItem` fue idéntica.
   - La estructura creada (columnas, restricciones, índices, triggers) es idéntica a la de la
     prueba local.
   - El trigger rechazó `UPDATE`, `DELETE` y `TRUNCATE` sobre la copia congelada, y la clave
     foránea impidió borrar un presupuesto aceptado.
   - La vuelta dejó 0 tablas nuevas y las tablas existentes sin cambios.

## Despliegue en producción

El orden importa: **primero la base, después el código.** El código anterior ignora las tablas
nuevas, así que aplicar la migración antes del deploy no afecta a nadie.

### 1. Respaldo

Elegí una (o las dos):

- **Rama de Neon** (instantánea, recomendado): en la consola de Neon, proyecto *HDB-JobPlanner* →
  Branches → *Create branch* desde `production`, con nombre `respaldo-antes-presupuestos-AAAA-MM-DD`.
  Es el mismo criterio que los respaldos `respaldo-antes-…` que ya existen. Si el proyecto llegó al
  límite de ramas, borrá antes una rama vieja que no se use.
- **Volcado completo**, con la URL directa (sin `-pooler`):

  ```bash
  pg_dump "$DATABASE_URL_DIRECTA" --format=custom --no-owner --file=hdb_antes_presupuestos_$(date +%F).dump
  ```

  Comprobá que se puede leer:

  ```bash
  pg_restore --list hdb_antes_presupuestos_$(date +%F).dump | head
  ```

### 2. Aplicar la ida

Desde una máquina con acceso a la base, con `DATABASE_URL` apuntando a producción por la URL
directa:

```bash
npx prisma db execute --file prisma/sql/20261118_presupuestos_servicio/up.sql --schema prisma/schema.prisma
```

Alternativa sin consola: pegar `up.sql` completo en el SQL Editor de Neon (rama `production`)
y ejecutarlo.

### 3. Verificar

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

Las tablas nuevas no deben aparecer en el resultado. Si aparecen diferencias en otras tablas, son
desvíos previos entre la base y el esquema (no los produce esta migración): no aplicar ningún
`db push` para "arreglarlos" sin revisarlos.

Comprobación rápida en SQL:

```sql
SELECT count(*) FROM "ManoObraCategoria";  -- 4
```

### 4. Desplegar el código

Merge del PR y deploy habitual en Vercel.

### 5. Configurar

En **Ventas y Comercial › Presupuestos de servicios › Mano de obra**, cargar el valor hora de cada categoría.

## Reversión

1. **Volver el código**: en Vercel, *Instant Rollback* al deploy anterior. Con eso alcanza para
   dejar de usar el módulo: las tablas nuevas pueden quedar en la base sin afectar nada.
2. **Si además hay que borrar las tablas**, primero exportá sus datos (presupuestos, copias
   congeladas, tareas y asignaciones de proyectos):

   ```bash
   pg_dump "$DATABASE_URL_DIRECTA" --format=custom --data-only --file=hdb_presupuestos_$(date +%F).dump \
     -t '"ManoObraCategoria"' -t '"PresupuestoServicioCounter"' -t '"PresupuestoServicio"' \
     -t '"PresupuestoServicioVersion"' -t '"PresupuestoServicioTarea"' -t '"PresupuestoServicioManoObra"' \
     -t '"PresupuestoServicioMaterial"' -t '"PresupuestoServicioSnapshot"' -t '"ProyectoTarea"' \
     -t '"ProyectoAsignacion"' -t '"ProyectoBorrador"'
   ```

   y después:

   ```bash
   npx prisma db execute --file prisma/sql/20261118_presupuestos_servicio/down.sql --schema prisma/schema.prisma
   ```

   Los proyectos creados desde un presupuesto **no se borran**: quedan como proyectos comunes
   (con sus horas, materiales y checklist), solo pierden el vínculo con el presupuesto.
3. **Solo ante un desastre**: restaurar `production` desde la rama de respaldo en la consola de
   Neon. Se pierde todo lo cargado después del respaldo, en todos los módulos.

## Copia congelada inmutable

`PresupuestoServicioSnapshot` solo acepta `INSERT`. Si alguna vez hiciera falta corregir una fila
por un error grave, lo hace una persona con acceso de administrador a la base, dejando constancia:

```sql
BEGIN;
ALTER TABLE "PresupuestoServicioSnapshot" DISABLE TRIGGER "PresupuestoServicioSnapshot_inmutable";
-- corrección puntual, documentada en Auditoría
ALTER TABLE "PresupuestoServicioSnapshot" ENABLE TRIGGER "PresupuestoServicioSnapshot_inmutable";
COMMIT;
```

La aplicación verifica el hash SHA-256 al mostrar la copia: una fila tocada a mano aparece como
"Alterada".
