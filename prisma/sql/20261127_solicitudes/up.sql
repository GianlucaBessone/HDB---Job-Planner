-- CreateTable
CREATE TABLE "Solicitud" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "datos" JSONB,
    "funcionAprobar" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "resueltoPorId" TEXT,
    "resueltoAt" TIMESTAMP(3),
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Solicitud_estado_funcionAprobar_idx" ON "Solicitud"("estado", "funcionAprobar");

-- CreateIndex
CREATE INDEX "Solicitud_solicitanteId_idx" ON "Solicitud"("solicitanteId");

-- CreateIndex
CREATE INDEX "Solicitud_entidadTipo_entidadId_idx" ON "Solicitud"("entidadTipo", "entidadId");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

