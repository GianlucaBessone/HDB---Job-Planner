import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      materialCodigo,
      descripcion,
      cantidad,
      metros,
      precioFinal,
      cicloId,
    } = body;

    if (!materialCodigo || cantidad === undefined || cantidad === null) {
      return NextResponse.json({ error: 'Código de material y cantidad son requeridos' }, { status: 400 });
    }

    const numCantidad = parseFloat(cantidad);
    if (isNaN(numCantidad) || numCantidad <= 0) {
      return NextResponse.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
    }

    const numMetros = metros !== undefined && metros !== null && metros !== '' ? parseFloat(metros) : null;

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: {
          include: {
            configuracion: true,
          },
        },
        ciclos: {
          orderBy: { numeroCiclo: 'desc' },
          take: 1,
        },
      },
    });

    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    if (ot.estado === 'CERRADA') {
      return NextResponse.json({ error: 'No se pueden cargar materiales a una OT cerrada' }, { status: 400 });
    }

    const targetCiclo = cicloId
      ? await prisma.otCiclo.findUnique({ where: { id: cicloId } })
      : ot.ciclos[0];

    if (!targetCiclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    if (targetCiclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden modificar datos de un ciclo ya firmado' }, { status: 400 });
    }

    let materialSource = 'INVENTARIO';
    let finalDesc = descripcion?.trim() || '';
    let precioBaseSnapshot = 0;
    let porcentajeClienteSnapshot = 0;
    let precioFinalSnapshot = 0;

    // Regla especial del material 999999 (Manual)
    if (materialCodigo.trim() === '999999') {
      materialSource = 'MANUAL';
      if (!finalDesc) {
        return NextResponse.json({ error: 'Para el código 999999 la descripción del material es obligatoria' }, { status: 400 });
      }
      const numPrecioFinal = parseFloat(precioFinal);
      if (isNaN(numPrecioFinal) || numPrecioFinal < 0) {
        return NextResponse.json({ error: 'Debe ingresar un precio final válido para el material manual' }, { status: 400 });
      }

      // Regla estricta: NO aplicar recargo ni descuento. Precio final exacto.
      precioBaseSnapshot = numPrecioFinal;
      porcentajeClienteSnapshot = 0;
      precioFinalSnapshot = numPrecioFinal;
    } else {
      // Material de inventario
      materialSource = 'INVENTARIO';

      // Buscar en MaterialMaestro o Producto
      const [matMaestro, producto] = await Promise.all([
        prisma.materialMaestro.findUnique({ where: { codigo: materialCodigo.trim() } }),
        prisma.producto.findFirst({ where: { OR: [{ sku: materialCodigo.trim() }, { id: materialCodigo.trim() }] } }),
      ]);

      if (!matMaestro && !producto) {
        return NextResponse.json(
          { error: `El material con código ${materialCodigo} no existe en inventario. Use el código 999999 para materiales no inventariados.` },
          { status: 404 }
        );
      }

      finalDesc = finalDesc || matMaestro?.nombre || producto?.descripcion || 'Material de inventario';
      precioBaseSnapshot = matMaestro?.precioVenta || producto?.precioBase || 0;

      // Aplicar porcentaje del cliente
      porcentajeClienteSnapshot = ot.cliente.configuracion?.porcentajeMateriales || 0;
      precioFinalSnapshot = Math.round(precioBaseSnapshot * (1 + porcentajeClienteSnapshot / 100) * 100) / 100;
    }

    const importeTotal = Math.round(numCantidad * precioFinalSnapshot * 100) / 100;

    const result = await prisma.$transaction(async (tx) => {
      const cicloMat = await tx.otCicloMaterial.create({
        data: {
          cicloId: targetCiclo.id,
          materialSource,
          materialCodigo: materialCodigo.trim(),
          descripcion: finalDesc,
          cantidad: numCantidad,
          metros: numMetros,
          precioBaseSnapshot,
          porcentajeClienteSnapshot,
          precioFinalSnapshot,
          importeTotal,
        },
      });

      // Recalculate cycle totals
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

      return cicloMat;
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'CREATE',
      entity: 'OT_CICLO_MATERIAL',
      entityId: result.id,
      newValue: {
        ordenTrabajoId: id,
        cicloId: targetCiclo.id,
        materialSource,
        materialCodigo,
        descripcion: finalDesc,
        cantidad: numCantidad,
        precioFinalSnapshot,
        importeTotal,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/materiales:', error);
    return NextResponse.json({ error: error.message || 'Error al agregar material' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) return NextResponse.json({ error: 'itemId es requerido' }, { status: 400 });

    const item = await prisma.otCicloMaterial.findUnique({
      where: { id: itemId },
      include: { ciclo: true },
    });

    if (!item) return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
    if (item.ciclo.estado === 'FIRMADO') {
      return NextResponse.json({ error: 'No se pueden eliminar materiales de un ciclo firmado' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.otCicloMaterial.delete({ where: { id: itemId } });

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
      entity: 'OT_CICLO_MATERIAL',
      entityId: itemId,
      oldValue: item,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/ordenes-trabajo/[id]/materiales:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar material' }, { status: 500 });
  }
}
