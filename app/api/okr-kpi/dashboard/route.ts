import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = await exigirAcceso(req, ['okr.ver', 'okr.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const okrs = await prisma.okr.findMany({
            where: { estado: { not: 'Cancelado' } },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpis: {
                    where: { estado: 'Activo' },
                    include: {
                        responsableCarga: { select: { id: true, nombreCompleto: true } },
                        dataset: true,
                        historico: {
                            orderBy: { fechaMedicion: 'desc' },
                            take: 20,
                        },
                        planesAccion: {
                            // Planes abiertos (tareas con KPI, P31)
                            where: { estado: { in: ['pendiente', 'en_progreso'] } },
                            select: { id: true, estado: true },
                        },
                        _count: { select: { historico: true, planesAccion: true } },
                    },
                    orderBy: { codigoKpi: 'asc' },
                },
            },
            orderBy: { codigoOkr: 'asc' },
        });

        // Summary stats
        const totalOkrs = okrs.length;
        const totalKpis = okrs.reduce((acc, okr) => acc + okr.kpis.length, 0);
        const kpisCumple = okrs.reduce((acc, okr) => acc + okr.kpis.filter(k => k.estadoCumplimiento === 'Cumple').length, 0);
        const kpisEnRiesgo = okrs.reduce((acc, okr) => acc + okr.kpis.filter(k => k.estadoCumplimiento === 'En Riesgo').length, 0);
        const kpisNoCumple = okrs.reduce((acc, okr) => acc + okr.kpis.filter(k => k.estadoCumplimiento === 'No Cumple').length, 0);
        const kpisSinDatos = totalKpis - kpisCumple - kpisEnRiesgo - kpisNoCumple;

        return NextResponse.json({
            okrs,
            resumen: {
                totalOkrs,
                totalKpis,
                kpisCumple,
                kpisEnRiesgo,
                kpisNoCumple,
                kpisSinDatos,
            },
        });
    } catch (error) {
        console.error('Error fetching dashboard estratégico:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
