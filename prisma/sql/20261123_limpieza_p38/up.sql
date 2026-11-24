-- Limpieza de código y datos sin uso (auditoría, P38). Ver README. Destructiva: primero el código.
BEGIN;

-- 1. "Impacta métricas" en las etiquetas: no tenía efecto
ALTER TABLE "ProjectTag" DROP COLUMN "impactsMetrics";

-- 2. Hora del recordatorio diario sin valor preseteado: se elige en Configuración (sin hora no se envía)
ALTER TABLE "SystemSetting" ALTER COLUMN "dailyReminderTime" DROP NOT NULL;
ALTER TABLE "SystemSetting" ALTER COLUMN "dailyReminderTime" DROP DEFAULT;
UPDATE "SystemSetting" SET "dailyReminderTime" = NULL;

COMMIT;
