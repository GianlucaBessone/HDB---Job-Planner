import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';
import { logAudit } from '@/lib/audit';

const ubicacionSchema = z.object({
  almacenId: z.string().min(1, 'El almacén es obligatorio'),
  codigo: z.string().min(1, 'El código de ubicación es obligatorio').toUpperCase().trim(),
  nombre: z.string().optional().nullable(),
  tipo: z.string().default('ESTANTERIA'),
});

export async function GET(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_stock');
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const almacenId = searchParams.get('almacenId');

    const where: any = {};
    if (almacenId) where.almacenId = almacenId;

    const ubicaciones = await prisma.almacenUbicacion.findMany({
      where,
      include: {
        almacen: { select: { id: true, nombre: true, codigo: true } },
        _count: { select: { stocks: true, movimientos: true } },
      },
      orderBy: [{ almacen: { nombre: 'asc' } }, { codigo: 'asc' }],
    });

    return NextResponse.json({ ubicaciones });
  } catch (error: any) {
    console.error('Error listando ubicaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar ubicaciones' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = ubicacionSchema.parse(body);

    // Unicidad dentro del almacén
    const existe = await prisma.almacenUbicacion.findUnique({
      where: {
        almacenId_codigo: {
          almacenId: data.almacenId,
          codigo: data.codigo,
        },
      },
    });

    if (existe) {
      return NextResponse.json(
        { error: `Ya existe una ubicación con el código "${data.codigo}" en este almacén` },
        { status: 400 }
      );
    }

    const nuevaUbicacion = await prisma.almacenUbicacion.create({
      data: {
        almacenId: data.almacenId,
        codigo: data.codigo,
        nombre: data.nombre || null,
        tipo: data.tipo,
        activo: true,
      },
      include: {
        almacen: { select: { id: true, nombre: true } },
      },
    });

    await logAudit({
      userId: auth.usuario?.id,
      action: 'CREATE',
      entity: 'ALMACEN_UBICACION',
      entityId: nuevaUbicacion.id,
      newValue: nuevaUbicacion,
    });

    return NextResponse.json(nuevaUbicacion, { status: 201 });
  } catch (error: any) {
    console.error('Error creando ubicación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear ubicación' },
      { status: 500 }
    );
  }
}
