import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cancelarPendientesVenta } from '@/lib/ventas/pdvService';

const itemCancelarSchema = z.object({
  ventaItemId: z.string().min(1),
  cantidadACancelar: z.coerce.number().positive().optional(),
});

const cancelarSchema = z.object({
  ventaId: z.string().min(1, 'El ID de venta es obligatorio'),
  motivo: z.string().optional(),
  items: z.array(itemCancelarSchema).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    // Consultar ventas confirmadas con entregas pendientes o parciales
    const ventas = await prisma.venta.findMany({
      where: {
        estado: 'CONFIRMADA',
        estadoEntrega: {
          in: ['PENDIENTE', 'PARCIAL'],
        },
        ...(q
          ? {
              OR: [
                { numero: { contains: q, mode: 'insensitive' } },
                { clienteNombre: { contains: q, mode: 'insensitive' } },
                { clienteIdentificacion: { contains: q, mode: 'insensitive' } },
                { vendedorNombre: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        items: true,
        remitos: {
          include: {
            items: true,
            venta: {
              include: {
                items: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        pagos: true,
        cliente: true,
        vendedor: {
          select: {
            id: true,
            nombreCompleto: true,
          },
        },
      },
      orderBy: {
        fecha: 'desc',
      },
      take: 100,
    });

    // Enriquecer cada venta con cálculo de cantidades pendientes
    const ventasConPendientes = ventas
      .map((venta) => {
        const itemsConPendiente = venta.items
          .map((it) => {
            const entregado = it.cantidadEntregada || 0;
            const cancelado = it.cantidadCancelada || 0;
            const pendiente = Math.max(0, it.cantidad - entregado - cancelado);
            return {
              ...it,
              cantidadPendiente: Math.round(pendiente * 1000) / 1000,
            };
          })
          .filter((it) => it.cantidadPendiente > 0);

        return {
          ...venta,
          vendedorNombre: venta.vendedorNombre || (venta as any).vendedor?.nombreCompleto || 'Ventas HDB',
          itemsPendientes: itemsConPendiente,
          totalItemsPendientes: itemsConPendiente.length,
        };
      })
      .filter((v) => v.itemsPendientes.length > 0);

    return NextResponse.json({
      success: true,
      ventas: ventasConPendientes,
      totalCount: ventasConPendientes.length,
    });
  } catch (error: any) {
    console.error('Error al consultar pendientes de entrega:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar pendientes de entrega' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = cancelarSchema.parse(body);

    const updatedVenta = await cancelarPendientesVenta(
      parsed.ventaId,
      parsed.items,
      parsed.motivo
    );

    return NextResponse.json({
      success: true,
      venta: updatedVenta,
      message: 'Pendientes de entrega actualizados/cancelados correctamente',
    });
  } catch (error: any) {
    console.error('Error al cancelar pendientes de entrega:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar pendientes de entrega' },
      { status: 400 }
    );
  }
}
