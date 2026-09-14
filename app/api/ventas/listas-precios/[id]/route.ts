import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';
import { recalcularPreciosParaLista } from '@/lib/ventas/listaPrecioService';

const listaPrecioUpdateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  codigo: z.string().min(1, 'El código es obligatorio'),
  descripcion: z.string().optional().nullable(),
  tipoAjuste: z.enum(['MANUAL', 'PORCENTAJE_COSTO', 'MARGEN_COSTO', 'DESCUENTO_BASE', 'RECARGO_BASE']).default('MANUAL'),
  valorAjuste: z.coerce.number().default(0),
  listaBaseId: z.string().optional().nullable(),
  aplicaA: z.enum(['TODOS', 'FAMILIA', 'MARCA']).default('TODOS'),
  familiaId: z.string().optional().nullable(),
  marcaId: z.string().optional().nullable(),
  orden: z.coerce.number().default(1),
  sincronizarProductos: z.boolean().default(false),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const lista = await prisma.listaPrecio.findUnique({
      where: { id },
      include: {
        listaBase: true,
        familia: true,
        marca: true,
      },
    });

    if (!lista) {
      return NextResponse.json({ error: 'Lista de precio no encontrada' }, { status: 404 });
    }

    return NextResponse.json(lista);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al obtener lista', details: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const data = listaPrecioUpdateSchema.parse(body);
    const userId = req.headers.get('x-user-id') || undefined;

    const existing = await prisma.listaPrecio.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lista de precio no encontrada' }, { status: 404 });
    }

    const cleanCodigo = data.codigo.trim().toUpperCase().replace(/\s+/g, '_');
    if (cleanCodigo !== existing.codigo) {
      const duplicate = await prisma.listaPrecio.findUnique({ where: { codigo: cleanCodigo } });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ error: `El código "${cleanCodigo}" ya está en uso` }, { status: 400 });
      }
    }

    const updated = await prisma.listaPrecio.update({
      where: { id },
      data: {
        nombre: data.nombre.trim(),
        codigo: cleanCodigo,
        descripcion: data.descripcion || null,
        tipoAjuste: data.tipoAjuste,
        valorAjuste: data.valorAjuste,
        listaBaseId: data.listaBaseId || null,
        aplicaA: data.aplicaA,
        familiaId: data.aplicaA === 'FAMILIA' ? data.familiaId || null : null,
        marcaId: data.aplicaA === 'MARCA' ? data.marcaId || null : null,
        orden: data.orden,
      },
    });

    let sincronizadosCount = 0;
    if (data.sincronizarProductos && data.tipoAjuste !== 'MANUAL') {
      sincronizadosCount = await recalcularPreciosParaLista(id, userId);
    }

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_LISTA_PRECIO',
      entityId: id,
      oldValue: { nombre: existing.nombre, tipoAjuste: existing.tipoAjuste },
      newValue: { nombre: updated.nombre, tipoAjuste: updated.tipoAjuste, sincronizados: sincronizadosCount },
    });

    return NextResponse.json({
      ...updated,
      sincronizados: sincronizadosCount,
    });
  } catch (error: any) {
    console.error('Error updating lista de precio:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar lista' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = req.headers.get('x-user-id') || undefined;

    const existing = await prisma.listaPrecio.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
    }

    await prisma.listaPrecio.update({
      where: { id },
      data: { activo: false },
    });

    await logAudit({
      userId,
      action: 'DELETE',
      entity: 'VENTAS_LISTA_PRECIO',
      entityId: id,
      oldValue: { codigo: existing.codigo, nombre: existing.nombre },
    });

    return NextResponse.json({ success: true, message: 'Lista de precios desactivada correctamente' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al eliminar lista', details: error.message }, { status: 500 });
  }
}
