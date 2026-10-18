import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';
import { registrarCobranzaCC } from '@/lib/ventas/cuentaCorrienteService';

const medioPagoSchema = z.object({
  metodo: z.enum([
    'EFECTIVO',
    'TRANSFERENCIA',
    'CHEQUE',
    'TARJETA_DEBITO',
    'TARJETA_CREDITO',
    'OTRO',
  ]),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  referencia: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

const imputacionSchema = z.object({
  destinoTipo: z.enum(['VENTA', 'CARGO']),
  destinoId: z.string().min(1),
  monto: z.coerce.number().positive(),
});

const cobranzaSchema = z.object({
  clienteId: z.string().min(1, 'El cliente es obligatorio'),
  mediosPago: z.array(medioPagoSchema).min(1, 'Debe ingresar al menos un medio de pago'),
  modoImputacion: z.enum(['FIFO', 'MANUAL']).default('FIFO'),
  imputacionesManuales: z.array(imputacionSchema).optional(),
  concepto: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  operadorId: z.string().optional().nullable(),
  operadorNombre: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    try {
      const body = await req.json();
      const parsed = cobranzaSchema.parse(body);

      const userIdHeader = req.headers.get('x-user-id');
      const userNameHeader = req.headers.get('x-user-name');

      const recibo = await registrarCobranzaCC({
        ...parsed,
        operadorId: parsed.operadorId || userIdHeader || undefined,
        operadorNombre: parsed.operadorNombre || userNameHeader || undefined,
      });

      return NextResponse.json(
        {
          success: true,
          recibo,
          message: `Recibo ${recibo.numero} registrado correctamente`,
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Error al registrar cobranza CC:', error);
      return NextResponse.json(
        { error: error.message || 'Error al registrar cobranza' },
        { status: 400 }
      );
    }
  });
}
