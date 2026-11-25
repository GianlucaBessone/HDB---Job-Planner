-- Acción con origen (P31 etapa 2), parte 2 de 2: quita AccionMejora y PlanAccionKpi (sus datos viven en Tarea).
-- Destructiva: primero el código (PR mergeado y desplegado), después la base. En producción están vacías.
BEGIN;

ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_responsableId_fkey";

ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_ncId_fkey";

ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_sugerenciaId_fkey";

ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_riesgoId_fkey";

ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_oportunidadId_fkey";

ALTER TABLE "PlanAccionKpi" DROP CONSTRAINT "PlanAccionKpi_kpiId_fkey";

ALTER TABLE "PlanAccionKpi" DROP CONSTRAINT "PlanAccionKpi_responsableId_fkey";

DROP TABLE "AccionMejora";

DROP TABLE "PlanAccionKpi";

COMMIT;
