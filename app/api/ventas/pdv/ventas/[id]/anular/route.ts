import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { anularVentaPDV } from '@/lib/ventas/pdvService';

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

    const userId = req.headers.get('x-user-id') || '';
    const userRole = req.headers.get('x-user-role') || '';

    // Si viene con supervisorPin (en caso de que el cajero/operador no sea supervisor pero un supervisor ingresa su PIN)
    let finalUserId = userId;
    let finalUserName = undefined;
    let finalUserRole = userRole;

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
          { error: 'PIN de supervisor inválido o sin permisos para anular ventas' },
          { status: 403 }
        );
      }
      finalUserId = supervisor.id;
      finalUserName = supervisor.nombreCompleto;
      finalUserRole = supervisor.role;
    }

    const ventaAnulada = await anularVentaPDV(
      id,
      motivo,
      finalUserId,
      finalUserName,
      finalUserRole
    );

    return NextResponse.json({
      success: true,
      venta: ventaAnulada,
      message: `La venta ${ventaAnulada.numero} fue anulada correctamente`,
    });
  } catch (error: any) {
    console.error('Error al anular venta:', error);
    return NextResponse.json(
      { error: error.message || 'Error al anular la venta' },
      { status: 400 }
    );
  }
}
