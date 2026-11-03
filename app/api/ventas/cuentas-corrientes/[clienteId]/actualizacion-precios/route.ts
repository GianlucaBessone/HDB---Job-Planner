import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';
import {
  aplicarActualizacionDeuda,
  previsualizarActualizacionDeuda,
} from '@/lib/ventas/actualizacionDeudaService';

const aplicarSchema = z.object({
  ventaIds: z.array(z.string().min(1)).optional(),
  operadorNombre: z.string().optional().nullable(),
});

/** Vista previa de la actualización de deuda a precios vigentes. */
export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ clienteId: string }> }
) {
  const { clienteId } = await paramsPromise;
  try {
    const data = await previsualizarActualizacionDeuda(clienteId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en GET actualizacion-precios CC:', error);
    return NextResponse.json(
      { error: error.message || 'Error al calcular la actualización de deuda' },
      { status: 400 }
    );
  }
}

/** Emite las Notas de Débito por actualización de precios. */
export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ clienteId: string }> }
) {
  const { clienteId } = await paramsPromise;
  return withIdempotency(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = aplicarSchema.parse(body);

      const resultado = await aplicarActualizacionDeuda({
        clienteId,
        ventaIds: parsed.ventaIds,
        operadorId: req.headers.get('x-user-id'),
        operadorNombre: parsed.operadorNombre || req.headers.get('x-user-name'),
      });

      return NextResponse.json(
        {
          success: true,
          ...resultado,
          message:
            resultado.emitidas.length > 0
              ? `Se emitieron ${resultado.emitidas.length} nota(s) de débito por actualización de precios`
              : 'No hay diferencias para actualizar',
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Error en POST actualizacion-precios CC:', error);
      return NextResponse.json(
        { error: error.message || 'Error al actualizar la deuda a precios vigentes' },
        { status: 400 }
      );
    }
  });
}
