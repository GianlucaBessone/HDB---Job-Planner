import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, hashPassword, createPortalSession, PORTAL_COOKIE_NAME } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { responsibleId, password } = body;

    if (!responsibleId || !password) {
      return NextResponse.json({ error: 'Responsable y clave son requeridos' }, { status: 400 });
    }

    const responsable = await prisma.clientResponsable.findUnique({
      where: { id: responsibleId },
      include: {
        client: { select: { id: true, nombre: true, activo: true } },
      },
    });

    if (!responsable || !responsable.activo || !responsable.portalHabilitado || !responsable.client.activo) {
      return NextResponse.json({ error: 'Responsable no autorizado o inactivo' }, { status: 401 });
    }

    if (!responsable.passwordHash) {
      if (password && password.trim().length >= 6) {
        const initialHash = await hashPassword(password.trim());
        await prisma.clientResponsable.update({
          where: { id: responsable.id },
          data: {
            passwordHash: initialHash,
            mustChangePassword: false,
          },
        });
        responsable.passwordHash = initialHash;
        responsable.mustChangePassword = false;
      } else {
        return NextResponse.json(
          { error: 'Para el primer acceso, configure su nueva contraseña (mínimo 6 caracteres).' },
          { status: 400 }
        );
      }
    } else {
      const isValid = await verifyPassword(password, responsable.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });
      }
    }

    const sessionPayload = {
      responsibleId: responsable.id,
      clientId: responsable.clientId,
      clientNombre: responsable.client.nombre,
      nombre: responsable.nombre,
      mustChangePassword: responsable.mustChangePassword,
    };

    const token = await createPortalSession(sessionPayload);

    const response = NextResponse.json({
      success: true,
      mustChangePassword: responsable.mustChangePassword,
      responsable: {
        id: responsable.id,
        nombre: responsable.nombre,
        cargo: responsable.cargo,
        clientId: responsable.clientId,
        clientNombre: responsable.client.nombre,
      },
    });

    response.cookies.set(PORTAL_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Error in portal login:', error);
    return NextResponse.json({ error: error.message || 'Error en autenticación' }, { status: 500 });
  }
}
