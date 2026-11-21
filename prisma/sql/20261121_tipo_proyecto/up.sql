-- Tipo de proyecto y estados calculados (auditoría, P27). Ver README.
BEGIN;

-- 1. Tipo de proyecto, deducido de los interruptores de cada proyecto existente
ALTER TABLE "Project" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'obra';
UPDATE "Project" SET "tipo" = CASE
    WHEN "proyectoFijo" THEN 'contrato'
    WHEN "generarOS" THEN 'servicio'
    ELSE 'obra'
END;

-- 2. "en_riesgo" y "atrasado" ya no se guardan: se calculan al leer el proyecto (lib/proyectos/salud.ts)
UPDATE "Project" SET "estado" = 'activo' WHERE "estado" IN ('en_riesgo', 'atrasado');

COMMIT;
