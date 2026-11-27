-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "proyectoTareaId" TEXT;

-- CreateIndex
CREATE INDEX "TimeEntry_proyectoTareaId_idx" ON "TimeEntry"("proyectoTareaId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_proyectoTareaId_fkey" FOREIGN KEY ("proyectoTareaId") REFERENCES "ProyectoTarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

