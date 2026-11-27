-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_solicitanteId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_resueltoPorId_fkey";

-- DropTable
DROP TABLE "Solicitud";

