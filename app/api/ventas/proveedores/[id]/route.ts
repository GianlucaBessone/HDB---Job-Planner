import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { proveedorVentasSchema } from '@/lib/ventas/proveedorVentas';
import { buscarConflictoProveedor } from '@/lib/ventas/proveedorVentasConflictos';

type Ctx = { params: Promise<{ id: string }> };

const estadoSchema = z.object({ activo: z.boolean() });

async function findWithCount(id: string) {
  return prisma.proveedorVentas.findUnique({
    where: { id },
    include: { _count: { select: { productos: true } } },
  });
}

function serialize(p: NonNullable<Awaited<ReturnType<typeof findWithCount>>>) {
  const { _count, ...rest } = p;
  return { ...rest, productosCount: _count.productos };
}

/** GET /api/ventas/proveedores/[id] */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const proveedor = await findWithCount(id);
  if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  return NextResponse.json(serialize(proveedor));
}

/** PUT /api/ventas/proveedores/[id] — modifica los datos del proveedor. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await prisma.proveedorVentas.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

    const data = proveedorVentasSchema.parse(await req.json());
    const conflicto = await buscarConflictoProveedor(data, id);
    if (conflicto) return NextResponse.json({ error: conflicto }, { status: 409 });

    await prisma.proveedorVentas.update({
      where: { id },
      data: { ...data, activo: data.activo ?? existing.activo },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      action: 'UPDATE',
      entity: 'VENTAS_PROVEEDOR',
      entityId: id,
      oldValue: { razonSocial: existing.razonSocial, nombreFantasia: existing.nombreFantasia, cuit: existing.cuit, codigo: existing.codigo },
      newValue: { razonSocial: data.razonSocial, nombreFantasia: data.nombreFantasia, cuit: data.cuit, codigo: data.codigo },
    });

    return NextResponse.json(serialize((await findWithCount(id))!));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos', details: error.issues }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un proveedor con ese código' }, { status: 409 });
    }
    console.error('Error updating proveedor de ventas:', error);
    return NextResponse.json({ error: 'Error al actualizar el proveedor' }, { status: 500 });
  }
}

/** PATCH /api/ventas/proveedores/[id] — activa o da de baja (baja lógica). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const { activo } = estadoSchema.parse(await req.json());
    const existing = await prisma.proveedorVentas.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

    await prisma.proveedorVentas.update({ where: { id }, data: { activo } });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      action: 'UPDATE',
      entity: 'VENTAS_PROVEEDOR',
      entityId: id,
      oldValue: { activo: existing.activo },
      newValue: { activo },
    });

    return NextResponse.json(serialize((await findWithCount(id))!));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    console.error('Error changing proveedor de ventas status:', error);
    return NextResponse.json({ error: 'Error al cambiar el estado del proveedor' }, { status: 500 });
  }
}

/**
 * DELETE /api/ventas/proveedores/[id]
 * Elimina definitivamente un proveedor sin productos vinculados. Si tiene
 * productos, no se borra (perderían su costo y SKU de proveedor): se responde
 * 409 para que la vista ofrezca la baja lógica.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await findWithCount(id);
    if (!existing) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

    if (existing._count.productos > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: tiene ${existing._count.productos} producto(s) vinculado(s). Dalo de baja para ocultarlo de los selectores.`,
          productosCount: existing._count.productos,
        },
        { status: 409 }
      );
    }

    await prisma.proveedorVentas.delete({ where: { id } });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      action: 'DELETE',
      entity: 'VENTAS_PROVEEDOR',
      entityId: id,
      oldValue: { razonSocial: existing.razonSocial, cuit: existing.cuit, codigo: existing.codigo },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'No se puede eliminar: el proveedor tiene productos vinculados' }, { status: 409 });
    }
    console.error('Error deleting proveedor de ventas:', error);
    return NextResponse.json({ error: 'Error al eliminar el proveedor' }, { status: 500 });
  }
}
