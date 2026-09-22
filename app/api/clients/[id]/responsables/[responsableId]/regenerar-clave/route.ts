import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInitialPassword, hashPassword } from '@/lib/portalAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; responsableId: string } }
) {
  try {
    const { id: clientId, responsableId } = params;

    const responsable = await prisma.clientResponsable.findFirst({
      where: { id: responsableId, clientId },
    });

    if (!responsable) {
      return NextResponse.json({ error: 'Responsable no encontrado para este cliente' }, { status: 404 });
    }

    const initialPassword = generateInitialPassword(8);
    const passwordHash = await hashPassword(initialPassword);

    await prisma.clientResponsable.update({
      where: { id: responsableId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'UPDATE',
      entity: 'CLIENT_RESPONSABLE_PASSWORD_RESET',
      entityId: responsableId,
      metadata: { clientId, responsableNombre: responsable.nombre },
    });

    return NextResponse.json({
      success: true,
      initialPassword, // Shown to admin
    });
  } catch (error: any) {
    console.error('Error regenerating password:', error);
    return NextResponse.json({ error: error.message || 'Error al regenerar contraseña' }, { status: 500 });
  }
}
