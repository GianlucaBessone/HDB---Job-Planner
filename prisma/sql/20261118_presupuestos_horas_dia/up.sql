-- Presupuestos de servicio: horas de trabajo por día para estimar el plazo.
-- Aditiva: agrega una columna con valor por defecto 8 (lo que el sistema asumía hasta ahora).
-- En PostgreSQL 11+ agregar una columna con default constante no reescribe la tabla.
BEGIN;

ALTER TABLE "PresupuestoServicioVersion" ADD COLUMN "horasDia" DOUBLE PRECISION NOT NULL DEFAULT 8;

COMMIT;
