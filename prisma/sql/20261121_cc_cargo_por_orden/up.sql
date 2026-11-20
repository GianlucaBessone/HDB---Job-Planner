-- Cuenta corriente: cargo por orden firmada (auditoría, P15).
-- Aditiva: dos columnas opcionales y un índice. No toca datos existentes.
BEGIN;

ALTER TABLE "CuentaCorrienteMovimiento" ADD COLUMN "origenTipo" TEXT;
ALTER TABLE "CuentaCorrienteMovimiento" ADD COLUMN "origenId" TEXT;
CREATE INDEX "CuentaCorrienteMovimiento_origenTipo_origenId_idx" ON "CuentaCorrienteMovimiento"("origenTipo", "origenId");

COMMIT;
