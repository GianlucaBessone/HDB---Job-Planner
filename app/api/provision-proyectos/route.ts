import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado
export async function GET() {
    try {
        const proyectos = await prisma.project.findMany({
            where: {
                aprovisionamiento: true,
                estado: { not: 'finalizado' },
            },
            include: {
                client: { select: { nombre: true } },
                responsableUser: { select: { nombreCompleto: true } },
                materialesProyecto: {
                    include: {
                        usos: { orderBy: { createdAt: 'desc' } },
                        devolucion: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
                ordenesServicio: {
                    select: {
                        id: true,
                        cobroGenerado: true,
                        estado: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(proyectos);
    } catch (error: any) {
        console.error('Provision GET Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
