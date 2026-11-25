-- Acción con origen (auditoría, P31 etapa 2 / FU9), parte 1 de 2: Tarea suma origen, vínculos y campos de
-- CAPA y planes de KPI; la verificación de eficacia pasa a apuntar a Tarea. Aditiva: primero la base, después el
-- código. Ver README.
BEGIN;

ALTER TABLE "VerificacionEficacia" DROP CONSTRAINT "VerificacionEficacia_accionMejoraId_fkey";

ALTER TABLE "Tarea" ADD COLUMN     "accionCorrectiva" TEXT,
ADD COLUMN     "beneficioEsperado" TEXT,
ADD COLUMN     "causa" TEXT,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "eficacia" TEXT,
ADD COLUMN     "evidencia" TEXT,
ADD COLUMN     "justificacion" TEXT,
ADD COLUMN     "kpiId" TEXT,
ADD COLUMN     "ncId" TEXT,
ADD COLUMN     "oportunidadId" TEXT,
ADD COLUMN     "origenDetalle" TEXT,
ADD COLUMN     "origenTipo" TEXT NOT NULL DEFAULT 'libre',
ADD COLUMN     "porcentajeAvance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "riesgoId" TEXT,
ADD COLUMN     "sugerenciaId" TEXT,
ADD COLUMN     "tipoAccion" TEXT;

CREATE UNIQUE INDEX "Tarea_codigo_key" ON "Tarea"("codigo");

CREATE INDEX "Tarea_origenTipo_idx" ON "Tarea"("origenTipo");

CREATE INDEX "Tarea_ncId_idx" ON "Tarea"("ncId");

CREATE INDEX "Tarea_sugerenciaId_idx" ON "Tarea"("sugerenciaId");

CREATE INDEX "Tarea_kpiId_idx" ON "Tarea"("kpiId");

ALTER TABLE "VerificacionEficacia" ADD CONSTRAINT "VerificacionEficacia_accionMejoraId_fkey" FOREIGN KEY ("accionMejoraId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_ncId_fkey" FOREIGN KEY ("ncId") REFERENCES "NoConformidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_sugerenciaId_fkey" FOREIGN KEY ("sugerenciaId") REFERENCES "Sugerencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "Riesgo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
