import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

import { ULTIMO_BLOQUEANTE, proyectoConSalud } from '@/lib/proyectos/salud';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['dashboard.ver'], 'No tenés permiso para ver el panel de análisis');
    if (acceso instanceof NextResponse) return acceso;

    try {
        const [proyectos, operators, plannings, clientDelays, ordenesServicio] = await Promise.all([
            // Estado con "en riesgo" y "atrasado" calculados (P27)
            prisma.project.findMany({ include: { checklistItems: { select: { completed: true, excluded: true } }, logs: ULTIMO_BLOQUEANTE } }),
            prisma.operator.findMany(),
            prisma.planning.findMany(),
            prisma.clientDelay.findMany(),
            // Las OS anuladas no cuentan en las métricas.
            prisma.ordenServicio.findMany({
                where: { estado: { not: 'anulada' } },
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

        const projects = proyectos.map(({ checklistItems, ...p }) => {
            const { ultimoBloqueante, ...conEstado } = proyectoConSalud({ ...p, checklistItems });
            return conEstado;
        });

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
