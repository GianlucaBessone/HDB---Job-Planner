-- Quita la tabla MaterialMaestro (auditoría, P8 y E1). Ningún código la usa desde el PR de P8:
-- los precios de materiales salen del catálogo de Productos.
-- DESTRUCTIVA: borra la tabla y sus datos. Aplicar DESPUÉS de desplegar el código de P8.
BEGIN;

DROP TABLE "MaterialMaestro";

COMMIT;
