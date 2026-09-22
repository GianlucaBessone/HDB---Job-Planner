import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const client = await prisma.hdbClient.findUnique({
      where: { id },
      include: {
        configuracion: true,
        operatorRates: {
          include: {
            operator: { select: { id: true, nombreCompleto: true, role: true } },
          },
          orderBy: { operator: { nombreCompleto: 'asc' } },
        },
        sectores: {
          orderBy: { nombre: 'asc' },
        },
        responsables: {
          include: {
            proyectos: {
              include: {
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
              },
            },
          },
          orderBy: { nombre: 'asc' },
        },
        projects: {
          select: { id: true, nombre: true, codigoProyecto: true, estado: true },
          orderBy: { nombre: 'asc' },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Ensure configuracion exists
    let configuracion = client.configuracion;
    if (!configuracion) {
      configuracion = await prisma.hdbClientConfig.create({
        data: {
          clientId: id,
          porcentajeMateriales: 0,
        },
      });
    }

    return NextResponse.json({
      client,
      configuracion,
      operatorRates: client.operatorRates,
      sectores: client.sectores,
      responsables: client.responsables,
      projects: client.projects,
    });
  } catch (error: any) {
    console.error('Error in GET /api/clients/[id]/config:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { porcentajeMateriales } = body;

    let numPct = 0;
    if (porcentajeMateriales !== '' && porcentajeMateriales !== null && porcentajeMateriales !== undefined) {
      numPct = parseFloat(porcentajeMateriales);
      if (isNaN(numPct)) {
        return NextResponse.json({ error: 'Porcentaje inválido' }, { status: 400 });
      }
    }

    const config = await prisma.hdbClientConfig.upsert({
      where: { clientId: id },
      create: {
        clientId: id,
        porcentajeMateriales: numPct,
      },
      update: {
        porcentajeMateriales: numPct,
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_CONFIG',
      entityId: id,
      newValue: { porcentajeMateriales: numPct },
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error in PUT /api/clients/[id]/config:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar configuración' }, { status: 500 });
  }
}
