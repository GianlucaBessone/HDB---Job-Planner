import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || searchParams.get('clienteId');

    const whereClause: any = {
      activo: true,
      portalHabilitado: true,
      client: { activo: true },
    };

    if (clientId) {
      whereClause.clientId = clientId;
    }

    const responsables = await prisma.clientResponsable.findMany({
      where: whereClause,
      select: {
        id: true,
        nombre: true,
        cargo: true,
        passwordHash: true,
        mustChangePassword: true,
        client: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: [
        { client: { nombre: 'asc' } },
        { nombre: 'asc' },
      ],
    });

    const sanitized = responsables.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cargo: r.cargo,
      hasPassword: Boolean(r.passwordHash),
      mustChangePassword: r.mustChangePassword,
      client: r.client,
    }));

    return NextResponse.json(sanitized);
  } catch (error: any) {
    console.error('Error fetching portal responsables:', error);
    return NextResponse.json({ error: 'Error al obtener lista de responsables' }, { status: 500 });
  }
}
