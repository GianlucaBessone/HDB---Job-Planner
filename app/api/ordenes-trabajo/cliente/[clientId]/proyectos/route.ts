import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const { clientId } = params;

    const [client, projects] = await Promise.all([
      prisma.hdbClient.findUnique({
        where: { id: clientId },
        select: { id: true, nombre: true },
      }),
      prisma.project.findMany({
        where: { clientId },
        include: {
          ordenesTrabajo: {
            select: { id: true, estado: true },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const projectsWithCounts = projects.map((p) => {
      const abiertas = p.ordenesTrabajo.filter((ot) => ot.estado === 'ABIERTA' || ot.estado === 'PAUSADA').length;
      const pendientesFirma = p.ordenesTrabajo.filter((ot) => ot.estado === 'PENDIENTE_FIRMA').length;
      const cerradas = p.ordenesTrabajo.filter((ot) => ot.estado === 'CERRADA').length;
      const totalOts = p.ordenesTrabajo.length;

      return {
        id: p.id,
        nombre: p.nombre,
        codigoProyecto: p.codigoProyecto,
        observaciones: p.observaciones,
        estado: p.estado,
        totalOts,
        abiertas,
        pendientesFirma,
        cerradas,
      };
    });

    return NextResponse.json({
      client,
      projects: projectsWithCounts,
    });
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-trabajo/cliente/[clientId]/proyectos:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener proyectos' }, { status: 500 });
  }
}
