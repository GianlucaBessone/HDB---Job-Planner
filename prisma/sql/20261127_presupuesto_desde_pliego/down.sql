-- DropForeignKey
ALTER TABLE "PresupuestoServicio" DROP CONSTRAINT "PresupuestoServicio_pliegoId_fkey";

-- DropIndex
DROP INDEX "PresupuestoServicio_pliegoId_idx";

-- AlterTable
ALTER TABLE "PresupuestoServicio" DROP COLUMN "pliegoId";

