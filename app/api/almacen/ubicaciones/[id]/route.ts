import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';
import { logAudit } from '@/lib/audit';

const ubicacionUpdateSchema = z.object({
  codigo: z.string().min(1).toUpperCase().trim(),
  nombre: z.string().optional().nullable(),
  tipo: z.string().default('ESTANTERIA'),
  activo: z.boolean().default(true),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = ubicacionUpdateSchema.parse(body);

    const actual = await prisma.almacenUbicacion.findUnique({
      where: { id: params.id },
    });

    if (!actual) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    if (data.codigo !== actual.codigo) {
      const duplicado = await prisma.almacenUbicacion.findUnique({
        where: {
          almacenId_codigo: {
            almacenId: actual.almacenId,
            codigo: data.codigo,
          },
        },
      });
      if (duplicado && duplicado.id !== params.id) {
        return NextResponse.json(
          { error: `Ya existe otra ubicación con el código "${data.codigo}" en este almacén` },
          { status: 400 }
        );
      }
    }

    const actualizada = await prisma.almacenUbicacion.update({
      where: { id: params.id },
      data: {
        codigo: data.codigo,
        nombre: data.nombre || null,
        tipo: data.tipo,
        activo: data.activo,
      },
    });

    await logAudit({
      userId: auth.usuario?.id,
      action: 'UPDATE',
      entity: 'ALMACEN_UBICACION',
      entityId: params.id,
      oldValue: actual,
      newValue: actualizada,
    });

    return NextResponse.json(actualizada);
  } catch (error: any) {
    console.error('Error actualizando ubicación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar ubicación' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const ubicacion = await prisma.almacenUbicacion.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { stocks: true, movimientos: true } },
      },
    });

    if (!ubicacion) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    // Si tiene referencias históricas, desactivar lógicamente
    if (ubicacion._count.stocks > 0 || ubicacion._count.movimientos > 0) {
      const desactivada = await prisma.almacenUbicacion.update({
        where: { id: params.id },
        data: { activo: false },
      });
      return NextResponse.json({
        success: true,
        tipo: 'DESACTIVADA',
        mensaje: 'La ubicación posee referencias históricas; ha sido desactivada.',
        ubicacion: desactivada,
      });
    }

    await prisma.almacenUbicacion.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Ubicación eliminada correctamente.',
    });
  } catch (error: any) {
    console.error('Error eliminando ubicación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar ubicación' },
      { status: 500 }
    );
  }
}
