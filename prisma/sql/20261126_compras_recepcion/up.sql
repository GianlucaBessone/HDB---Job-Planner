-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEsperada" TIMESTAMP(3),
    "fechaEnvio" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "observaciones" TEXT,
    "facturaId" TEXT,
    "creadoPorId" TEXT,
    "creadoPorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadRecibida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remito" TEXT,
    "observaciones" TEXT,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "anuladaAt" TIMESTAMP(3),
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecepcionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionCompraItem" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecepcionCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_idx" ON "OrdenCompra"("estado");

-- CreateIndex
CREATE INDEX "OrdenCompra_facturaId_idx" ON "OrdenCompra"("facturaId");

-- CreateIndex
CREATE INDEX "OrdenCompra_fechaEmision_idx" ON "OrdenCompra"("fechaEmision");

-- CreateIndex
CREATE INDEX "OrdenCompraItem_productoId_idx" ON "OrdenCompraItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompraItem_ordenId_productoId_key" ON "OrdenCompraItem"("ordenId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "RecepcionCompra_numero_key" ON "RecepcionCompra"("numero");

-- CreateIndex
CREATE INDEX "RecepcionCompra_ordenId_idx" ON "RecepcionCompra"("ordenId");

-- CreateIndex
CREATE INDEX "RecepcionCompraItem_itemId_idx" ON "RecepcionCompraItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecepcionCompraItem_recepcionId_itemId_key" ON "RecepcionCompraItem"("recepcionId", "itemId");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "ProveedorVentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaConsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionCompra" ADD CONSTRAINT "RecepcionCompra_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionCompraItem" ADD CONSTRAINT "RecepcionCompraItem_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "RecepcionCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionCompraItem" ADD CONSTRAINT "RecepcionCompraItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "OrdenCompraItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

