# Migración: horas de trabajo por día en presupuestos de servicio

Agrega `horasDia` (DOUBLE PRECISION, NOT NULL, default 8) a `PresupuestoServicioVersion`.
Es la jornada de trabajo con la que se estima el plazo del presupuesto; el asistente de proyectos
la toma como "Horas por día" al convertir.

- **Aditiva**: una columna nueva con default. No toca otras columnas ni tablas.
- Las versiones existentes quedan con 8, que es lo que el sistema asumía hasta ahora: sus plazos no
  cambian.
- Las copias congeladas ya aceptadas no se modifican (son inmutables). Si no tienen `horasDia`, el
  código usa 8.
- En PostgreSQL 11 o posterior, agregar una columna con default constante no reescribe la tabla:
  es instantáneo.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Agrega la columna, en una transacción |
| `down.sql` | La quita, en una transacción |

## Prueba realizada (18/11/2026)

Base local (PostgreSQL 16) con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso,
`prisma migrate diff` dio 0 diferencias contra el esquema que correspondía (el de esta rama después de
la ida, el de `main` después de la vuelta). Los tests de integración y de regresión pasan con la
columna.

## Despliegue

**Importante: primero la base, después el código.** El código nuevo lee la columna. Si se despliega
antes de aplicar la migración, la sección Presupuestos de servicios da error hasta que se aplique.
El código actual ignora la columna, así que aplicarla antes no afecta nada.

1. **Respaldo**: rama de Neon `respaldo-antes-horas-dia-AAAA-MM-DD` desde `production`.
2. **Ida**, con `DATABASE_URL` apuntando a producción por la URL directa (sin `-pooler`):

   ```bash
   npx prisma db execute --file prisma/sql/20261118_presupuestos_horas_dia/up.sql --schema prisma/schema.prisma
   ```

   O pegar `up.sql` en el SQL Editor de Neon (rama `production`).
3. **Verificar**:

   ```sql
   SELECT column_name, data_type, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'PresupuestoServicioVersion' AND column_name = 'horasDia';
   -- horasDia | double precision | 8 | NO
   ```

4. **Código**: merge del PR y deploy.

## Reversión

1. Volver el código con *Instant Rollback* en Vercel. La columna puede quedar: el código anterior
   la ignora.
2. Si además hay que quitarla:

   ```bash
   npx prisma db execute --file prisma/sql/20261118_presupuestos_horas_dia/down.sql --schema prisma/schema.prisma
   ```

   Se pierden las horas por día cargadas en los presupuestos (vuelven a estimarse con 8). Las copias
   congeladas conservan su valor.
