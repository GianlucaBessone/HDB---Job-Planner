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
      return NextResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } });
    }

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId') || undefined;
    const estado = searchParams.get('estado') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const skip = (page - 1) * limit;

    // Security check: if specific project is requested, it MUST be authorized
    if (proyectoId && !authorizedProjectIds.includes(proyectoId)) {
      return NextResponse.json({ error: 'No tiene autorización para ver este proyecto' }, { status: 403 });
    }

    const where: any = {
      clienteId: session.clientId,
      proyectoId: proyectoId ? proyectoId : { in: authorizedProjectIds },
    };

    if (estado && estado !== 'TODAS') {
      if (estado === 'ABIERTAS_Y_PAUSADAS') {
        where.estado = { in: ['ABIERTA', 'PAUSADA'] };
      } else {
        where.estado = estado;
      }
    }

    if (sector) where.sector = sector;

    if (search) {
      where.OR = [
        { numeroOT: { contains: search, mode: 'insensitive' } },
        { refCliente: { contains: search, mode: 'insensitive' } },
        { reporteTrabajo: { contains: search, mode: 'insensitive' } },
        { sector: { contains: search, mode: 'insensitive' } },
        { proyecto: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, ots] = await Promise.all([
      prisma.ordenTrabajo.count({ where }),
      prisma.ordenTrabajo.findMany({
        where,
        include: {
          proyecto: { select: { id: true, nombre: true, codigoProyecto: true } },
          responsable: { select: { id: true, nombreCompleto: true } },
          ciclos: {
            orderBy: { numeroCiclo: 'desc' },
            select: {
              id: true,
              numeroCiclo: true,
              periodo: true,
              estado: true,
              totalHoras: true,
              totalManoObra: true,
              totalMateriales: true,
              totalGeneral: true,
              hashIntegridad: true,
              fechaFirma: true,
              tipoCierre: true,
            },
          },
          _count: {
            select: { comentarios: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: ots,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in portal GET /api/portal-clientes/ordenes-trabajo:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener órdenes de trabajo' }, { status: 500 });
  }
}
