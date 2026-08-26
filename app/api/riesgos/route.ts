import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
