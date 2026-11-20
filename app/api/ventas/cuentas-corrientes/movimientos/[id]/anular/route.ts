import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { anularMovimientoCC } from '@/lib/ventas/cuentaCorrienteService';
import { exigirAcceso } from '@/lib/permisosServer';
import { autorizarConPin } from '@/lib/autorizacionSupervisor';

const anularSchema = z.object({
  motivo: z.string().min(3, 'El motivo debe tener al menos 3 caracteres'),
  supervisorPin: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const { id } = params;
    const body = await req.json();
    const { motivo, supervisorPin } = anularSchema.parse(body);

    // Quien pide sale de la sesión. Con PIN, la acción queda a nombre de quien autoriza,
    // que tiene que tener la función "ventas.anular_comprobante_cc" (por rol o permiso especial).
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    let autorId = acceso.userId;
    let autorNombre: string | undefined = acceso.nombre;

    if (supervisorPin) {
      const r = await autorizarConPin(supervisorPin, 'ventas.anular_comprobante_cc', acceso.userId);
      if (!r.autorizante) {
        return NextResponse.json(
          { error: r.bloqueado ? r.error : 'PIN de supervisor inválido o sin permisos para anular comprobantes' },
          { status: r.bloqueado ? 429 : 403 }
        );
      }
      autorId = r.autorizante.id;
      autorNombre = r.autorizante.nombre;
    } else if (!acceso.puede('ventas.anular_comprobante_cc')) {
      return NextResponse.json(
        { error: 'No tenés permiso para anular comprobantes. Ingresá el PIN de un Supervisor o Administrador.' },
        { status: 403 }
      );
    }

    const movimiento = await anularMovimientoCC(id, motivo, autorId, autorNombre);

    return NextResponse.json({
      success: true,
      movimiento,
      message: `Comprobante ${movimiento.numero} anulado correctamente`,
    });
  } catch (error: any) {
    console.error('Error al anular movimiento CC:', error);
    return NextResponse.json(
      { error: error.message || 'Error al anular comprobante' },
      { status: 400 }
    );
  }
}
