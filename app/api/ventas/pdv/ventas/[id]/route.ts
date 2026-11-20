import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['ventas.pdv_operar'], 'No tenés permiso para operar el Punto de Venta');
    if (acceso instanceof NextResponse) return acceso;

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
