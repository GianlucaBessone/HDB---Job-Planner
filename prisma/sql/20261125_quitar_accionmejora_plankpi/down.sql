-- Vuelta de 20261125_quitar_accionmejora_plankpi: recrea AccionMejora y PlanAccionKpi vacías (sus datos quedan
-- en Tarea). Después, para volver del todo, aplicar el down de 20261125_tarea_accion_con_origen y volver el código.
BEGIN;

CREATE TABLE "AccionMejora" (
    "id" TEXT NOT NULL,
    "codigoAccion" TEXT,
    "tipoAccion" TEXT NOT NULL DEFAULT 'Mejora Continua',
    "origen" TEXT NOT NULL DEFAULT 'Otro',
    "descripcion" TEXT NOT NULL,
    "justificacion" TEXT,
    "beneficioEsperado" TEXT,
    "responsableId" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'Media',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaInicio" TIMESTAMP(3),
    "fechaCompromiso" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "porcentajeAvance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "eficacia" TEXT,
    "evidencia" TEXT,
    "observaciones" TEXT,
    "ncId" TEXT,
    "sugerenciaId" TEXT,
    "riesgoId" TEXT,
    "oportunidadId" TEXT,
    "auditoriaId" TEXT,
    "documentoId" TEXT,
    "capacitacionId" TEXT,
    "proyectoMejoraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccionMejora_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanAccionKpi" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "causa" TEXT,
    "accionCorrectiva" TEXT,
    "responsableId" TEXT,
    "fechaCompromiso" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAccionKpi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccionMejora_codigoAccion_key" ON "AccionMejora"("codigoAccion");

CREATE INDEX "AccionMejora_ncId_idx" ON "AccionMejora"("ncId");

CREATE INDEX "AccionMejora_sugerenciaId_idx" ON "AccionMejora"("sugerenciaId");

CREATE INDEX "AccionMejora_responsableId_idx" ON "AccionMejora"("responsableId");

CREATE INDEX "PlanAccionKpi_kpiId_idx" ON "PlanAccionKpi"("kpiId");

CREATE INDEX "PlanAccionKpi_estado_idx" ON "PlanAccionKpi"("estado");

CREATE INDEX "PlanAccionKpi_responsableId_idx" ON "PlanAccionKpi"("responsableId");

ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_ncId_fkey" FOREIGN KEY ("ncId") REFERENCES "NoConformidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_sugerenciaId_fkey" FOREIGN KEY ("sugerenciaId") REFERENCES "Sugerencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "Riesgo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanAccionKpi" ADD CONSTRAINT "PlanAccionKpi_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanAccionKpi" ADD CONSTRAINT "PlanAccionKpi_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
