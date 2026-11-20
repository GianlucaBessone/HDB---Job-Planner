import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const { id } = params;
    const body = await req.json();
    const { nuevoEstado, motivo } = body;

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
    // Quien cambia el estado es el usuario de la sesión (se ignoran usuarioId / usuarioNombre del cuerpo).
    const effectiveUserId = acceso.userId;
    const effectiveUserName = acceso.nombre;

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
