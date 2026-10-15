import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { crearRemitoEntrega } from '@/lib/ventas/pdvService';

const itemRemitoSchema = z.object({
  ventaItemId: z.string().min(1, 'El ID de ítem de venta es obligatorio'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
});

const crearRemitoSchema = z.object({
  ventaId: z.string().min(1, 'El ID de la venta es obligatorio'),
  vendedorNombre: z.string().optional().nullable(),
  receptorNombre: z.string().optional().nullable(),
  receptorDni: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  items: z.array(itemRemitoSchema).min(1, 'Debe incluir al menos un ítem para entregar'),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ventaId = searchParams.get('ventaId');

    const where: any = {};
    if (ventaId) {
      where.ventaId = ventaId;
    }

    const remitos = await prisma.remitoEntrega.findMany({
      where,
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
      take: 50,
    });

    return NextResponse.json({ success: true, remitos });
  } catch (error: any) {
    console.error('Error al consultar remitos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar remitos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = crearRemitoSchema.parse(body);

    const userIdHeader = req.headers.get('x-user-id');
    const userNameHeader = req.headers.get('x-user-name');

    const remito = await crearRemitoEntrega(
      {
        ...parsed,
        vendedorNombre: parsed.vendedorNombre || userNameHeader || undefined,
      },
      userIdHeader || undefined,
      userNameHeader || undefined
    );

    return NextResponse.json(
      {
        success: true,
        remito,
        message: `Remito ${remito.numero} emitido exitosamente`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error al generar remito de entrega:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar remito de entrega' },
      { status: 400 }
    );
  }
}
