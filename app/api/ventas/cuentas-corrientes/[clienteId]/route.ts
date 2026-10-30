import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  obtenerDetalleCuentaCorrienteCliente,
  actualizarConfiguracionCC,
} from '@/lib/ventas/cuentaCorrienteService';

const configSchema = z.object({
  limiteCredito: z.coerce.number().min(0).default(0),
  plazoDias: z.coerce.number().min(0).max(365).default(30),
  estadoCredito: z.enum(['ACTIVO', 'OBSERVADO', 'SUSPENDIDO']).default('ACTIVO'),
  observaciones: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ clienteId: string }> }
) {
  const params = await paramsPromise;
  try {
    const { clienteId } = params;
    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;

    const data = await obtenerDetalleCuentaCorrienteCliente(clienteId, {
      fechaDesde,
      fechaHasta,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en GET /api/ventas/cuentas-corrientes/[clienteId]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener detalle de cuenta corriente' },
      { status: 400 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ clienteId: string }> }
) {
  const params = await paramsPromise;
  try {
    const { clienteId } = params;
    const body = await req.json();
    const parsed = configSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;
    const userName = req.headers.get('x-user-name') || undefined;

    const config = await actualizarConfiguracionCC(clienteId, parsed, userId, userName);
    return NextResponse.json({
      success: true,
      config,
      message: 'Configuración crediticia actualizada',
    });
  } catch (error: any) {
    console.error('Error en PUT /api/ventas/cuentas-corrientes/[clienteId]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar configuración de crédito' },
      { status: 400 }
    );
  }
}
