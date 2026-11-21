-- Proveedores únicos (auditoría, P24 / FU5): los proveedores de Gastos (tabla "Proveedor") pasan al maestro
-- de proveedores ("ProveedorVentas"), las facturas de gastos apuntan ahí y se borra "Proveedor".
-- Mueve datos: correr en una sola transacción. Ver README.
BEGIN;

ALTER TABLE "FacturaConsumo" DROP CONSTRAINT "FacturaConsumo_proveedorId_fkey";

-- 1. CUIT de los proveedores existentes con el formato del sistema (30-12345678-9)
UPDATE "ProveedorVentas"
SET cuit = substr(d, 1, 2) || '-' || substr(d, 3, 8) || '-' || substr(d, 11, 1)
FROM (SELECT id AS pid, regexp_replace(cuit, '\D', '', 'g') AS d FROM "ProveedorVentas" WHERE cuit IS NOT NULL) x
WHERE "ProveedorVentas".id = x.pid AND length(x.d) = 11;
UPDATE "ProveedorVentas" SET cuit = NULL WHERE cuit IS NOT NULL AND btrim(cuit) = '';

-- 2. Proveedores de Gastos: dígitos del CUIT y validez del dígito verificador
CREATE TEMP TABLE prov_g ON COMMIT DROP AS
SELECT
    p.*,
    regexp_replace(p.cuit, '\D', '', 'g') AS d,
    lower(btrim(p."razonSocial")) AS razon
FROM "Proveedor" p;

ALTER TABLE prov_g ADD COLUMN valido boolean;
UPDATE prov_g SET valido = length(d) = 11 AND (
    CASE 11 - ((
        5 * substr(d, 1, 1)::int + 4 * substr(d, 2, 1)::int + 3 * substr(d, 3, 1)::int + 2 * substr(d, 4, 1)::int +
        7 * substr(d, 5, 1)::int + 6 * substr(d, 6, 1)::int + 5 * substr(d, 7, 1)::int + 4 * substr(d, 8, 1)::int +
        3 * substr(d, 9, 1)::int + 2 * substr(d, 10, 1)::int) % 11)
        WHEN 11 THEN 0 WHEN 10 THEN 9
        ELSE 11 - ((
            5 * substr(d, 1, 1)::int + 4 * substr(d, 2, 1)::int + 3 * substr(d, 3, 1)::int + 2 * substr(d, 4, 1)::int +
            7 * substr(d, 5, 1)::int + 6 * substr(d, 6, 1)::int + 5 * substr(d, 7, 1)::int + 4 * substr(d, 8, 1)::int +
            3 * substr(d, 9, 1)::int + 2 * substr(d, 10, 1)::int) % 11)
    END = substr(d, 11, 1)::int
);

-- 3. CUIT canónico: el propio; uno inválido (error de escaneo) toma el CUIT válido de un proveedor
--    con la misma razón social, si lo hay
ALTER TABLE prov_g ADD COLUMN canon text;
UPDATE prov_g g SET canon = CASE
    WHEN g.valido THEN g.d
    ELSE coalesce((SELECT min(v.d) FROM prov_g v WHERE v.valido AND v.razon = g.razon), g.d)
END;

-- 4. Destino de cada CUIT canónico: el proveedor existente con ese CUIT o el más antiguo del grupo
CREATE TEMP TABLE prov_destino ON COMMIT DROP AS
SELECT DISTINCT ON (g.canon)
    g.canon,
    coalesce(
        (SELECT pv.id FROM "ProveedorVentas" pv WHERE regexp_replace(coalesce(pv.cuit, ''), '\D', '', 'g') = g.canon LIMIT 1),
        g.id
    ) AS destino_id,
    g.id AS fila_id
FROM prov_g g
ORDER BY g.canon, g."createdAt", g.id;

INSERT INTO "ProveedorVentas" (id, "razonSocial", "nombreFantasia", cuit, "condicionIva", direccion, activo, "createdAt", "updatedAt")
SELECT
    g.id,
    btrim(g."razonSocial"),
    g."nombreFantasia",
    CASE WHEN length(dest.canon) = 11 THEN substr(dest.canon, 1, 2) || '-' || substr(dest.canon, 3, 8) || '-' || substr(dest.canon, 11, 1) ELSE g.cuit END,
    g."condicionIva",
    g.domicilio,
    (SELECT bool_or(x.activo) FROM prov_g x WHERE x.canon = dest.canon),
    g."createdAt",
    now()
FROM prov_destino dest
JOIN prov_g g ON g.id = dest.fila_id
WHERE dest.destino_id = g.id;

-- 5. Las facturas apuntan al proveedor que quedó
UPDATE "FacturaConsumo" f
SET "proveedorId" = dest.destino_id
FROM prov_g g
JOIN prov_destino dest ON dest.canon = g.canon
WHERE f."proveedorId" = g.id;

-- 6. Se borra el maestro viejo; CUIT único y clave foránea al maestro único
DROP TABLE "Proveedor";
DROP INDEX "ProveedorVentas_cuit_idx";
CREATE UNIQUE INDEX "ProveedorVentas_cuit_key" ON "ProveedorVentas"("cuit");
ALTER TABLE "FacturaConsumo" ADD CONSTRAINT "FacturaConsumo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "ProveedorVentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
