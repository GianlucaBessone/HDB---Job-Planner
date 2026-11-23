-- Vuelta de 20261123_limpieza_p38. Primero volver el código.
-- "impactsMetrics" vuelve en false (los valores anteriores, con la restauración puntual) y la hora del
-- recordatorio en 16:45.
BEGIN;

ALTER TABLE "ProjectTag" ADD COLUMN "impactsMetrics" BOOLEAN NOT NULL DEFAULT false;

UPDATE "SystemSetting" SET "dailyReminderTime" = '16:45' WHERE "dailyReminderTime" IS NULL;
ALTER TABLE "SystemSetting" ALTER COLUMN "dailyReminderTime" SET DEFAULT '16:45';
ALTER TABLE "SystemSetting" ALTER COLUMN "dailyReminderTime" SET NOT NULL;

COMMIT;
