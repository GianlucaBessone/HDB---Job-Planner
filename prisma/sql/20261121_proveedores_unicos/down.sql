-- Vuelta de 20261121_proveedores_unicos. Primero volver el código.
-- Recrea "Proveedor" con los proveedores que tienen facturas de gastos (con el CUIT ya normalizado) y
-- vuelve a apuntar las facturas ahí. Los duplicados fusionados por la ida no se separan: para recuperar
-- el estado exacto, usar la restauración puntual de Neon (ver README).
BEGIN;

ALTER TABLE "FacturaConsumo" DROP CONSTRAINT "FacturaConsumo_proveedorId_fkey";

CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "cuit" TEXT NOT NULL,
    "condicionIva" TEXT,
    "domicilio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Proveedor_cuit_key" ON "Proveedor"("cuit");

INSERT INTO "Proveedor" (id, "razonSocial", "nombreFantasia", cuit, "condicionIva", domicilio, activo, "createdAt", "updatedAt")
SELECT pv.id, pv."razonSocial", pv."nombreFantasia", coalesce(pv.cuit, pv.id), pv."condicionIva", pv.direccion, pv.activo, pv."createdAt", pv."updatedAt"
FROM "ProveedorVentas" pv
WHERE EXISTS (SELECT 1 FROM "FacturaConsumo" f WHERE f."proveedorId" = pv.id);

-- Los proveedores que solo tenían facturas de gastos se quitan del maestro único (los que tienen productos quedan)
DELETE FROM "ProveedorVentas" pv
WHERE EXISTS (SELECT 1 FROM "Proveedor" p WHERE p.id = pv.id)
  AND NOT EXISTS (SELECT 1 FROM "ProductoProveedorVentas" pp WHERE pp."proveedorId" = pv.id);

ALTER TABLE "FacturaConsumo" ADD CONSTRAINT "FacturaConsumo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "ProveedorVentas_cuit_key";
CREATE INDEX "ProveedorVentas_cuit_idx" ON "ProveedorVentas"("cuit");

COMMIT;
