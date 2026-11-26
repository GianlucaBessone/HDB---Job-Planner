-- DropForeignKey
ALTER TABLE "LegajoPersonal" DROP CONSTRAINT "LegajoPersonal_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoPersonal" DROP CONSTRAINT "DocumentoPersonal_operatorId_fkey";

-- DropTable
DROP TABLE "LegajoPersonal";

-- DropTable
DROP TABLE "DocumentoPersonal";

