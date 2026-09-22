import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            direccion: true,
            configuracion: true,
            sectores: true,
          },
        },
        proyecto: {
          select: {
            id: true,
            nombre: true,
            codigoProyecto: true,
            estado: true,
          },
        },
        responsable: {
          select: { id: true, nombreCompleto: true, role: true, dni: true },
        },
        creador: {
          select: { id: true, nombreCompleto: true, role: true },
        },
        otPrevia: {
          select: { id: true, numeroOT: true, refCliente: true, estado: true },
        },
        otSiguiente: {
          select: { id: true, numeroOT: true, refCliente: true, estado: true },
        },
        ciclos: {
          orderBy: { numeroCiclo: 'asc' },
          include: {
            operadores: {
              include: {
                operador: { select: { id: true, nombreCompleto: true, role: true } },
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
        historialEstados: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ot) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    return NextResponse.json(ot);
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-trabajo/[id]:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener orden de trabajo' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { reporteTrabajo, sector, refCliente, responsableId } = body;

    const existingOt = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: { responsable: true },
    });

    if (!existingOt) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Do not allow edits if closed
    if (existingOt.estado === 'CERRADA') {
      return NextResponse.json({ error: 'No se puede modificar una orden de trabajo cerrada' }, { status: 400 });
    }

    const updateData: any = {};
    if (reporteTrabajo !== undefined) updateData.reporteTrabajo = reporteTrabajo.trim();
    if (sector !== undefined) updateData.sector = sector ? sector.trim() : null;
    if (refCliente !== undefined) updateData.refCliente = refCliente ? refCliente.trim() : null;

    let responsableChanged = false;
    let nuevoResponsableNombre = '';

    if (responsableId && responsableId !== existingOt.responsableId) {
      const nuevoResponsable = await prisma.operator.findUnique({ where: { id: responsableId } });
      if (!nuevoResponsable) {
        return NextResponse.json({ error: 'Nuevo responsable no encontrado' }, { status: 404 });
      }
      updateData.responsableId = responsableId;
      responsableChanged = true;
      nuevoResponsableNombre = nuevoResponsable.nombreCompleto;
    }

    const updatedOt = await prisma.ordenTrabajo.update({
      where: { id },
      data: updateData,
      include: {
        responsable: { select: { id: true, nombreCompleto: true } },
      },
    });

    // Auto-guardar nueva ubicación en ClientSector si no existe
    if (sector && typeof sector === 'string' && sector.trim()) {
      const trimmedSector = sector.trim();
      const existingSector = await prisma.clientSector.findFirst({
        where: {
          clientId: existingOt.clienteId,
          nombre: { equals: trimmedSector, mode: 'insensitive' },
        },
      });
      if (!existingSector) {
        await prisma.clientSector.create({
          data: {
            clientId: existingOt.clienteId,
            nombre: trimmedSector,
            projectId: existingOt.proyectoId,
          },
        });
      }
    }

    const currentUserId = req.headers.get('x-user-id') || undefined;
    const currentUserName = req.headers.get('x-user-name') || undefined;

    if (responsableChanged) {
      await logAudit({
        userId: currentUserId,
        userName: currentUserName,
        action: 'UPDATE',
        entity: 'ORDEN_TRABAJO',
        entityId: id,
        oldValue: { responsableId: existingOt.responsableId, responsableNombre: existingOt.responsable.nombreCompleto },
        newValue: { responsableId, responsableNombre: nuevoResponsableNombre },
        metadata: { motivo: 'Reasignación de responsable' },
      });
    }

    return NextResponse.json(updatedOt);
  } catch (error: any) {
    console.error('Error in PUT /api/ordenes-trabajo/[id]:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar orden de trabajo' }, { status: 500 });
  }
}
