import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';
import { tarifaHora } from '@/lib/manoObra/tarifa';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type Tx = Prisma.TransactionClient;

/** Horas con dos decimales, para no acumular errores de punto flotante al sumar. */
function redondearHoras(h: number): number {
  return Math.round(h * 100) / 100;
}

/** Recalcula los totales del ciclo a partir de sus operadores y materiales. */
async function recalcularTotalesCiclo(tx: Tx, cicloId: string) {
  const [allOps, allMats] = await Promise.all([
    tx.otCicloOperador.findMany({ where: { cicloId } }),
    tx.otCicloMaterial.findMany({ where: { cicloId } }),
  ]);

  const totalHoras = allOps.reduce((sum, o) => sum + o.horas, 0);
  const totalManoObra = allOps.reduce((sum, o) => sum + o.costoManoObra, 0);
  const totalMateriales = allMats.reduce((sum, m) => sum + m.importeTotal, 0);

  await tx.otCiclo.update({
    where: { id: cicloId },
    data: { totalHoras, totalManoObra, totalMateriales, totalGeneral: totalManoObra + totalMateriales },
  });
}

/** Sin permiso para ver montos, la respuesta no lleva valor hora ni costo. */
function respuestaOperador<T extends { valorHoraSnapshot: number; costoManoObra: number }>(op: T, verMontos: boolean) {
  return verMontos ? op : { ...op, valorHoraSnapshot: null, costoManoObra: null };
}

