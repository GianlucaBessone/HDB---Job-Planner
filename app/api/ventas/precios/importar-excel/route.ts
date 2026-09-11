import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const importarExcelSchema = z.object({
  filas: z.array(
    z.object({
      filaNumero: z.number(),
      sku: z.string(),
      porcentaje: z.number(),
    })
  ).min(1, 'El archivo no contiene filas válidas para procesar'),
  listas: z.array(z.string()).optional().default([]),
  confirmar: z.boolean().default(false),
  nombreArchivo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filas, confirmar, nombreArchivo } = importarExcelSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;

    // Collect all SKUs from input
    const skusFromInput = Array.from(new Set(filas.map((f) => f.sku.trim()))).filter(Boolean);

    // Fetch products from database
    const dbProductos = await prisma.producto.findMany({
      where: { sku: { in: skusFromInput, mode: 'insensitive' }, activo: true },
      select: {
        id: true,
        sku: true,
        descripcion: true,
        precioBase: true,
      },
    });

    const dbMap = new Map<string, typeof dbProductos[0]>();
    for (const p of dbProductos) {
      dbMap.set(p.sku.toLowerCase(), p);
    }

    // Validation buckets
    const correctos: Array<{
      filaNumero: number;
      sku: string;
      productoId: string;
      descripcion: string;
      porcentaje: number;
      precioActual: number;
      nuevoPrecio: number;
      precios: Array<{
        listaCodigo: string;
        listaNombre: string;
        precioActual: number;
        nuevoPrecio: number;
      }>;
    }> = [];

    const noEncontrados: Array<{ filaNumero: number; sku: string; motivo: string }> = [];
    const errores: Array<{ filaNumero: number; sku: string; motivo: string }> = [];

    const seenSkus = new Set<string>();

    for (const f of filas) {
      const cleanSku = (f.sku || '').trim();
      const lowerSku = cleanSku.toLowerCase();

      // Check format
      if (!cleanSku) {
        errores.push({ filaNumero: f.filaNumero, sku: '(vacío)', motivo: 'SKU en blanco' });
        continue;
      }

      if (isNaN(f.porcentaje) || typeof f.porcentaje !== 'number') {
        errores.push({ filaNumero: f.filaNumero, sku: cleanSku, motivo: 'Porcentaje inválido o no numérico' });
        continue;
      }

      // Check duplicates in file
      if (seenSkus.has(lowerSku)) {
        errores.push({ filaNumero: f.filaNumero, sku: cleanSku, motivo: 'SKU duplicado en el mismo archivo' });
        continue;
      }
      seenSkus.add(lowerSku);

      // Check existence in DB
      const prod = dbMap.get(lowerSku);
      if (!prod) {
        noEncontrados.push({ filaNumero: f.filaNumero, sku: cleanSku, motivo: 'SKU no existe en la base de datos' });
        continue;
      }

      // Calculate new base price
      const factor = 1 + f.porcentaje / 100;
      const precioActual = prod.precioBase ?? 0;
      const nuevoPrecio = Math.max(0, Math.round(precioActual * factor * 100) / 100);

      correctos.push({
        filaNumero: f.filaNumero,
        sku: prod.sku,
        productoId: prod.id,
        descripcion: prod.descripcion,
        porcentaje: f.porcentaje,
        precioActual,
        nuevoPrecio,
        precios: [{
          listaCodigo: 'PRECIO_BASE',
          listaNombre: 'Precio Base de Venta',
          precioActual,
          nuevoPrecio,
        }],
      });
    }

    const resumen = {
      totalFilas: filas.length,
      correctos: correctos.length,
      noEncontrados: noEncontrados.length,
      errores: errores.length,
    };

    // If NOT confirmed: Return validation report & preview
    if (!confirmar) {
      return NextResponse.json({
        resumen,
        errores,
        noEncontrados,
        previsualizacion: correctos.slice(0, 300), // Preview up to 300 items
      });
    }

    // If CONFIRMED: Execute updates in transaction
    if (correctos.length === 0) {
      return NextResponse.json(
        { error: 'No hay registros válidos para aplicar' },
        { status: 400 }
      );
    }

    const totalModificados = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const item of correctos) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { precioBase: item.nuevoPrecio },
        });

        await tx.productoHistorial.create({
          data: {
            productoId: item.productoId,
            tipo: 'IMPORTACION_EXCEL',
            campo: 'precioBase',
            valorAnterior: String(item.precioActual),
            valorNuevo: String(item.nuevoPrecio),
            origen: 'IMPORTACION_EXCEL',
            detalles: {
              porcentaje: item.porcentaje,
              archivo: nombreArchivo || 'importacion.xlsx',
            },
            usuarioId: userId,
          },
        });

        count++;
      }

      return count;
    });

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_PRECIOS_IMPORTACION_EXCEL',
      metadata: {
        nombreArchivo,
        resumen,
        preciosActualizados: totalModificados,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Importación aplicada con éxito: ${correctos.length} productos modificados (${totalModificados} precios actualizados).`,
      resumen,
      preciosActualizados: totalModificados,
    });
  } catch (error: any) {
    console.error('Error importando ajuste desde Excel:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar archivo Excel' },
      { status: 500 }
    );
  }
}
