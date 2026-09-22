import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Return SGI clients that are active and NOT currently enabled for OT
    const clients = await prisma.hdbClient.findMany({
      where: {
        activo: true,
        AND: [
          {
            OR: [
              { configuracion: null },
              { configuracion: { habilitadoOT: false } },
            ],
          },
          {
            ordenesTrabajo: { none: {} },
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json(clients);
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-trabajo/clientes/disponibles:', error);
    return NextResponse.json({ error: 'Error al obtener clientes disponibles' }, { status: 500 });
  }
}
