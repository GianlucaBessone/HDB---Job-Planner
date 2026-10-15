import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';
import { logAudit } from '@/lib/audit';

const almacenSchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio').toUpperCase().trim(),
  nombre: z.string().min(1, 'El nombre es obligatorio').trim(),
  descripcion: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  responsableId: z.string().optional().nullable(),
  responsableNombre: z.string().optional().nullable(),
  esPredeterminado: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_stock');
    if (auth.error) return auth.error;

    const almacenes = await prisma.almacen.findMany({
      include: {
        _count: {
          select: {
            ubicaciones: true,
            stocks: true,
            movimientos: true,
          },
        },
        ubicaciones: {
          where: { activo: true },
          select: { id: true, codigo: true, nombre: true, tipo: true, activo: true },
          orderBy: { codigo: 'asc' },
        },
      },
      orderBy: [{ esPredeterminado: 'desc' }, { nombre: 'asc' }],
    });

    return NextResponse.json({ almacenes });
  } catch (error: any) {
    console.error('Error listando almacenes:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar almacenes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = almacenSchema.parse(body);

    const existeCodigo = await prisma.almacen.findUnique({
      where: { codigo: data.codigo },
    });

    if (existeCodigo) {
      return NextResponse.json(
        { error: `Ya existe un almacén con el código "${data.codigo}"` },
        { status: 400 }
      );
    }

    const nuevoAlmacen = await prisma.$transaction(async (tx) => {
      // Si se marca como predeterminado, desmarcar los demás
      if (data.esPredeterminado) {
        await tx.almacen.updateMany({
          where: { esPredeterminado: true },
          data: { esPredeterminado: false },
        });
      }

      const alm = await tx.almacen.create({
        data: {
          codigo: data.codigo,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          direccion: data.direccion || null,
          responsableId: data.responsableId || null,
          responsableNombre: data.responsableNombre || null,
          esPredeterminado: data.esPredeterminado,
          activo: true,
        },
      });

      // Crear ubicación general por defecto para el nuevo almacén
      await tx.almacenUbicacion.create({
        data: {
          almacenId: alm.id,
          codigo: 'GENERAL',
          nombre: 'Ubicación General / Recepción',
          tipo: 'DEPOSITO',
          activo: true,
        },
      });

      return alm;
    });

    await logAudit({
      userId: auth.usuario?.id,
      action: 'CREATE',
      entity: 'ALMACEN',
      entityId: nuevoAlmacen.id,
      newValue: nuevoAlmacen,
    });

    return NextResponse.json(nuevoAlmacen, { status: 201 });
  } catch (error: any) {
    console.error('Error creando almacén:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear almacén' },
      { status: 500 }
    );
  }
}
