import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInitialPassword, hashPassword } from '@/lib/portalAuth';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string; responsableId: string }> }
) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['clientes.gestionar'], 'No tenés permiso para gestionar clientes');
    if (acceso instanceof NextResponse) return acceso;

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
      userId: acceso.userId,
      userName: acceso.nombre,
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
