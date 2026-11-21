-- Vuelta de 20261121_tarifas_mano_obra. Primero volver el código.
-- Se pierden las categorías asignadas a cada persona y los valores por cliente y categoría.
BEGIN;

ALTER TABLE "ClienteTarifaCategoria" DROP CONSTRAINT IF EXISTS "ClienteTarifaCategoria_categoriaId_fkey";
ALTER TABLE "ClienteTarifaCategoria" DROP CONSTRAINT IF EXISTS "ClienteTarifaCategoria_clientId_fkey";
DROP TABLE IF EXISTS "ClienteTarifaCategoria";
ALTER TABLE "Operator" DROP CONSTRAINT IF EXISTS "Operator_manoObraCategoriaId_fkey";
ALTER TABLE "Operator" DROP COLUMN IF EXISTS "manoObraCategoriaId";

COMMIT;
