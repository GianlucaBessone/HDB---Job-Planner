-- ════════════════════════════════════════════════════════════════════
-- Presupuestos de servicio → proyectos — MIGRACIÓN DE IDA (aditiva)
--
-- Solo crea tablas, índices, claves foráneas y un trigger nuevos.
-- No altera, renombra ni borra columnas o tablas existentes.
-- Reversión: down.sql (misma carpeta). Ver README.md antes de aplicar.
--
-- Aplicar (con DATABASE_URL apuntando a la base, conexión directa sin pooler):
--   npx prisma db execute --file prisma/sql/20261118_presupuestos_servicio/up.sql --schema prisma/schema.prisma
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- CreateTable
CREATE TABLE "ManoObraCategoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valorHora" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManoObraCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioCounter" (
    "year" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PresupuestoServicioCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "PresupuestoServicio" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "versionActual" INTEGER NOT NULL DEFAULT 1,
    "fechaVencimiento" TEXT,
    "motivoRechazo" TEXT,
    "proyectoId" TEXT,
    "convertidoEn" TIMESTAMP(3),
    "convertidoPorId" TEXT,
    "creadoPorId" TEXT,
    "creadoPorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresupuestoServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioVersion" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "alcance" TEXT,
    "fechaInicioTentativa" TEXT,
    "fechaFinTentativa" TEXT,
    "operariosSimultaneos" INTEGER NOT NULL DEFAULT 1,
    "validezDias" INTEGER NOT NULL DEFAULT 15,
    "listaPrecioId" TEXT,
    "listaPrecioNombre" TEXT,
    "ivaDiscriminado" BOOLEAN NOT NULL DEFAULT true,
    "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasTotales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalManoObra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalMateriales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impuestos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "condiciones" TEXT,
    "opcionesDocumento" JSONB,
    "notaRevision" TEXT,
    "creadoPorId" TEXT,
    "creadoPorNombre" TEXT,
    "enviadaEn" TIMESTAMP(3),
    "enviadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresupuestoServicioVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioTarea" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT NOT NULL,
    "etiqueta" TEXT,
    "horas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importe" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PresupuestoServicioTarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioManoObra" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "categoriaId" TEXT,
    "categoriaNombre" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'costo',
    "horas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorHora" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,

    CONSTRAINT "PresupuestoServicioManoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioMaterial" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "productoId" TEXT,
    "sku" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioModificado" BOOLEAN NOT NULL DEFAULT false,
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PresupuestoServicioMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoServicioSnapshot" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "esquemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "fechaAceptacion" TEXT NOT NULL,
    "referenciaCliente" TEXT,
    "comentario" TEXT,
    "aceptadoPorId" TEXT,
    "aceptadoPorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresupuestoServicioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyectoTarea" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "presupuestoTareaId" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT NOT NULL,
    "etiqueta" TEXT,
    "horasEstimadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "completadaEn" TIMESTAMP(3),
    "completadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProyectoTarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyectoAsignacion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "fechaDesde" TEXT NOT NULL,
    "fechaHasta" TEXT NOT NULL,
    "horasDia" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyectoAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyectoBorrador" (
    "id" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "presupuestoId" TEXT,
    "titulo" TEXT,
    "paso" INTEGER NOT NULL DEFAULT 1,
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProyectoBorrador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManoObraCategoria_nombre_key" ON "ManoObraCategoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoServicio_numero_key" ON "PresupuestoServicio"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoServicio_proyectoId_key" ON "PresupuestoServicio"("proyectoId");

-- CreateIndex
CREATE INDEX "PresupuestoServicio_clienteId_idx" ON "PresupuestoServicio"("clienteId");

-- CreateIndex
CREATE INDEX "PresupuestoServicio_estado_idx" ON "PresupuestoServicio"("estado");

-- CreateIndex
CREATE INDEX "PresupuestoServicio_createdAt_idx" ON "PresupuestoServicio"("createdAt");

-- CreateIndex
CREATE INDEX "PresupuestoServicioVersion_presupuestoId_idx" ON "PresupuestoServicioVersion"("presupuestoId");

-- CreateIndex
CREATE INDEX "PresupuestoServicioVersion_listaPrecioId_idx" ON "PresupuestoServicioVersion"("listaPrecioId");

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoServicioVersion_presupuestoId_version_key" ON "PresupuestoServicioVersion"("presupuestoId", "version");

-- CreateIndex
CREATE INDEX "PresupuestoServicioTarea_versionId_idx" ON "PresupuestoServicioTarea"("versionId");

