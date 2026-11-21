-- Vuelta de 20261121_quitar_material_maestro: recrea la tabla VACÍA.
-- Los datos solo se recuperan con la restauración puntual de Neon (ver README).
BEGIN;

CREATE TABLE "MaterialMaestro" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioVenta" DOUBLE PRECISION,
    "costo" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialMaestro_pkey" PRIMARY KEY ("codigo")
);

COMMIT;
