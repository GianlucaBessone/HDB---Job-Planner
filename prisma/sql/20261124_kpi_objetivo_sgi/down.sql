-- Vuelta de 20261124_kpi_objetivo_sgi. Primero volver el código (se pierde qué KPI eran objetivos de calidad).
BEGIN;
ALTER TABLE "Kpi" DROP COLUMN "esSgi";
COMMIT;
