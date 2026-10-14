import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { id: 'asc' },
        },
        pagos: {
          orderBy: { createdAt: 'asc' },
        },
        cliente: true,
        listaPrecio: true,
        vendedor: {
          select: { id: true, nombreCompleto: true, role: true },
        },
        anuladoPor: {
          select: { id: true, nombreCompleto: true, role: true },
        },
      },
    });

    if (!venta) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    return NextResponse.json(venta);
  } catch (error: any) {
    console.error('Error fetching venta detalle:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalle de la venta', details: error.message },
      { status: 500 }
    );
  }
}
