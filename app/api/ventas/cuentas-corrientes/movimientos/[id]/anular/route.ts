import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { anularMovimientoCC } from '@/lib/ventas/cuentaCorrienteService';

const anularSchema = z.object({
  motivo: z.string().min(3, 'El motivo debe tener al menos 3 caracteres'),
  supervisorPin: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { motivo, supervisorPin } = anularSchema.parse(body);

    let userId = req.headers.get('x-user-id') || '';
    let userName = req.headers.get('x-user-name') || undefined;
    let userRole = (req.headers.get('x-user-role') || '').toLowerCase();

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
      userRole = supervisor.role.toLowerCase();
    } else if (!['admin', 'administrador', 'supervisor'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Se requiere rol de Supervisor o Administrador (o PIN válido) para anular un comprobante' },
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
