-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_proveedorId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_almacenId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_facturaId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompraItem" DROP CONSTRAINT "OrdenCompraItem_ordenId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompraItem" DROP CONSTRAINT "OrdenCompraItem_productoId_fkey";

-- DropForeignKey
ALTER TABLE "RecepcionCompra" DROP CONSTRAINT "RecepcionCompra_ordenId_fkey";

-- DropForeignKey
ALTER TABLE "RecepcionCompraItem" DROP CONSTRAINT "RecepcionCompraItem_recepcionId_fkey";

-- DropForeignKey
ALTER TABLE "RecepcionCompraItem" DROP CONSTRAINT "RecepcionCompraItem_itemId_fkey";

-- DropTable
DROP TABLE "OrdenCompra";

-- DropTable
DROP TABLE "OrdenCompraItem";

-- DropTable
DROP TABLE "RecepcionCompra";

-- DropTable
DROP TABLE "RecepcionCompraItem";

