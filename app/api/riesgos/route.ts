import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['dashboard.ver'], 'No tenés permiso para ver el panel de análisis');
    if (acceso instanceof NextResponse) return acceso;

    try {
        const risks = await prisma.projectLog.findMany({
            where: {
                categoria: { in: ['Bloqueante', 'Reporte'] },
                project: {
                    estado: { notIn: ['finalizado', 'cancelado'] }
                }
            },
            include: {
                project: {
                    select: { id: true, nombre: true, codigoProyecto: true }
                },
                responsableRel: {
                    select: { nombreCompleto: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(risks);
    } catch (e) {
        console.error('Error fetching risks:', e);
        return NextResponse.json({ error: 'Failed to fetch risks' }, { status: 500 });
    }
}
