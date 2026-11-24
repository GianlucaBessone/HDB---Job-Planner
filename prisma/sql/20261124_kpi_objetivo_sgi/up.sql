-- Objetivos de calidad como KPI marcados "SGI" (auditoría, P30 / FU7). Aditiva: primero la base, después el código.
BEGIN;
ALTER TABLE "Kpi" ADD COLUMN "esSgi" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
