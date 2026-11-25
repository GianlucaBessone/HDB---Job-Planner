# Migración: Tarea como acción con origen (P31 etapa 2, parte 1 de 2)

Auditoría, P31 / FU9. `Tarea` pasa a ser la única entidad de "algo que alguien tiene que hacer para una fecha":

| Cambio | Detalle |
|---|---|
| `Tarea.origenTipo` | `libre` (por defecto), `proyecto`, `nc`, `sugerencia`, `riesgo`, `oportunidad`, `kpi`, `calidad` |
| Vínculos | `ncId`, `sugerenciaId` (cascade), `riesgoId`, `oportunidadId`, `kpiId` (restrict), con índices |
| Campos de CAPA | `codigo` (único, CAPA-AAAA-0001), `tipoAccion`, `origenDetalle`, `justificacion`, `beneficioEsperado`, `porcentajeAvance`, `eficacia`, `evidencia` |
| Campos de plan de KPI | `causa`, `accionCorrectiva` |
| `VerificacionEficacia.accionMejoraId` | La clave foránea pasa de `AccionMejora` a `Tarea` |

Una acción de mejora es una tarea con `tipoAccion`; un plan de KPI, una tarea con `kpiId`. El responsable es el
involucrado con rol "responsable". Las APIs de CAPA y de planes de acción devuelven el mismo formato que antes
(`lib/acciones.ts`).

En producción (25/11/2026): 16 tareas, **0 acciones de mejora y 0 planes de KPI**: no hay datos que migrar.

- **Aditiva: primero la base, después el código.** El cambio de la clave foránea de `VerificacionEficacia` no
  afecta al código actual porque no hay acciones de mejora.
- `down.sql`: vuelve la clave foránea a `AccionMejora` y quita los campos (requiere que `AccionMejora` exista:
  si ya se aplicó la parte 2, primero su `down.sql`). Primero volver el código.

## Prueba realizada (25/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: partes 1 y 2 de ida, vuelta (2 y 1) e ida otra vez. En cada
paso `prisma migrate diff --exit-code` dio 0 diferencias.

## Despliegue

> **Estado: aplicada en producción el 25/11/2026 (12:56 UTC)**, antes del merge. 16 columnas en `Tarea`, 5 claves foráneas, `VerificacionEficacia.accionMejoraId` → `Tarea`; las 16 tareas quedaron con origen `libre`.

1. `psql "$DATABASE_URL" -f prisma/sql/20261125_tarea_accion_con_origen/up.sql`
2. Mergear el PR.
3. Aplicar la parte 2 (`20261125_quitar_accionmejora_plankpi`) con el código ya desplegado.