const patchSchema = z.object({
  itemId: z.string().min(1, 'itemId es requerido'),
  modo: z.enum(['sumar', 'fijar']),
  horas: z.coerce.number({ error: 'Las horas deben ser un número' }),
});

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

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

    // Valor hora con la regla única de tarifas (P20): excepción del cliente para la persona, valor del
    // cliente para su categoría, valor de la categoría o valor por defecto. Antes, sin tarifa cargada, la hora valía $0.
    const { valorHora: valorHoraSnapshot } = await tarifaHora(operadorId, ot.clienteId);
    const costoManoObra = numHoras * valorHoraSnapshot;

    // Si el operador ya tiene horas en el ciclo, se suman a su registro en vez de crear otro.
    const existente = await prisma.otCicloOperador.findFirst({
      where: { cicloId: targetCiclo.id, operadorId },
      orderBy: { createdAt: 'asc' },
    });

    const result = await prisma.$transaction(async (tx) => {
      const cicloOp = existente
        ? await tx.otCicloOperador.update({
            where: { id: existente.id },
            data: {
              horas: redondearHoras(existente.horas + numHoras),
              costoManoObra: redondearHoras(existente.horas + numHoras) * existente.valorHoraSnapshot,
            },
          })
        : await tx.otCicloOperador.create({
            data: {
              cicloId: targetCiclo.id,
              operadorId,
              horas: numHoras,
              valorHoraSnapshot,
              costoManoObra,
            },
          });

      await recalcularTotalesCiclo(tx, targetCiclo.id);
      return cicloOp;
    });

    await logAudit({
      userId: acceso.userId,
      userName: acceso.nombre,
      action: existente ? 'UPDATE' : 'CREATE',
      entity: 'OT_CICLO_OPERADOR',
      entityId: result.id,
      oldValue: existente ?? undefined,
      newValue: { ordenTrabajoId: id, cicloId: targetCiclo.id, operadorId, horasAgregadas: numHoras, horas: result.horas, valorHoraSnapshot: result.valorHoraSnapshot, costoManoObra: result.costoManoObra },
    });

    return NextResponse.json(
      { ...respuestaOperador(result, acceso.puede('ot.ver_montos')), sumado: !!existente },
      { status: existente ? 200 : 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/operadores:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar horas' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) return NextResponse.json({ error: 'itemId es requerido' }, { status: 400 });

    const item = await prisma.otCicloOperador.findUnique({
      where: { id: itemId },
      include: { ciclo: { include: { ordenTrabajo: { select: { id: true, responsableId: true } } } } },
    });

    if (!item || item.ciclo.ordenTrabajo.id !== id) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }
    // Eliminar horas: el responsable de la OT, o quien tenga ot.editar_horas (admin y supervisor).
    if (item.ciclo.ordenTrabajo.responsableId !== acceso.userId && !acceso.puede('ot.editar_horas')) {
      return NextResponse.json(
        { error: 'Solo el responsable de la OT, un supervisor o un administrador pueden eliminar horas' },
        { status: 403 }
      );
    }
    if (item.ciclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden eliminar registros de un ciclo firmado' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.otCicloOperador.delete({ where: { id: itemId } });
      await recalcularTotalesCiclo(tx, item.cicloId);
    });

    await logAudit({
      userId: acceso.userId,
      userName: acceso.nombre,
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

/**
 * Corrige las horas de un registro existente sin tener que borrarlo y volver a cargarlo.
 *  - modo "sumar": agrega (o descuenta, con un valor negativo) horas al registro.
 *  - modo "fijar": reemplaza el total de horas del registro.
 * Se mantiene el valor hora con el que se cargó el registro.
 */
export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    }
    const { itemId, modo, horas } = parsed.data;
    if (!Number.isFinite(horas)) {
      return NextResponse.json({ error: 'Las horas deben ser un número' }, { status: 400 });
    }

    const item = await prisma.otCicloOperador.findUnique({
      where: { id: itemId },
      include: { ciclo: { include: { ordenTrabajo: { select: { id: true, estado: true, responsableId: true } } } } },
    });

    if (!item || item.ciclo.ordenTrabajo.id !== params.id) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }
    // Editar horas: el responsable de la OT, o quien tenga ot.editar_horas (admin y supervisor).
    if (item.ciclo.ordenTrabajo.responsableId !== acceso.userId && !acceso.puede('ot.editar_horas')) {
      return NextResponse.json(
        { error: 'Solo el responsable de la OT, un supervisor o un administrador pueden editar horas' },
        { status: 403 }
      );
    }
    if (item.ciclo.ordenTrabajo.estado === 'CERRADA') {
      return NextResponse.json({ error: 'No se pueden modificar horas de una OT cerrada' }, { status: 400 });
    }
    if (item.ciclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden modificar datos de un ciclo ya firmado' }, { status: 400 });
    }

    const nuevasHoras = redondearHoras(modo === 'sumar' ? item.horas + horas : horas);
    if (modo === 'sumar' && horas === 0) {
      return NextResponse.json({ error: 'Ingresá las horas a sumar' }, { status: 400 });
    }
    if (nuevasHoras <= 0) {
      return NextResponse.json(
        { error: 'El total de horas debe ser mayor a 0. Para quitar al técnico, eliminá el registro.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.otCicloOperador.update({
        where: { id: itemId },
        data: { horas: nuevasHoras, costoManoObra: nuevasHoras * item.valorHoraSnapshot },
      });
      await recalcularTotalesCiclo(tx, item.cicloId);
      return actualizado;
    });

    await logAudit({
      userId: acceso.userId,
      userName: acceso.nombre,
      action: 'UPDATE',
      entity: 'OT_CICLO_OPERADOR',
      entityId: itemId,
      oldValue: { horas: item.horas, costoManoObra: item.costoManoObra },
      newValue: { ordenTrabajoId: params.id, cicloId: item.cicloId, modo, horasIngresadas: horas, horas: result.horas, costoManoObra: result.costoManoObra },
    });

    return NextResponse.json(respuestaOperador(result, acceso.puede('ot.ver_montos')));
  } catch (error: any) {
    console.error('Error in PATCH /api/ordenes-trabajo/[id]/operadores:', error);
    return NextResponse.json({ error: error.message || 'Error al modificar horas' }, { status: 500 });
  }
}
