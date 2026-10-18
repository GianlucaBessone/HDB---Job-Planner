import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';
import { registrarMovimientoManualCC } from '@/lib/ventas/cuentaCorrienteService';

const movimientoManualSchema = z.object({
  clienteId: z.string().min(1, 'El cliente es obligatorio'),
  tipo: z.enum(['SALDO_INICIAL', 'CARGO_MANUAL', 'NOTA_CREDITO']),
  sentidoSaldoInicial: z.enum(['DEBE', 'HABER']).optional(),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  concepto: z.string().min(3, 'El concepto debe tener al menos 3 caracteres'),
  fechaVencimiento: z.string().optional().nullable(),
  imputarFifo: z.boolean().optional().default(true),
  observaciones: z.string().optional().nullable(),
  operadorId: z.string().optional().nullable(),
  operadorNombre: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    try {
      const body = await req.json();
      const parsed = movimientoManualSchema.parse(body);

      const userIdHeader = req.headers.get('x-user-id');
      const userNameHeader = req.headers.get('x-user-name');

      const movimiento = await registrarMovimientoManualCC({
        ...parsed,
        operadorId: parsed.operadorId || userIdHeader || undefined,
        operadorNombre: parsed.operadorNombre || userNameHeader || undefined,
      });

      return NextResponse.json(
        {
          success: true,
          movimiento,
          message: `Comprobante ${movimiento.numero} registrado correctamente`,
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Error al registrar movimiento manual CC:', error);
      return NextResponse.json(
        { error: error.message || 'Error al registrar movimiento en cuenta corriente' },
        { status: 400 }
      );
    }
  });
}
