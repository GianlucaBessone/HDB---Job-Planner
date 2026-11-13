import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { anularMovimientoCC } from '@/lib/ventas/cuentaCorrienteService';
import { puede } from '@/lib/permisosServer';

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

    let userId = req.headers.get('x-user-id') || '';
    let userName = req.headers.get('x-user-name') || undefined;

    if (supervisorPin) {
      const { prisma } = await import('@/lib/prisma');
      const candidates = await prisma.operator.findMany({
        where: {
          activo: true,
        },
      });
      const pinClean = supervisorPin.trim();
      const supervisor = candidates.find((op) => {
        const opRole = (op.role || '').toLowerCase();
        if (!['admin', 'administrador', 'supervisor'].includes(opRole)) return false;
        if (!op.pin) return false;
        if (op.pin.startsWith('$2')) {
          return bcrypt.compareSync(pinClean, op.pin);
        }
        return op.pin === pinClean;
      });
      if (!supervisor) {
        return NextResponse.json(
          { error: 'PIN de supervisor inválido o sin permisos para anular comprobantes' },
          { status: 403 }
        );
      }
      userId = supervisor.id;
      userName = supervisor.nombreCompleto;
    } else if (!(await puede(req, 'ventas.anular_comprobante_cc'))) {
      return NextResponse.json(
        { error: 'No tenés permiso para anular comprobantes. Ingresá el PIN de un Supervisor o Administrador.' },
        { status: 403 }
      );
    }

    const movimiento = await anularMovimientoCC(id, motivo, userId, userName);

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
