import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { proveedorVentasSchema } from '@/lib/ventas/proveedorVentas';
import { buscarConflictoProveedor } from '@/lib/ventas/proveedorVentasConflictos';
import { exigirAcceso } from '@/lib/permisosServer';
import { PROVEEDORES_COMERCIALES, PROVEEDORES_DE_GASTOS } from '@/lib/proveedores';

/**
 * GET /api/ventas/proveedores?q=&estado=activos|inactivos|todos&tipo=comerciales|gastos|todos
 * Maestro único de proveedores (P24) con la cantidad de productos y de facturas de gastos.
 * `tipo` separa los proveedores comerciales de los que solo tienen facturas de gastos (peajes, combustible,
 * comidas de viaje…): un proveedor es "de gastos" mientras no tenga productos vinculados y sí facturas.
 * Sin `tipo` se devuelven todos.
 */
const DE_GASTOS = PROVEEDORES_DE_GASTOS;
const COMERCIALES = PROVEEDORES_COMERCIALES;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const estado = searchParams.get('estado') || 'activos';
    const tipo = searchParams.get('tipo') || 'todos';

    const porEstado: Prisma.ProveedorVentasWhereInput =
      estado === 'activos' ? { activo: true } : estado === 'inactivos' ? { activo: false } : {};
    const porTipo: Prisma.ProveedorVentasWhereInput =
      tipo === 'gastos' ? DE_GASTOS : tipo === 'comerciales' ? COMERCIALES : {};

    const where: Prisma.ProveedorVentasWhereInput = { AND: [porEstado, porTipo] };
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

    const [proveedores, totalActivos, totalInactivos, comerciales, deGastos] = await Promise.all([
      prisma.proveedorVentas.findMany({
        where,
        include: { _count: { select: { productos: true, facturas: true } } },
        orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
      }),
      prisma.proveedorVentas.count({ where: { AND: [porTipo, { activo: true }] } }),
      prisma.proveedorVentas.count({ where: { AND: [porTipo, { activo: false }] } }),
      prisma.proveedorVentas.count({ where: { AND: [porEstado, COMERCIALES] } }),
      prisma.proveedorVentas.count({ where: { AND: [porEstado, DE_GASTOS] } }),
    ]);

    return NextResponse.json({
      proveedores: proveedores.map(({ _count, ...p }) => ({ ...p, productosCount: _count.productos, facturasCount: _count.facturas })),
      totales: { activos: totalActivos, inactivos: totalInactivos, comerciales, deGastos },
    });
  } catch (error: any) {
    console.error('Error fetching proveedores de ventas:', error);
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
  }
}

/** POST /api/ventas/proveedores — alta de proveedor de ventas. */
export async function POST(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['ventas.catalogo_gestionar'], 'No tenés permiso para modificar el catálogo comercial');
    if (acceso instanceof NextResponse) return acceso;

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
