import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, getAuthorizedProjectIds } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const responsable = await prisma.clientResponsable.findUnique({
      where: { id: session.responsibleId },
      include: {
        client: { select: { id: true, nombre: true, direccion: true, email: true, telefono: true } },
        proyectos: {
          include: {
            project: { select: { id: true, nombre: true, codigoProyecto: true, estado: true } },
          },
        },
      },
    });

    if (!responsable || !responsable.activo || !responsable.portalHabilitado) {
      return NextResponse.json({ error: 'Sesión no válida o revocada' }, { status: 401 });
    }

    return NextResponse.json({
      responsable: {
        id: responsable.id,
        nombre: responsable.nombre,
        cargo: responsable.cargo,
        email: responsable.email,
        mustChangePassword: responsable.mustChangePassword,
        cliente: responsable.client,
        proyectosAutorizados: responsable.proyectos.map((p) => p.project),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/portal-clientes/auth/me:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener sesión' }, { status: 500 });
  }
}
