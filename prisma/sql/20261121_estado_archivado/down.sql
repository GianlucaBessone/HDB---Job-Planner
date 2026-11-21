-- Vuelta de 20261121_estado_archivado. Primero volver el código.
-- Los archivados vuelven a "activo" con activo = false (como estaban antes: inactivos). El estado previo exacto
-- (finalizado, por hacer…) de los que se archivaron no se guarda: usar la restauración puntual si hace falta.
BEGIN;
UPDATE "Project" SET "estado" = 'activo', "activo" = false WHERE "estado" = 'archivado';
COMMIT;
