import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, hashPassword, verifyPassword, createPortalSession, PORTAL_COOKIE_NAME } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { claveActual, claveNueva } = body;

    if (!claveNueva || claveNueva.length < 6) {
      return NextResponse.json({ error: 'La nueva clave debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const responsable = await prisma.clientResponsable.findUnique({
      where: { id: session.responsibleId },
    });

    if (!responsable) return NextResponse.json({ error: 'Responsable no encontrado' }, { status: 404 });

    // If changing password from first access or profile, optionally check claveActual if passed
    if (claveActual && responsable.passwordHash) {
      const isValid = await verifyPassword(claveActual, responsable.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'La clave actual no es correcta' }, { status: 400 });
      }
    }

    const newHash = await hashPassword(claveNueva);

    await prisma.clientResponsable.update({
      where: { id: session.responsibleId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    // Refresh token with mustChangePassword = false
    const refreshedToken = await createPortalSession({
      ...session,
      mustChangePassword: false,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Clave actualizada exitosamente',
    });

    response.cookies.set(PORTAL_COOKIE_NAME, refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Error changing portal password:', error);
    return NextResponse.json({ error: error.message || 'Error al cambiar contraseña' }, { status: 500 });
  }
}
