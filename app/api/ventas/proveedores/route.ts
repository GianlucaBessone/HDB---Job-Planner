import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { proveedorVentasSchema } from '@/lib/ventas/proveedorVentas';
import { buscarConflictoProveedor } from '@/lib/ventas/proveedorVentasConflictos';

/**
 * GET /api/ventas/proveedores?q=&estado=activos|inactivos|todos
 * Maestro de proveedores de ventas con la cantidad de productos vinculados.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const estado = searchParams.get('estado') || 'activos';

    const where: Prisma.ProveedorVentasWhereInput = {};
    if (estado === 'activos') where.activo = true;
    if (estado === 'inactivos') where.activo = false;
    if (q) {
      where.OR = [
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { nombreFantasia: { contains: q, mode: 'insensitive' } },
        { codigo: { contains: q, mode: 'insensitive' } },
        { cuit: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { localidad: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [proveedores, totalActivos, totalInactivos] = await Promise.all([
      prisma.proveedorVentas.findMany({
        where,
        include: { _count: { select: { productos: true } } },
        orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
      }),
      prisma.proveedorVentas.count({ where: { activo: true } }),
      prisma.proveedorVentas.count({ where: { activo: false } }),
    ]);

    return NextResponse.json({
      proveedores: proveedores.map(({ _count, ...p }) => ({ ...p, productosCount: _count.productos })),
      totales: { activos: totalActivos, inactivos: totalInactivos },
    });
  } catch (error: any) {
    console.error('Error fetching proveedores de ventas:', error);
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
  }
}

/** POST /api/ventas/proveedores — alta de proveedor de ventas. */
export async function POST(req: NextRequest) {
  try {
    const data = proveedorVentasSchema.parse(await req.json());

    const conflicto = await buscarConflictoProveedor(data);
    if (conflicto) return NextResponse.json({ error: conflicto }, { status: 409 });

    const proveedor = await prisma.proveedorVentas.create({
      data: { ...data, activo: data.activo ?? true },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      action: 'CREATE',
      entity: 'VENTAS_PROVEEDOR',
      entityId: proveedor.id,
      newValue: { razonSocial: proveedor.razonSocial, cuit: proveedor.cuit, codigo: proveedor.codigo },
    });

    return NextResponse.json({ ...proveedor, productosCount: 0 }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos', details: error.issues }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un proveedor con ese código' }, { status: 409 });
    }
    console.error('Error creating proveedor de ventas:', error);
    return NextResponse.json({ error: 'Error al crear el proveedor' }, { status: 500 });
  }
}
