import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcularTotalesVenta, resolverPrecioProducto } from '@/lib/ventas/pdvService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items = [], listaPrecioId, descuentoPorcentaje = 0, recargoPorcentaje = 0 } = body;

    let lista = null;
    if (listaPrecioId) {
      lista = await prisma.listaPrecio.findUnique({
        where: { id: listaPrecioId, activo: true },
      });
    }

    // Si los items no tienen precios actualizados o se cambió la lista de precios, recalcular
    const itemsConPrecio = await Promise.all(
      items.map(async (it: any) => {
        if (!it.precioModificado && it.productoId) {
          const prod = await prisma.producto.findUnique({
            where: { id: it.productoId },
            include: {
              iva: true,
              proveedores: { where: { esPrincipal: true }, take: 1, select: { costo: true } },
            },
          });

          if (prod) {
            const costo = prod.proveedores[0]?.costo ?? 0;
            const res = resolverPrecioProducto(
              {
                precioBase: prod.precioBase,
                costo,
                familiaId: prod.familiaId,
                marcaId: prod.marcaId,
              },
              lista
            );

            return {
              ...it,
              precioOriginal: res.precio,
              precioUnitario: res.precio,
              ivaPorcentaje: prod.iva?.porcentaje ?? it.ivaPorcentaje ?? 21,
            };
          }
        }
        return it;
      })
    );

    const calculo = calcularTotalesVenta(itemsConPrecio, descuentoPorcentaje, recargoPorcentaje);

    return NextResponse.json(calculo);
  } catch (error: any) {
    console.error('Error calculando venta PDV:', error);
    return NextResponse.json(
      { error: 'Error al calcular totales de venta', details: error.message },
      { status: 500 }
    );
  }
}
