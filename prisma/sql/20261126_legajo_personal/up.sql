-- CreateTable
CREATE TABLE "LegajoPersonal" (
    "operatorId" TEXT NOT NULL,
    "legajo" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "fechaEgreso" TIMESTAMP(3),
    "cuil" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "telefono" TEXT,
    "email" TEXT,
    "domicilio" TEXT,
    "localidad" TEXT,
    "obraSocial" TEXT,
    "grupoSanguineo" TEXT,
    "contactoEmergenciaNombre" TEXT,
    "contactoEmergenciaTelefono" TEXT,
    "contactoEmergenciaRelacion" TEXT,
    "observaciones" TEXT,
    "actualizadoPorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegajoPersonal_pkey" PRIMARY KEY ("operatorId")
);

-- CreateTable
CREATE TABLE "DocumentoPersonal" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "archivoKey" TEXT,
    "archivoNombre" TEXT,
    "archivoTipo" TEXT,
    "observaciones" TEXT,
    "creadoPorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegajoPersonal_legajo_key" ON "LegajoPersonal"("legajo");

-- CreateIndex
CREATE INDEX "DocumentoPersonal_operatorId_idx" ON "DocumentoPersonal"("operatorId");

-- CreateIndex
CREATE INDEX "DocumentoPersonal_fechaVencimiento_idx" ON "DocumentoPersonal"("fechaVencimiento");

-- AddForeignKey
ALTER TABLE "LegajoPersonal" ADD CONSTRAINT "LegajoPersonal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoPersonal" ADD CONSTRAINT "DocumentoPersonal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

