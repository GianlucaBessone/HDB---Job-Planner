import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, getAuthorizedProjectIds } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const authorizedProjectIds = await getAuthorizedProjectIds(session.responsibleId);

    if (authorizedProjectIds.length === 0) {
      return NextResponse.json([]);
    }

    const projects = await prisma.project.findMany({
      where: {
        id: { in: authorizedProjectIds },
        clientId: session.clientId,
      },
      select: {
        id: true,
        nombre: true,
        codigoProyecto: true,
        estado: true,
        observaciones: true,
        ordenesTrabajo: {
          select: {
            id: true,
            estado: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const formattedProjects = projects.map((p) => {
      const totalOts = p.ordenesTrabajo.length;
      const abiertas = p.ordenesTrabajo.filter((ot) => ot.estado === 'ABIERTA' || ot.estado === 'PAUSADA').length;
      const pendientesFirma = p.ordenesTrabajo.filter((ot) => ot.estado === 'PENDIENTE_FIRMA').length;
      const cerradas = p.ordenesTrabajo.filter((ot) => ot.estado === 'CERRADA').length;

      return {
        id: p.id,
        nombre: p.nombre,
        codigoProyecto: p.codigoProyecto,
        estado: p.estado,
        observaciones: p.observaciones,
        conteo: {
          totalOts,
          abiertas,
          pendientesFirma,
          cerradas,
        },
      };
    });

    return NextResponse.json(formattedProjects);
  } catch (error: any) {
    console.error('Error in GET /api/portal-clientes/proyectos:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener proyectos autorizados' }, { status: 500 });
  }
}
