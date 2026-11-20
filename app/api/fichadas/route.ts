import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    try {
        const { searchParams } = new URL(req.url);
        // Sin "fichadas.monitorear", solo las fichadas propias (se ignora ?operatorId).
        const operatorId = acceso.puede('fichadas.monitorear') ? searchParams.get('operatorId') : acceso.userId;
        const projectId = searchParams.get('projectId');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const openOnly = searchParams.get('openOnly') === 'true';

        let where: any = {};

        if (operatorId) where.operatorId = operatorId;
        
        if (projectId) {
            if (projectId === 'null') {
                where.projectId = null;
            } else {
                where.projectId = projectId;
            }
        }

        if (from && to) {
            where.fecha = {
                gte: from,
                lte: to
            };
        } else if (from) {
            where.fecha = { gte: from };
        }

        if (openOnly) {
            where.horaEgreso = null;
        }

        const entries = await prisma.fichada.findMany({
            where,
            include: {
                operator: { select: { nombreCompleto: true } },
                project: { select: { nombre: true, cliente: true, codigoProyecto: true } }
            },
            orderBy: [
                { fecha: 'desc' },
                { horaIngreso: 'desc' }
            ]
        });

        return NextResponse.json(entries);
    } catch (error: any) {
        console.error("Error GET fichadas", error);
        return NextResponse.json({ error: error?.message || 'Error fetching' }, { status: 500 });
    }
}
