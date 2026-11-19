-- Vuelta de 20261118_presupuestos_horas_dia: quita la columna "horasDia".
-- Las versiones vuelven a estimar el plazo con 8 horas por día.
BEGIN;

ALTER TABLE "PresupuestoServicioVersion" DROP COLUMN IF EXISTS "horasDia";

COMMIT;
