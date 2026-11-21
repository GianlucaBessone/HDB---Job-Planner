-- Un solo estado del proyecto (auditoría, E9): "archivado" reemplaza a "activo = false". Solo datos, sin
-- cambios de esquema. Ver README.
BEGIN;
UPDATE "Project" SET "estado" = 'archivado' WHERE "activo" = false AND "estado" <> 'archivado';
COMMIT;
