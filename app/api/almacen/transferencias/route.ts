import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const transferenciaSchema = z.object({
  almacenOrigenId: z.string().min(1, 'El almacén de origen es obligatorio'),
  almacenDestinoId: z.string().min(1, 'El almacén de destino es obligatorio'),
  motivo: z.string().min(1, 'El motivo de transferencia es obligatorio'),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.coerce.number().gt(0, 'La cantidad debe ser mayor a 0'),
        ubicacionOrigenId: z.string().optional().nullable(),
        ubicacionDestinoId: z.string().optional().nullable(),
        observaciones: z.string().optional(),
      })
    )
    .min(1, 'Debe indicar al menos un producto a transferir'),
});

export async function POST(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'transferir_stock');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = transferenciaSchema.parse(body);

    const idempotencyHeader = req.headers.get('x-idempotency-key') || data.idempotencyKey;

    const result = await StockService.registrarTransferencia({
      almacenOrigenId: data.almacenOrigenId,
      almacenDestinoId: data.almacenDestinoId,
      motivo: data.motivo,
      observaciones: data.observaciones,
      items: data.items,
      usuarioId: auth.usuario?.id,
      usuarioNombre: auth.usuario?.nombreCompleto,
      userRole: auth.usuario?.role,
      idempotencyKey: idempotencyHeader,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al registrar transferencia:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar transferencia' },
      { status: 500 }
    );
  }
}
