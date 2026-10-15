import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const conteoProgresoSchema = z.object({
  items: z.array(
    z.object({
      productoId: z.string(),
      cantidadContada: z.coerce.number(),
      observaciones: z.string().optional(),
    })
  ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_stock');
    if (auth.error) return auth.error;

    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: params.id },
      include: {
        almacen: { select: { id: true, nombre: true, codigo: true } },
        ubicacion: { select: { id: true, codigo: true, nombre: true } },
        operacion: { select: { id: true, numero: true } },
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                sku: true,
                codigoBarras: true,
                descripcion: true,
                unidad: { select: { codigo: true, decimales: true } },
              },
            },
            ubicacion: { select: { id: true, codigo: true } },
          },
          orderBy: { producto: { sku: 'asc' } },
        },
      },
    });

    if (!conteo) {
      return NextResponse.json({ error: 'Conteo no encontrado' }, { status: 404 });
    }

    // Calcular estadísticas
    let totalItems = conteo.detalles.length;
    let contados = 0;
    let conDiferencias = 0;
    let unidadesSobrantes = 0;
    let unidadesFaltantes = 0;

    const itemsFormatted = conteo.detalles.map((d) => {
      const isContado = d.cantidadContada !== null;
      if (isContado) contados++;

      const dif = d.diferencia ?? 0;
      if (isContado && dif !== 0) {
        conDiferencias++;
        if (dif > 0) unidadesSobrantes += dif;
        else unidadesFaltantes += Math.abs(dif);
      }

      return {
        id: d.id,
        productoId: d.productoId,
        sku: d.producto.sku,
        codigoBarras: d.producto.codigoBarras,
        descripcion: d.producto.descripcion,
        unidad: d.producto.unidad?.codigo || 'UN',
        unidadDecimales: d.producto.unidad?.decimales ?? 0,
        ubicacionCodigo: d.ubicacion?.codigo || null,
        stockTeorico: d.stockTeorico,
        cantidadContada: d.cantidadContada,
        diferencia: d.diferencia,
        estado: d.estado,
        observaciones: d.observaciones,
      };
    });

    return NextResponse.json({
      conteo: {
        id: conteo.id,
        numero: conteo.numero,
        almacenId: conteo.almacenId,
        almacenNombre: conteo.almacen.nombre,
        almacenCodigo: conteo.almacen.codigo,
        ubicacionCodigo: conteo.ubicacion?.codigo || null,
        tipo: conteo.tipo,
        estado: conteo.estado,
        observaciones: conteo.observaciones,
        acumularEscaneos: conteo.acumularEscaneos,
        creadoPorNombre: conteo.creadoPorNombre,
        iniciadoEn: conteo.iniciadoEn,
        finalizadoEn: conteo.finalizadoEn,
        revisadoPorNombre: conteo.revisadoPorNombre,
        revisadoEn: conteo.revisadoEn,
        confirmadoPorNombre: conteo.confirmadoPorNombre,
        confirmadoEn: conteo.confirmadoEn,
        operacionNumero: conteo.operacion?.numero || null,
        estadisticas: {
          totalItems,
          contados,
          pendientes: totalItems - contados,
          conDiferencias,
          unidadesSobrantes,
          unidadesFaltantes,
          porcentajeAvance: totalItems > 0 ? Math.round((contados / totalItems) * 100) : 0,
        },
      },
      items: itemsFormatted,
    });
  } catch (error: any) {
    console.error('Error obteniendo detalle de conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener detalle de conteo' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'conteos_contar');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = conteoProgresoSchema.parse(body);

    const result = await StockService.guardarProgresoConteo({
      conteoId: params.id,
      items: data.items,
      usuarioId: auth.usuario?.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error guardando progreso de conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al guardar progreso' },
      { status: 500 }
    );
  }
}
