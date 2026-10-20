import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = req.headers.get('x-user-id') || undefined;

    const existing = await prisma.listaPrecio.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lista de precio no encontrada' }, { status: 404 });
    }

    // Set all other lists to false and this one to true
    await prisma.$transaction([
      prisma.listaPrecio.updateMany({
        where: { id: { not: id } },
        data: { esPredeterminada: false },
      }),
      prisma.listaPrecio.update({
        where: { id },
        data: { esPredeterminada: true, activo: true },
      }),
    ]);

    const updated = await prisma.listaPrecio.findUnique({
      where: { id },
      include: {
        listaBase: true,
        familia: true,
        marca: true,
      },
    });

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_LISTA_PRECIO',
      entityId: id,
      metadata: {
        accion: 'SET_PREDETERMINADA',
        codigo: existing.codigo,
        nombre: existing.nombre,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Lista "${existing.nombre}" establecida como predeterminada para PDV y Consumidor Final`,
      lista: updated,
    });
  } catch (error: any) {
    console.error('Error setting default price list:', error);
    return NextResponse.json(
      { error: error.message || 'Error al establecer lista predeterminada' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  return POST(req, context);
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  return POST(req, context);
}
