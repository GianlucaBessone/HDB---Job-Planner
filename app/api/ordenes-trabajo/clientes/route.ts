import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clients = await prisma.hdbClient.findMany({
      where: {
        activo: true,
        OR: [
          { configuracion: { habilitadoOT: true } },
          { ordenesTrabajo: { some: {} } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        direccion: true,
        configuracion: {
          select: {
            habilitadoOT: true,
            porcentajeMateriales: true,
          },
        },
        _count: {
          select: { projects: true },
        },
        ordenesTrabajo: {
          select: {
            id: true,
            estado: true,
          },
        },
        responsables: {
          select: { id: true, portalHabilitado: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const result = clients.map((c) => {
      const totalProyectos = c._count.projects;
      const abiertas = c.ordenesTrabajo.filter((ot) => ot.estado === 'ABIERTA' || ot.estado === 'PAUSADA').length;
      const pendientesFirma = c.ordenesTrabajo.filter((ot) => ot.estado === 'PENDIENTE_FIRMA').length;
      const cerradas = c.ordenesTrabajo.filter((ot) => ot.estado === 'CERRADA').length;
      const totalOts = c.ordenesTrabajo.length;
      const responsablesActivos = c.responsables.filter((r) => r.portalHabilitado).length;

      return {
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion,
        totalProyectos,
        abiertas,
        pendientesFirma,
        cerradas,
        totalOts,
        responsablesActivos,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching clients for OT module:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const client = await prisma.hdbClient.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado en SGI' }, { status: 404 });
    }

    const config = await prisma.hdbClientConfig.upsert({
      where: { clientId },
      create: {
        clientId,
        habilitadoOT: true,
        porcentajeMateriales: 0,
      },
      update: {
        habilitadoOT: true,
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_CONFIG',
      entityId: clientId,
      newValue: { habilitadoOT: true, operation: 'ENABLE_CLIENT_OT' },
    });

    return NextResponse.json({
      success: true,
      message: `Cliente "${client.nombre}" habilitado para Órdenes de Trabajo.`,
      config,
    });
  } catch (error: any) {
    console.error('Error enabling client for OT:', error);
    return NextResponse.json({ error: error.message || 'Error al habilitar cliente' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    await prisma.hdbClientConfig.upsert({
      where: { clientId },
      create: {
        clientId,
        habilitadoOT: false,
      },
      update: {
        habilitadoOT: false,
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_CONFIG',
      entityId: clientId,
      newValue: { habilitadoOT: false, operation: 'DISABLE_CLIENT_OT' },
    });

    return NextResponse.json({
      success: true,
      message: 'Cliente removido del módulo OT. El cliente en SGI y su historial permanecen intactos.',
    });
  } catch (error: any) {
    console.error('Error disabling client for OT:', error);
    return NextResponse.json({ error: error.message || 'Error al deshabilitar cliente' }, { status: 500 });
  }
}
