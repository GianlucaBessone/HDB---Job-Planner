import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, checkResponsibleProjectAccess } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true, codigoProyecto: true } },
        responsable: { select: { id: true, nombreCompleto: true } },
        otPrevia: { select: { id: true, numeroOT: true, refCliente: true } },
        ciclos: {
          orderBy: { numeroCiclo: 'asc' },
          include: {
            operadores: {
              include: {
                operador: { select: { id: true, nombreCompleto: true } },
              },
            },
            materiales: {
              orderBy: { createdAt: 'asc' },
            },
            responsableCliente: {
              select: { id: true, nombre: true, cargo: true },
            },
          },
        },
        comentarios: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ot) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Strict multi-tenant and project permission verification
    if (ot.clienteId !== session.clientId) {
      return NextResponse.json({ error: 'No autorizado para acceder a esta orden' }, { status: 403 });
    }

    const hasAccess = await checkResponsibleProjectAccess(session.responsibleId, ot.proyectoId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tiene permiso para ver órdenes de este proyecto' }, { status: 403 });
    }

    return NextResponse.json(ot);
  } catch (error: any) {
    console.error('Error in portal GET /api/portal-clientes/ordenes-trabajo/[id]:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener orden de trabajo' }, { status: 500 });
  }
}
