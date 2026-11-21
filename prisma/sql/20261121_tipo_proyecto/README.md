# Migración: tipo de proyecto y estados calculados

Auditoría, P27 (SE5, E8). Dos cambios:

| Cambio | Detalle |
|---|---|
| `Project.tipo` (TEXT, `'obra'` por defecto) | `obra`, `servicio` (puntual, con OS), `contrato` (de mantenimiento, proyecto fijo con OT) o `interno`. Propone los interruptores al crear o cambiar de tipo (`lib/proyectos/tipos.ts`) |
| Estados `en_riesgo` y `atrasado` | Dejan de guardarse: pasan a `activo` y se calculan al leer el proyecto (`lib/proyectos/salud.ts`) |

Tipo de los proyectos existentes, según sus interruptores: proyecto fijo → `contrato`; con OS → `servicio`;
el resto → `obra`. Los internos (taller, capacitación) se marcan a mano después.

Reglas de la alerta (solo proyectos activos o planificados):

- **Atrasado**: la fecha de fin ya pasó. Antes lo escribía un proceso en la base y no volvía atrás aunque se
  corriera la fecha.
- **En riesgo**: consumió el 90% o más de las horas estimadas; o vence en 7 días o menos con el checklist por
  debajo del 80%; o tiene un "Bloqueante" en la bitácora en los últimos 7 días.

En producción (21/11/2026): 120 proyectos; 3 con estado `atrasado` guardado, que pasan a `activo` y vuelven a
figurar atrasados si su fecha de fin ya pasó.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Agrega la columna, deduce el tipo y pasa `en_riesgo`/`atrasado` a `activo`, en una transacción |
| `down.sql` | Quita la columna. Los estados quedan en `activo` (el código viejo vuelve a marcar `atrasado` los vencidos) |

## Prueba realizada (21/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez. En cada paso
`prisma migrate diff --exit-code` dio 0 diferencias contra el esquema que correspondía.

## Despliegue

> **Estado: aplicada en producción el 21/11/2026 (14:46 UTC)**, proyecto Neon `HDB-JobPlanner`, rama `production`,
> en una transacción. Antes: 120 proyectos, 3 con `atrasado` guardado, 7 fijos, 87 con OS (huella `1a60628d…`).
> Después: 87 `servicio`, 26 `obra`, 7 `contrato`; ningún `en_riesgo`/`atrasado` guardado; columna `NOT NULL`
> con valor por defecto `'obra'`. Hasta desplegar el código, el actual vuelve a grabar `atrasado` en los vencidos
> (inofensivo). **No volver a ejecutar `up.sql`**: falta solo desplegar el código (paso 4).

**Primero la base, después el código.** El código nuevo lee y escribe `tipo`; el actual la ignora (la columna
tiene valor por defecto). Pasar `atrasado` a `activo` antes del código nuevo es inofensivo: el código actual lo
vuelve a escribir al leer los proyectos.

1. **Respaldo**: anotar la hora para la restauración puntual.
2. **Ida**, con `DATABASE_URL` de producción por la URL directa (sin `-pooler`):
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261121_tipo_proyecto/up.sql
   ```
3. **Verificación**: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma` sin diferencias de `Project`.
4. **Código**: mergear el PR.

**Vuelta**: primero volver el código, después `down.sql`.
