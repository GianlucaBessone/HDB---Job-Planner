import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { nuevoEstado, motivo, usuarioId, usuarioNombre } = body;

    const validStates = ['ABIERTA', 'PAUSADA', 'PENDIENTE_FIRMA', 'CERRADA'];
    if (!validStates.includes(nuevoEstado)) {
      return NextResponse.json({ error: `Estado inválido. Debe ser uno de: ${validStates.join(', ')}` }, { status: 400 });
    }

    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    if (ot.estado === nuevoEstado) {
      return NextResponse.json({ message: 'El estado ya es el solicitado', ot });
    }

    const estadoAnterior = ot.estado;
    const effectiveUserId = usuarioId || req.headers.get('x-user-id') || undefined;
    const effectiveUserName = usuarioNombre || req.headers.get('x-user-name') || 'Usuario SGI';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.ordenTrabajo.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          fechaCierre: nuevoEstado === 'CERRADA' ? new Date() : (estadoAnterior === 'CERRADA' ? null : ot.fechaCierre),
        },
      });

      await tx.otHistorialEstado.create({
        data: {
          ordenTrabajoId: id,
          estadoAnterior,
          estadoNuevo: nuevoEstado,
          usuarioId: effectiveUserId,
          usuarioNombre: effectiveUserName,
          motivo: motivo || null,
        },
      });

      return updated;
    });

    await logAudit({
      userId: effectiveUserId,
      userName: effectiveUserName,
      action: 'UPDATE',
      entity: 'ORDEN_TRABAJO',
      entityId: id,
      oldValue: { estado: estadoAnterior },
      newValue: { estado: nuevoEstado, motivo },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/estado:', error);
    return NextResponse.json({ error: error.message || 'Error al cambiar estado' }, { status: 500 });
  }
}
