-- ════════════════════════════════════════════════════════════════════
-- Presupuestos de servicio → proyectos — MIGRACIÓN DE VUELTA
--
-- Borra SOLO las tablas que creó up.sql (y sus datos). No toca tablas existentes:
-- los proyectos creados desde un presupuesto siguen existiendo como proyectos comunes.
--
-- ANTES de correrla:
--   1. Volvé el código al deploy anterior (si no, las pantallas nuevas fallan).
--   2. Exportá los datos de estas tablas si los querés conservar (ver README.md).
--
--   npx prisma db execute --file prisma/sql/20261118_presupuestos_servicio/down.sql --schema prisma/schema.prisma
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS "PresupuestoServicioSnapshot_inmutable_truncate" ON "PresupuestoServicioSnapshot";
DROP TRIGGER IF EXISTS "PresupuestoServicioSnapshot_inmutable" ON "PresupuestoServicioSnapshot";
DROP FUNCTION IF EXISTS "presupuesto_snapshot_inmutable"();

-- DropForeignKey
ALTER TABLE "PresupuestoServicio" DROP CONSTRAINT "PresupuestoServicio_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicio" DROP CONSTRAINT "PresupuestoServicio_proyectoId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioVersion" DROP CONSTRAINT "PresupuestoServicioVersion_presupuestoId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioVersion" DROP CONSTRAINT "PresupuestoServicioVersion_listaPrecioId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioTarea" DROP CONSTRAINT "PresupuestoServicioTarea_versionId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioManoObra" DROP CONSTRAINT "PresupuestoServicioManoObra_tareaId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioManoObra" DROP CONSTRAINT "PresupuestoServicioManoObra_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioMaterial" DROP CONSTRAINT "PresupuestoServicioMaterial_versionId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioMaterial" DROP CONSTRAINT "PresupuestoServicioMaterial_productoId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioSnapshot" DROP CONSTRAINT "PresupuestoServicioSnapshot_presupuestoId_fkey";

-- DropForeignKey
ALTER TABLE "PresupuestoServicioSnapshot" DROP CONSTRAINT "PresupuestoServicioSnapshot_versionId_fkey";

-- DropForeignKey
ALTER TABLE "ProyectoTarea" DROP CONSTRAINT "ProyectoTarea_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProyectoAsignacion" DROP CONSTRAINT "ProyectoAsignacion_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProyectoAsignacion" DROP CONSTRAINT "ProyectoAsignacion_operatorId_fkey";

-- DropTable
DROP TABLE "ManoObraCategoria";

-- DropTable
DROP TABLE "PresupuestoServicioCounter";

-- DropTable
DROP TABLE "PresupuestoServicio";

-- DropTable
DROP TABLE "PresupuestoServicioVersion";

-- DropTable
DROP TABLE "PresupuestoServicioTarea";

-- DropTable
DROP TABLE "PresupuestoServicioManoObra";

-- DropTable
DROP TABLE "PresupuestoServicioMaterial";

-- DropTable
DROP TABLE "PresupuestoServicioSnapshot";

-- DropTable
DROP TABLE "ProyectoTarea";

-- DropTable
DROP TABLE "ProyectoAsignacion";

-- DropTable
DROP TABLE "ProyectoBorrador";


COMMIT;
