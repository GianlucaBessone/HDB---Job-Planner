-- Tarifas de mano de obra con una sola regla (auditoría, P20 / FU8).
-- Aditiva: una columna opcional en Operator y una tabla nueva. No modifica datos existentes.
BEGIN;

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "manoObraCategoriaId" TEXT;

-- CreateTable
CREATE TABLE "ClienteTarifaCategoria" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "valorHora" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteTarifaCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClienteTarifaCategoria_categoriaId_idx" ON "ClienteTarifaCategoria"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteTarifaCategoria_clientId_categoriaId_key" ON "ClienteTarifaCategoria"("clientId", "categoriaId");

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_manoObraCategoriaId_fkey" FOREIGN KEY ("manoObraCategoriaId") REFERENCES "ManoObraCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteTarifaCategoria" ADD CONSTRAINT "ClienteTarifaCategoria_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "HdbClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteTarifaCategoria" ADD CONSTRAINT "ClienteTarifaCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "ManoObraCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
