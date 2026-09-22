import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { operadorId, horas, cicloId } = body;

    if (!operadorId || horas === undefined || horas === null) {
      return NextResponse.json({ error: 'Operador y horas son requeridos' }, { status: 400 });
    }

    const numHoras = parseFloat(horas);
    if (isNaN(numHoras) || numHoras < 0) {
      return NextResponse.json({ error: 'Las horas deben ser un número positivo' }, { status: 400 });
    }

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: true,
        ciclos: {
          orderBy: { numeroCiclo: 'desc' },
          take: 1,
        },
      },
    });

    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    if (ot.estado === 'CERRADA') {
      return NextResponse.json({ error: 'No se pueden cargar horas a una OT cerrada' }, { status: 400 });
    }

    // Determine target cycle
    const targetCiclo = cicloId
      ? await prisma.otCiclo.findUnique({ where: { id: cicloId } })
      : ot.ciclos[0];

    if (!targetCiclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    if (targetCiclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden modificar datos de un ciclo ya firmado' }, { status: 400 });
    }

    const operator = await prisma.operator.findUnique({ where: { id: operadorId } });
    if (!operator) return NextResponse.json({ error: 'Operador no encontrado' }, { status: 404 });

    // Look up client rate for this operator
    const rate = await prisma.clientOperatorRate.findUnique({
      where: {
        clientId_operatorId: {
          clientId: ot.clienteId,
          operatorId: operadorId,
        },
      },
    });

    const valorHoraSnapshot = rate ? rate.valorHora : 0;
    const costoManoObra = numHoras * valorHoraSnapshot;

    const result = await prisma.$transaction(async (tx) => {
      // Create cycle operator entry
      const cicloOp = await tx.otCicloOperador.create({
        data: {
          cicloId: targetCiclo.id,
          operadorId,
          horas: numHoras,
          valorHoraSnapshot,
          costoManoObra,
        },
      });

      // Recalculate totals for this cycle
      const allOps = await tx.otCicloOperador.findMany({ where: { cicloId: targetCiclo.id } });
      const allMats = await tx.otCicloMaterial.findMany({ where: { cicloId: targetCiclo.id } });

      const totalHoras = allOps.reduce((sum, o) => sum + o.horas, 0);
      const totalManoObra = allOps.reduce((sum, o) => sum + o.costoManoObra, 0);
      const totalMateriales = allMats.reduce((sum, m) => sum + m.importeTotal, 0);
      const totalGeneral = totalManoObra + totalMateriales;

      await tx.otCiclo.update({
        where: { id: targetCiclo.id },
        data: {
          totalHoras,
          totalManoObra,
          totalMateriales,
          totalGeneral,
        },
      });

      return cicloOp;
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'CREATE',
      entity: 'OT_CICLO_OPERADOR',
      entityId: result.id,
      newValue: { ordenTrabajoId: id, cicloId: targetCiclo.id, operadorId, horas: numHoras, valorHoraSnapshot, costoManoObra },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/operadores:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar horas' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) return NextResponse.json({ error: 'itemId es requerido' }, { status: 400 });

    const item = await prisma.otCicloOperador.findUnique({
      where: { id: itemId },
      include: { ciclo: true },
    });

    if (!item) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    if (item.ciclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden eliminar registros de un ciclo firmado' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.otCicloOperador.delete({ where: { id: itemId } });

      const allOps = await tx.otCicloOperador.findMany({ where: { cicloId: item.cicloId } });
      const allMats = await tx.otCicloMaterial.findMany({ where: { cicloId: item.cicloId } });

      const totalHoras = allOps.reduce((sum, o) => sum + o.horas, 0);
      const totalManoObra = allOps.reduce((sum, o) => sum + o.costoManoObra, 0);
      const totalMateriales = allMats.reduce((sum, m) => sum + m.importeTotal, 0);
      const totalGeneral = totalManoObra + totalMateriales;

      await tx.otCiclo.update({
        where: { id: item.cicloId },
        data: {
          totalHoras,
          totalManoObra,
          totalMateriales,
          totalGeneral,
        },
      });
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'DELETE',
      entity: 'OT_CICLO_OPERADOR',
      entityId: itemId,
      oldValue: item,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/ordenes-trabajo/[id]/operadores:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar horas' }, { status: 500 });
  }
}
