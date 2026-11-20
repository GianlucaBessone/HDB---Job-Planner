-- Clientes: datos fiscales (razón social, CUIT y condición frente al IVA).
-- Aditiva: tres columnas opcionales y un índice. No toca datos existentes.
BEGIN;

ALTER TABLE "HdbClient" ADD COLUMN "razonSocial" TEXT;
ALTER TABLE "HdbClient" ADD COLUMN "cuit" TEXT;
ALTER TABLE "HdbClient" ADD COLUMN "condicionIva" TEXT;
CREATE INDEX "HdbClient_cuit_idx" ON "HdbClient"("cuit");

COMMIT;
