import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const stockAjusteSchema = z.object({
  productoId: z.string(),
  almacenId: z.string().optional(),
  nuevoStock: z.coerce.number().min(0, 'El stock no puede ser negativo'),
  tipo: z.enum(['AJUSTE', 'CONTEO', 'CORRECCION']).default('AJUSTE'),
  motivo: z.string().min(1, 'Debe indicar un motivo o justificación para el ajuste de stock'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = stockAjusteSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;

    // Fetch product
    const producto = await prisma.producto.findUnique({
      where: { id: data.productoId },
      include: {
        stocks: {
          include: { almacen: true },
        },
      },
    });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Resolve target warehouse
    let targetAlmacenId = data.almacenId;
    if (!targetAlmacenId) {
      const defaultAlm = await prisma.almacen.findFirst({
        where: { esPredeterminado: true, activo: true },
      });
      targetAlmacenId = defaultAlm?.id || producto.stocks[0]?.almacenId;
    }

    if (!targetAlmacenId) {
      return NextResponse.json({ error: 'No se encontró un almacén válido para este producto' }, { status: 400 });
    }

    // Find or create current stock record
    const existingStock = producto.stocks.find((s) => s.almacenId === targetAlmacenId);
    const stockAnterior = existingStock?.stockActual ?? 0;
    const delta = data.nuevoStock - stockAnterior;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert stock record
      const updatedStock = await tx.productoStock.upsert({
        where: {
          productoId_almacenId: {
            productoId: data.productoId,
            almacenId: targetAlmacenId!,
          },
        },
        update: { stockActual: data.nuevoStock },
        create: {
          productoId: data.productoId,
          almacenId: targetAlmacenId!,
          stockActual: data.nuevoStock,
          stockMinimo: 0,
          stockMaximo: 0,
        },
      });

      // 2. Create auditable inventory movement
      await tx.productoStockMovimiento.create({
        data: {
          productoId: data.productoId,
          almacenId: targetAlmacenId!,
          tipo: data.tipo,
          cantidad: Math.abs(delta),
          stockAnterior,
          stockPosterior: data.nuevoStock,
          motivo: data.motivo,
          usuarioId: userId,
        },
      });

      // 3. Register in product history
      await tx.productoHistorial.create({
        data: {
          productoId: data.productoId,
          tipo: 'AJUSTE_STOCK',
          campo: 'stockActual',
          valorAnterior: String(stockAnterior),
          valorNuevo: String(data.nuevoStock),
          origen: 'AJUSTE_STOCK',
          detalles: {
            tipoMovimiento: data.tipo,
            motivo: data.motivo,
            delta,
          },
          usuarioId: userId,
        },
      });

      return updatedStock;
    });

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_STOCK_AJUSTE',
      entityId: data.productoId,
      oldValue: { stock: stockAnterior },
      newValue: { stock: data.nuevoStock, motivo: data.motivo },
    });

    return NextResponse.json({
      success: true,
      stockActual: result.stockActual,
      stockAnterior,
      mensaje: `Stock actualizado de ${stockAnterior} a ${data.nuevoStock} correctamente.`,
    });
  } catch (error: any) {
    console.error('Error ajustando stock:', error);
    return NextResponse.json(
      { error: error.message || 'Error al ajustar stock' },
      { status: 500 }
    );
  }
}
