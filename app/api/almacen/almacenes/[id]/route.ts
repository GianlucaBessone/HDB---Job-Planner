import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';
import { logAudit } from '@/lib/audit';

const almacenUpdateSchema = z.object({
  codigo: z.string().min(1).toUpperCase().trim(),
  nombre: z.string().min(1).trim(),
  descripcion: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  responsableId: z.string().optional().nullable(),
  responsableNombre: z.string().optional().nullable(),
  esPredeterminado: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export async function PUT(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = almacenUpdateSchema.parse(body);

    const actual = await prisma.almacen.findUnique({
      where: { id: params.id },
    });
    if (!actual) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    // Verificar código duplicado
    if (data.codigo !== actual.codigo) {
      const duplicado = await prisma.almacen.findUnique({
        where: { codigo: data.codigo },
      });
      if (duplicado && duplicado.id !== params.id) {
        return NextResponse.json(
          { error: `El código "${data.codigo}" ya pertenece a otro almacén` },
          { status: 400 }
        );
      }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      if (data.esPredeterminado && !actual.esPredeterminado) {
        await tx.almacen.updateMany({
          where: { esPredeterminado: true },
          data: { esPredeterminado: false },
        });
      }

      return await tx.almacen.update({
        where: { id: params.id },
        data: {
          codigo: data.codigo,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          direccion: data.direccion || null,
          responsableId: data.responsableId || null,
          responsableNombre: data.responsableNombre || null,
          esPredeterminado: data.esPredeterminado,
          activo: data.activo,
        },
      });
    });

    await logAudit({
      userId: auth.usuario?.id,
      action: 'UPDATE',
      entity: 'ALMACEN',
      entityId: params.id,
      oldValue: actual,
      newValue: actualizado,
    });

    return NextResponse.json(actualizado);
  } catch (error: any) {
    console.error('Error actualizando almacén:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar almacén' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const auth = verificarPermisoInventario(req, 'almacenes_admin');
    if (auth.error) return auth.error;

    const almacen = await prisma.almacen.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            movimientos: true,
            stocks: true,
          },
        },
      },
    });

    if (!almacen) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    // Regla estricta de ERP:
    // No permitir eliminar físicamente un almacén que tenga movimientos o existencias históricas.
    if (almacen._count.movimientos > 0) {
      // Forzar baja lógica
      const desactivado = await prisma.almacen.update({
        where: { id: params.id },
        data: { activo: false, esPredeterminado: false },
      });

      return NextResponse.json({
        success: true,
        tipo: 'DESACTIVADO',
        mensaje: `El almacén posee ${almacen._count.movimientos} movimientos registrados. Por razones de trazabilidad fiscal y auditoría, no se puede eliminar físicamente; ha sido desactivado.`,
        almacen: desactivado,
      });
    }

    // Si no tiene movimientos ni saldos > 0, permitir desactivar o eliminar
    const desactivado = await prisma.almacen.update({
      where: { id: params.id },
      data: { activo: false, esPredeterminado: false },
    });

    return NextResponse.json({
      success: true,
      tipo: 'DESACTIVADO',
      mensaje: 'Almacén desactivado correctamente.',
      almacen: desactivado,
    });
  } catch (error: any) {
    console.error('Error eliminando almacén:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar baja de almacén' },
      { status: 500 }
    );
  }
}
