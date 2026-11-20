-- Vuelta de 20261121_cc_cargo_por_orden. Primero volver el código.
-- Los cargos por servicio ya registrados quedan como movimientos sin origen.
BEGIN;

DROP INDEX IF EXISTS "CuentaCorrienteMovimiento_origenTipo_origenId_idx";
ALTER TABLE "CuentaCorrienteMovimiento" DROP COLUMN IF EXISTS "origenId";
ALTER TABLE "CuentaCorrienteMovimiento" DROP COLUMN IF EXISTS "origenTipo";

COMMIT;
