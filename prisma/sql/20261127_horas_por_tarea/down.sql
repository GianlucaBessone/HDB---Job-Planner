-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_proyectoTareaId_fkey";

-- DropIndex
DROP INDEX "TimeEntry_proyectoTareaId_idx";

-- AlterTable
ALTER TABLE "TimeEntry" DROP COLUMN "proyectoTareaId";

