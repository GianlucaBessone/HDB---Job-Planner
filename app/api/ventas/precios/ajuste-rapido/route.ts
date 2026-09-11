import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const ajusteRapidoSchema = z.object({
  cambios: z.array(
    z.object({
      productoId: z.string(),
      precio: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0').optional(),
      precioBase: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0').optional(),
    })
  ).min(1, 'Debe incluir al menos un cambio'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cambios } = ajusteRapidoSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;

    // Fetch existing products for difference tracking
    const productIds = Array.from(new Set(cambios.map((c) => c.productoId)));
    const existingProducts = await prisma.producto.findMany({
      where: { id: { in: productIds } },
      select: { id: true, precioBase: true, sku: true },
    });
    const prodMap = new Map(existingProducts.map((p) => [p.id, p]));

    const results = await prisma.$transaction(async (tx) => {
      let updatedCount = 0;

      for (const item of cambios) {
        const prod = prodMap.get(item.productoId);
        if (!prod) continue;

        const targetPrice = item.precioBase !== undefined ? item.precioBase : (item.precio ?? 0);
        const oldPrice = prod.precioBase ?? 0;

        // Only record and update if price changed
        if (oldPrice !== targetPrice) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { precioBase: targetPrice },
          });

          await tx.productoHistorial.create({
            data: {
              productoId: item.productoId,
              tipo: 'CAMBIO_PRECIO',
              campo: 'precioBase',
              valorAnterior: String(oldPrice),
              valorNuevo: String(targetPrice),
              origen: 'AJUSTE_RAPIDO',
              usuarioId: userId,
            },
          });

          updatedCount++;
        }
      }

      return updatedCount;
    });

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_PRECIOS_AJUSTE_RAPIDO',
      metadata: { totalModificados: results },
    });

    return NextResponse.json({
      success: true,
      modificados: results,
      message: `Se actualizaron ${results} precios base correctamente.`,
    });
  } catch (error: any) {
    console.error('Error en ajuste rápido de precios:', error);
    return NextResponse.json(
      { error: error.message || 'Error al aplicar ajuste rápido' },
      { status: 500 }
    );
  }
}