-- CreateIndex
CREATE INDEX "PresupuestoServicioManoObra_tareaId_idx" ON "PresupuestoServicioManoObra"("tareaId");

-- CreateIndex
CREATE INDEX "PresupuestoServicioManoObra_categoriaId_idx" ON "PresupuestoServicioManoObra"("categoriaId");

-- CreateIndex
CREATE INDEX "PresupuestoServicioMaterial_versionId_idx" ON "PresupuestoServicioMaterial"("versionId");

-- CreateIndex
CREATE INDEX "PresupuestoServicioMaterial_productoId_idx" ON "PresupuestoServicioMaterial"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoServicioSnapshot_presupuestoId_key" ON "PresupuestoServicioSnapshot"("presupuestoId");

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoServicioSnapshot_versionId_key" ON "PresupuestoServicioSnapshot"("versionId");

-- CreateIndex
CREATE INDEX "ProyectoTarea_projectId_idx" ON "ProyectoTarea"("projectId");

-- CreateIndex
CREATE INDEX "ProyectoAsignacion_operatorId_idx" ON "ProyectoAsignacion"("operatorId");

-- CreateIndex
CREATE INDEX "ProyectoAsignacion_fechaDesde_fechaHasta_idx" ON "ProyectoAsignacion"("fechaDesde", "fechaHasta");

-- CreateIndex
CREATE UNIQUE INDEX "ProyectoAsignacion_projectId_operatorId_key" ON "ProyectoAsignacion"("projectId", "operatorId");

-- CreateIndex
CREATE INDEX "ProyectoBorrador_creadoPorId_idx" ON "ProyectoBorrador"("creadoPorId");

-- AddForeignKey
ALTER TABLE "PresupuestoServicio" ADD CONSTRAINT "PresupuestoServicio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "HdbClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicio" ADD CONSTRAINT "PresupuestoServicio_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioVersion" ADD CONSTRAINT "PresupuestoServicioVersion_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "PresupuestoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioVersion" ADD CONSTRAINT "PresupuestoServicioVersion_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioTarea" ADD CONSTRAINT "PresupuestoServicioTarea_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PresupuestoServicioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioManoObra" ADD CONSTRAINT "PresupuestoServicioManoObra_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "PresupuestoServicioTarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioManoObra" ADD CONSTRAINT "PresupuestoServicioManoObra_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "ManoObraCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioMaterial" ADD CONSTRAINT "PresupuestoServicioMaterial_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PresupuestoServicioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioMaterial" ADD CONSTRAINT "PresupuestoServicioMaterial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioSnapshot" ADD CONSTRAINT "PresupuestoServicioSnapshot_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "PresupuestoServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoServicioSnapshot" ADD CONSTRAINT "PresupuestoServicioSnapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PresupuestoServicioVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyectoTarea" ADD CONSTRAINT "ProyectoTarea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyectoAsignacion" ADD CONSTRAINT "ProyectoAsignacion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyectoAsignacion" ADD CONSTRAINT "ProyectoAsignacion_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Copia congelada inmutable ────────────────────────────────────────
-- Una vez registrada la aceptación, la snapshot no se puede modificar ni borrar.
CREATE FUNCTION "presupuesto_snapshot_inmutable"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'PresupuestoServicioSnapshot es inmutable: no se puede modificar ni borrar (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PresupuestoServicioSnapshot_inmutable"
    BEFORE UPDATE OR DELETE ON "PresupuestoServicioSnapshot"
    FOR EACH ROW EXECUTE FUNCTION "presupuesto_snapshot_inmutable"();

CREATE TRIGGER "PresupuestoServicioSnapshot_inmutable_truncate"
    BEFORE TRUNCATE ON "PresupuestoServicioSnapshot"
    FOR EACH STATEMENT EXECUTE FUNCTION "presupuesto_snapshot_inmutable"();

-- ── Categorías iniciales de mano de obra ────────────────────────────
-- Valor hora en 0: se configura en Ventas y Comercial › Gestión Comercial › Mano de obra.
INSERT INTO "ManoObraCategoria" ("id", "nombre", "valorHora", "ivaPorcentaje", "orden", "activo", "updatedAt") VALUES
    ('mo_oficial_especializado', 'Oficial especializado', 0, 21, 1, true, CURRENT_TIMESTAMP),
    ('mo_oficial',               'Oficial',               0, 21, 2, true, CURRENT_TIMESTAMP),
    ('mo_medio_oficial',         'Medio oficial',         0, 21, 3, true, CURRENT_TIMESTAMP),
    ('mo_ayudante',              'Ayudante',              0, 21, 4, true, CURRENT_TIMESTAMP);

COMMIT;
