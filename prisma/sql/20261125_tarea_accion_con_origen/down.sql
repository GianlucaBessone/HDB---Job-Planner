-- Vuelta de 20261125_tarea_accion_con_origen (requiere AccionMejora existente: aplicar antes el down de la parte 2
-- si ya se aplicó). Primero volver el código. Se pierden el origen y los campos de calidad de las tareas.
BEGIN;

ALTER TABLE "VerificacionEficacia" DROP CONSTRAINT "VerificacionEficacia_accionMejoraId_fkey";

ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_ncId_fkey";

ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_sugerenciaId_fkey";

ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_riesgoId_fkey";

ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_oportunidadId_fkey";

ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_kpiId_fkey";

DROP INDEX "Tarea_codigo_key";

DROP INDEX "Tarea_origenTipo_idx";

DROP INDEX "Tarea_ncId_idx";

DROP INDEX "Tarea_sugerenciaId_idx";

DROP INDEX "Tarea_kpiId_idx";

ALTER TABLE "Tarea" DROP COLUMN "accionCorrectiva",
DROP COLUMN "beneficioEsperado",
DROP COLUMN "causa",
DROP COLUMN "codigo",
DROP COLUMN "eficacia",
DROP COLUMN "evidencia",
DROP COLUMN "justificacion",
DROP COLUMN "kpiId",
DROP COLUMN "ncId",
DROP COLUMN "oportunidadId",
DROP COLUMN "origenDetalle",
DROP COLUMN "origenTipo",
DROP COLUMN "porcentajeAvance",
DROP COLUMN "riesgoId",
DROP COLUMN "sugerenciaId",
DROP COLUMN "tipoAccion";

ALTER TABLE "VerificacionEficacia" ADD CONSTRAINT "VerificacionEficacia_accionMejoraId_fkey" FOREIGN KEY ("accionMejoraId") REFERENCES "AccionMejora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
