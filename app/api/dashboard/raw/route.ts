import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

import { dataLayer } from '@/lib/dataLayer';

export async function GET() {
    try {
        // Run the auto-update asynchronously so it doesn't block the dashboard load
        dataLayer.autoUpdateProjectStatuses().catch(e => console.error('Error auto-updating project statuses in dashboard raw api:', e));

        const [projects, operators, plannings, clientDelays, ordenesServicio] = await Promise.all([
            prisma.project.findMany(),
            prisma.operator.findMany(),
            prisma.planning.findMany(),
            prisma.clientDelay.findMany(),
            prisma.ordenServicio.findMany({
                include: {
                    materiales: true,
                    operadores: true,
                    firma: true,
                    project: {
                        select: {
                            clientId: true,
                            horasEstimadas: true,
                            estado: true,
                            codigoProyecto: true,
                            client: {
                                select: { nombre: true }
                            }
                        }
                    }
                }
            })
        ]);

        return NextResponse.json({
            projects,
            operators,
            plannings,
            clientDelays,
            ordenesServicio
        });
    } catch (error) {
        console.error('Error fetching raw dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
