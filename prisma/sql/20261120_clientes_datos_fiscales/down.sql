-- Vuelta de 20261120_clientes_datos_fiscales: quita las columnas fiscales y su índice.
-- Se pierden los datos fiscales cargados después de la ida.
BEGIN;

DROP INDEX IF EXISTS "HdbClient_cuit_idx";
ALTER TABLE "HdbClient" DROP COLUMN IF EXISTS "condicionIva";
ALTER TABLE "HdbClient" DROP COLUMN IF EXISTS "cuit";
ALTER TABLE "HdbClient" DROP COLUMN IF EXISTS "razonSocial";

COMMIT;
