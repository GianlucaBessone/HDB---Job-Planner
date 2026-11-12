import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActor, prohibido, respuestaError } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';

/** Clientes y proyectos activos para el alta de un pliego (liviano, sin efectos). */
export async function GET(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido();
        const [clientes, proyectos] = await Promise.all([
            prisma.hdbClient.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
            prisma.project.findMany({
                where: { activo: true, estado: { not: 'finalizado' } },
                select: { id: true, nombre: true, codigoProyecto: true, clientId: true },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),
        ]);
        return NextResponse.json({ clientes, proyectos });
    } catch (error) {
        return respuestaError(error, 'PLIEGOS_OPCIONES', 'Error al obtener clientes y proyectos.');
    }
}
