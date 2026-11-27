-- AlterTable
ALTER TABLE "PresupuestoServicio" ADD COLUMN     "pliegoId" TEXT;

-- CreateIndex
CREATE INDEX "PresupuestoServicio_pliegoId_idx" ON "PresupuestoServicio"("pliegoId");

-- AddForeignKey
ALTER TABLE "PresupuestoServicio" ADD CONSTRAINT "PresupuestoServicio_pliegoId_fkey" FOREIGN KEY ("pliegoId") REFERENCES "Pliego"("id") ON DELETE SET NULL ON UPDATE CASCADE;

