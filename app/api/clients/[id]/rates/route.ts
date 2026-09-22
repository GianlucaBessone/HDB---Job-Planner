import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const body = await req.json();
    const { operatorId, valorHora } = body;

    if (!operatorId || valorHora === undefined || valorHora === null) {
      return NextResponse.json({ error: 'Operador y valor hora son requeridos' }, { status: 400 });
    }

    const numValor = parseFloat(valorHora);
    if (isNaN(numValor) || numValor < 0) {
      return NextResponse.json({ error: 'El valor hora debe ser un número positivo' }, { status: 400 });
    }

    const rate = await prisma.clientOperatorRate.upsert({
      where: {
        clientId_operatorId: {
          clientId,
          operatorId,
        },
      },
      create: {
        clientId,
        operatorId,
        valorHora: numValor,
        activo: true,
      },
      update: {
        valorHora: numValor,
        activo: true,
      },
      include: {
        operator: { select: { id: true, nombreCompleto: true, role: true } },
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_OPERATOR_RATE',
      entityId: rate.id,
      newValue: { clientId, operatorId, valorHora: numValor, activo: true },
    });

    return NextResponse.json(rate);
  } catch (error: any) {
    console.error('Error in POST /api/clients/[id]/rates:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar valor hora' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const body = await req.json();
    const { rateId, valorHora, activo } = body;

    if (!rateId) {
      return NextResponse.json({ error: 'ID de tarifa es requerido' }, { status: 400 });
    }

    const existing = await prisma.clientOperatorRate.findUnique({
      where: { id: rateId },
    });

    if (!existing || existing.clientId !== clientId) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    const updateData: any = {};
    if (valorHora !== undefined && valorHora !== null) {
      const numValor = parseFloat(valorHora);
      if (isNaN(numValor) || numValor < 0) {
        return NextResponse.json({ error: 'El valor hora debe ser un número positivo' }, { status: 400 });
      }
      updateData.valorHora = numValor;
    }

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const updated = await prisma.clientOperatorRate.update({
      where: { id: rateId },
      data: updateData,
      include: {
        operator: { select: { id: true, nombreCompleto: true, role: true } },
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_OPERATOR_RATE',
      entityId: rateId,
      newValue: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in PUT /api/clients/[id]/rates:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar valor hora' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const { searchParams } = new URL(req.url);
    const rateId = searchParams.get('rateId');

    if (!rateId) {
      return NextResponse.json({ error: 'ID de tarifa requerido' }, { status: 400 });
    }

    const rate = await prisma.clientOperatorRate.findUnique({
      where: { id: rateId },
    });

    if (!rate || rate.clientId !== clientId) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    // Check if operator has any historical hours logged in OTs for this client
    const hasHistory = await prisma.otCicloOperador.findFirst({
      where: {
        operadorId: rate.operatorId,
        ciclo: {
          ordenTrabajo: {
            clienteId: clientId,
          },
        },
      },
    });

    if (hasHistory) {
      // Soft-delete to protect historical integrity
      await prisma.clientOperatorRate.update({
        where: { id: rateId },
        data: { activo: false },
      });

      await logAudit({
        userId: req.headers.get('x-user-id') || undefined,
        userName: req.headers.get('x-user-name') || undefined,
        action: 'UPDATE',
        entity: 'CLIENT_OPERATOR_RATE',
        entityId: rateId,
        metadata: { reason: 'Soft delete: rate has historical references in OT cycles', activo: false },
      });

      return NextResponse.json({
        softDeleted: true,
        message: 'El valor horario fue desactivado para preservar el historial de OTs.',
      });
    }

    // No historical dependencies -> safe physical delete
    await prisma.clientOperatorRate.delete({
      where: { id: rateId },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'DELETE',
      entity: 'CLIENT_OPERATOR_RATE',
      entityId: rateId,
    });

    return NextResponse.json({
      deleted: true,
      message: 'Valor horario eliminado exitosamente.',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/clients/[id]/rates:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar valor hora' }, { status: 500 });
  }
}
