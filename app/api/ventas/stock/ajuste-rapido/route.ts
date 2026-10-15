import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const stockAjusteSchema = z.object({
  productoId: z.string(),
  almacenId: z.string().optional(),
  nuevoStock: z.coerce.number().min(0, 'El stock no puede ser negativo'),
  tipo: z.enum(['AJUSTE', 'CONTEO', 'CORRECCION']).default('AJUSTE'),
  motivo: z.string().min(1, 'Debe indicar un motivo o justificación para el ajuste de stock'),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de permisos SGI
    const auth = verificarPermisoInventario(req, 'ajustar_stock');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = stockAjusteSchema.parse(body);

    const idempotencyHeader = req.headers.get('x-idempotency-key') || data.idempotencyKey;

    // 2. Ejecutar mediante el servicio centralizado con bloqueo pesimista y numeración
    const result = await StockService.registrarAjuste({
      almacenId: data.almacenId || (await getDefaultWarehouseId()),
      modoAjuste: 'EXISTENCIA_REAL',
      motivoGeneral: data.motivo,
      items: [
        {
          productoId: data.productoId,
          cantidad: data.nuevoStock,
          motivo: data.motivo,
        },
      ],
      usuarioId: auth.usuario?.id,
      userRole: auth.usuario?.role,
      idempotencyKey: idempotencyHeader,
    });

    const mov = result.movimientos?.[0];

    return NextResponse.json({
      success: true,
      operacion: result.operacion,
      stockActual: mov ? mov.stockPosterior : data.nuevoStock,
      stockAnterior: mov ? mov.stockAnterior : data.nuevoStock,
      mensaje: result.mensaje,
      esReintento: result.esReintento,
    });
  } catch (error: any) {
    console.error('Error ajustando stock:', error);
    return NextResponse.json(
      { error: error.message || 'Error al ajustar stock' },
      { status: 500 }
    );
  }
}

async function getDefaultWarehouseId(): Promise<string> {
  const { prisma } = await import('@/lib/prisma');
  const alm =
    (await prisma.almacen.findFirst({ where: { esPredeterminado: true, activo: true } })) ||
    (await prisma.almacen.findFirst({ where: { activo: true } }));
  if (!alm) throw new Error('No se encontró ningún almacén activo configurado');
  return alm.id;
}
