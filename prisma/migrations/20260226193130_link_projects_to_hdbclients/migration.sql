-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "HdbClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
