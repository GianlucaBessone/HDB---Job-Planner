-- Quita el modelo viejo de objetivos de calidad (auditoría, P30 / FU7): ahora son KPI con esSgi = true.
-- Destructiva: primero el código, después la base. En producción la tabla está vacía (24/11/2026).
BEGIN;
ALTER TABLE "AccionMejora" DROP CONSTRAINT "AccionMejora_objetivoId_fkey";
ALTER TABLE "AccionMejora" DROP COLUMN "objetivoId";
DROP TABLE "ObjetivoCalidad";
COMMIT;
