-- Vuelta de 20261124_quitar_objetivo_calidad: recrea la tabla vacía y la columna. Después volver el código.
BEGIN;
CREATE TABLE "ObjetivoCalidad" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "indicador" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "unidad" TEXT,
    "frecuenciaMedicion" TEXT,
    "responsableId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "periodo" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "resultadoActual" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObjetivoCalidad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ObjetivoCalidad_codigo_key" ON "ObjetivoCalidad"("codigo");
ALTER TABLE "AccionMejora" ADD COLUMN "objetivoId" TEXT;
ALTER TABLE "AccionMejora" ADD CONSTRAINT "AccionMejora_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "ObjetivoCalidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;
