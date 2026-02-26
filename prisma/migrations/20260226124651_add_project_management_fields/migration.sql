-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "cliente" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'activo',
ADD COLUMN     "fechaFin" TEXT,
ADD COLUMN     "fechaInicio" TEXT,
ADD COLUMN     "responsable" TEXT;
