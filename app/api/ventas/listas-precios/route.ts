import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const listaPrecioCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la lista es obligatorio'),
  codigo: z.string().min(1, 'El código identificador es obligatorio'),
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

export async function GET() {
  try {
    const listas = await prisma.listaPrecio.findMany({
      where: { activo: true },
      include: {
        listaBase: { select: { id: true, codigo: true, nombre: true } },
        familia: { select: { id: true, nombre: true } },
        marca: { select: { id: true, nombre: true } },
      },
      orderBy: { orden: 'asc' },
    });

    return NextResponse.json(listas);
  } catch (error: any) {
    console.error('Error fetching listas de precios:', error);
    return NextResponse.json({ error: 'Error al listar listas de precios', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = listaPrecioCreateSchema.parse(body);
    const userId = req.headers.get('x-user-id') || undefined;

    // Check duplicate code
    const cleanCodigo = data.codigo.trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await prisma.listaPrecio.findUnique({
      where: { codigo: cleanCodigo },
    });

    if (existing) {
      if (!existing.activo) {
        // Reactivate soft-deleted list
        const reactivated = await prisma.listaPrecio.update({
          where: { id: existing.id },
          data: {
            activo: true,
            nombre: data.nombre.trim(),
            descripcion: data.descripcion || null,
            tipoAjuste: data.tipoAjuste,
            valorAjuste: data.valorAjuste,
            listaBaseId: data.listaBaseId || null,
            aplicaA: data.aplicaA,
            familiaId: data.familiaId || null,
            marcaId: data.marcaId || null,
          },
        });
        return NextResponse.json(reactivated);
      }
      return NextResponse.json(
        { error: `Ya existe una lista de precios con el código "${cleanCodigo}"` },
        { status: 400 }
      );
    }

    const nuevaLista = await prisma.listaPrecio.create({
      data: {
        codigo: cleanCodigo,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion || null,
        tipoAjuste: data.tipoAjuste,
        valorAjuste: data.valorAjuste,
        listaBaseId: data.listaBaseId || null,
        aplicaA: data.aplicaA,
        familiaId: data.aplicaA === 'FAMILIA' ? data.familiaId || null : null,
        marcaId: data.aplicaA === 'MARCA' ? data.marcaId || null : null,
        orden: data.orden,
        activo: true,
      },
    });

    // If synchronization with existing products requested & has rule
    let sincronizadosCount = 0;
    if (data.sincronizarProductos && data.tipoAjuste !== 'MANUAL') {
      sincronizadosCount = await recalcularPreciosParaLista(nuevaLista.id, userId);
    }

    await logAudit({
      userId,
      action: 'CREATE',
      entity: 'VENTAS_LISTA_PRECIO',
      entityId: nuevaLista.id,
      newValue: {
        codigo: nuevaLista.codigo,
        nombre: nuevaLista.nombre,
        tipoAjuste: nuevaLista.tipoAjuste,
        valorAjuste: nuevaLista.valorAjuste,
        sincronizados: sincronizadosCount,
      },
    });

    return NextResponse.json({
      ...nuevaLista,
      sincronizados: sincronizadosCount,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lista de precio:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear lista de precio' },
      { status: 500 }
    );
  }
}

/**
 * Función auxiliar para validar productos aplicables según la regla de la lista
 */
export async function recalcularPreciosParaLista(listaId: string, userId?: string): Promise<number> {
  const lista = await prisma.listaPrecio.findUnique({
    where: { id: listaId },
  });
  if (!lista || lista.tipoAjuste === 'MANUAL') return 0;

  // Build filter for applicable products
  const where: any = { activo: true };
  if (lista.aplicaA === 'FAMILIA' && lista.familiaId) {
    where.familiaId = lista.familiaId;
  } else if (lista.aplicaA === 'MARCA' && lista.marcaId) {
    where.marcaId = lista.marcaId;
  }

  const count = await prisma.producto.count({ where });
  return count;
}
