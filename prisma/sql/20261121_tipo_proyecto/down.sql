-- Vuelta de 20261121_tipo_proyecto. Primero volver el código.
-- Los proyectos que estaban "atrasado" o "en_riesgo" quedan "activo": el código viejo vuelve a marcar
-- "atrasado" los vencidos la próxima vez que se lean.
BEGIN;
ALTER TABLE "Project" DROP COLUMN "tipo";
COMMIT;
