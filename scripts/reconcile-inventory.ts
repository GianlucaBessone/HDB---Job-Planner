import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Verificando y finalizando hardening de inventario...');

  // 1. Contar movimientos sin número
  const pendientes = await prisma.productoStockMovimiento.count({
    where: { numero: null },
  });
  console.log(`📦 Movimientos pendientes de numerar: ${pendientes}`);

  if (pendientes > 0) {
    await prisma.$executeRawUnsafe(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
        FROM "ProductoStockMovimiento"
        WHERE "numero" IS NULL
      )
      UPDATE "ProductoStockMovimiento" m
      SET
        "numero" = 'MOV-2026-' || LPAD(n.rn::text, 6, '0'),
        "tipo" = 'STOCK_INICIAL',
        "variacion" = m."cantidad",
        "referenciaTipo" = 'IMPORTACION',
        "referencia" = 'Apertura de inventario inicial',
        "estado" = 'CONFIRMADO',
        "metadata" = jsonb_build_object('tipoLegacy', m."tipo", 'motivoOriginal', m."motivo", 'reconciliadoEn', NOW()::text)
      FROM numbered n
      WHERE m.id = n.id;
    `);
    console.log(`✅ Movimientos numerados con éxito.`);
  }

  // 2. Sincronizar contadores
  const totalMovs = await prisma.productoStockMovimiento.count();
  await prisma.inventarioCounter.upsert({
    where: { serie_year: { serie: 'MOV', year: 2026 } },
    update: { currentNumber: totalMovs },
    create: { serie: 'MOV', year: 2026, currentNumber: totalMovs },
  });

  await prisma.inventarioCounter.upsert({
    where: { serie_year: { serie: 'OPI', year: 2026 } },
    update: {},
    create: { serie: 'OPI', year: 2026, currentNumber: 0 },
  });

  await prisma.inventarioCounter.upsert({
    where: { serie_year: { serie: 'CNT', year: 2026 } },
    update: {},
    create: { serie: 'CNT', year: 2026, currentNumber: 0 },
  });
  console.log(`✅ Contadores actualizados: MOV=${totalMovs}`);

  // 3. Sincronizar ultimoMovimientoAt
  await prisma.$executeRawUnsafe(`
    UPDATE "ProductoStock" s
    SET "ultimoMovimientoAt" = sub.max_date
    FROM (
      SELECT "productoId", "almacenId", MAX("createdAt") AS max_date
      FROM "ProductoStockMovimiento"
      GROUP BY "productoId", "almacenId"
    ) sub
    WHERE s."productoId" = sub."productoId" AND s."almacenId" = sub."almacenId";
  `);
  console.log('✅ ultimoMovimientoAt sincronizado.');

  // 4. Instalar Trigger de Inmutabilidad
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fn_prevent_confirmed_stock_movement_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD."estado" = 'CONFIRMADO' THEN
          RAISE EXCEPTION 'VIOLACION DE INTEGRIDAD: No está permitido eliminar movimientos de inventario confirmados (ID: %, Número: %). Debe registrar una reversa o movimiento correctivo.', OLD.id, OLD.numero;
        END IF;
        RETURN OLD;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD."estado" = 'CONFIRMADO' AND (
          OLD."cantidad" <> NEW."cantidad" OR
          OLD."variacion" <> NEW."variacion" OR
          OLD."stockAnterior" <> NEW."stockAnterior" OR
          OLD."stockPosterior" <> NEW."stockPosterior" OR
          OLD."productoId" <> NEW."productoId" OR
          OLD."almacenId" <> NEW."almacenId" OR
          OLD."tipo" <> NEW."tipo"
        ) THEN
          RAISE EXCEPTION 'VIOLACION DE INTEGRIDAD: No está permitido alterar cantidades, saldos, tipo, producto o almacén de un movimiento de stock confirmado (ID: %, Número: %).', OLD.id, OLD.numero;
        END IF;
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_immutable_stock_movimientos ON "ProductoStockMovimiento";
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_immutable_stock_movimientos
    BEFORE UPDATE OR DELETE ON "ProductoStockMovimiento"
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_confirmed_stock_movement_mutation();
  `);

  console.log('🛡️ Trigger de inmutabilidad PostgreSQL trg_immutable_stock_movimientos activo.');
  console.log('🎉 Etapa A completada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
