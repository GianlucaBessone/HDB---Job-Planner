import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const ajusteMultiSchema = z.object({
  almacenId: z.string().min(1, 'El almacén es obligatorio'),
  modoAjuste: z.enum(['DIFERENCIA', 'EXISTENCIA_REAL']),
  motivoGeneral: z.string().min(1, 'El motivo o justificación de auditoría es obligatorio'),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.coerce.number(),
        ubicacionId: z.string().optional().nullable(),
        motivo: z.string().optional(),
        observaciones: z.string().optional(),
      })
    )
    .min(1, 'Debe ingresar al menos una línea de producto'),
});

export async function POST(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'ajustar_stock');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = ajusteMultiSchema.parse(body);

    const idempotencyHeader = req.headers.get('x-idempotency-key') || data.idempotencyKey;

    const result = await StockService.registrarAjuste({
      almacenId: data.almacenId,
      modoAjuste: data.modoAjuste,
      motivoGeneral: data.motivoGeneral,
      observaciones: data.observaciones,
      items: data.items,
      usuarioId: auth.usuario?.id,
      usuarioNombre: auth.usuario?.nombreCompleto,
      userRole: auth.usuario?.role,
      idempotencyKey: idempotencyHeader,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al registrar ajuste rápido:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar ajuste de inventario' },
      { status: 500 }
    );
  }
}
