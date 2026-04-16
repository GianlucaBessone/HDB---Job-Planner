import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const clientId = searchParams.get('clientId');
    const proyectoId = searchParams.get('proyectoId');
    const operadorId = searchParams.get('operadorId');

    try {
        // Build date filters
        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from + 'T00:00:00');
        if (to) dateFilter.lte = new Date(to + 'T23:59:59');

        // Build encuesta where
        const where: any = {};
        if (Object.keys(dateFilter).length > 0) where.fecha = dateFilter;
        if (proyectoId) where.proyectoId = proyectoId;

        // Client filter: need to join through project
        if (clientId) {
            where.project = { clientId };
        }

        // Operator filter: need to join through OS → operadores
        if (operadorId) {
            where.ordenServicio = { operadores: { some: { operadorId } } };
        }

        const encuestas = await prisma.encuestaServicio.findMany({
            where,
            include: {
                ordenServicio: {
                    select: {
                        id: true,
                        fechaCreacion: true,
                        operadores: { select: { operadorId: true, operador: { select: { id: true, nombreCompleto: true } } } },
                        project: { select: { id: true, nombre: true, clientId: true, client: { select: { nombre: true } } } }
                    }
                }
            },
            orderBy: { fecha: 'asc' }
        });

        const total = encuestas.length;

        if (total === 0) {
            return NextResponse.json({
                total: 0,
                nps: { score: null, promotores: 0, pasivos: 0, detractores: 0, pctPromo: 0, pctDetrac: 0, pctPasivos: 0 },
                promedios: { atencion: null, calidad: null, tiempo: null },
                porMes: [],
                porOperador: [],
            });
        }

        // Global averages
        const sum = encuestas.reduce((acc, e) => ({
            atencion: acc.atencion + e.atencion,
            calidad: acc.calidad + e.calidad,
            tiempo: acc.tiempo + e.tiempo,
            nps: acc.nps + e.nps,
        }), { atencion: 0, calidad: 0, tiempo: 0, nps: 0 });

        const promedios = {
            atencion: Math.round((sum.atencion / total) * 10) / 10,
            calidad: Math.round((sum.calidad / total) * 10) / 10,
            tiempo: Math.round((sum.tiempo / total) * 10) / 10,
        };

        // NPS calculation
        const promotores = encuestas.filter(e => e.nps >= 9).length;
        const pasivos = encuestas.filter(e => e.nps >= 7 && e.nps <= 8).length;
        const detractores = encuestas.filter(e => e.nps <= 6).length;
        const pctPromo = Math.round((promotores / total) * 100);
        const pctDetrac = Math.round((detractores / total) * 100);
        const pctPasivos = 100 - pctPromo - pctDetrac;
        const npsScore = pctPromo - pctDetrac;

        const nps = { score: npsScore, promotores, pasivos, detractores, pctPromo, pctDetrac, pctPasivos };

        // By month
        const monthMap = new Map<string, { atencion: number[]; calidad: number[]; tiempo: number[]; nps: number[] }>();
        for (const e of encuestas) {
            const d = new Date(e.fecha);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap.has(key)) monthMap.set(key, { atencion: [], calidad: [], tiempo: [], nps: [] });
            const m = monthMap.get(key)!;
            m.atencion.push(e.atencion);
            m.calidad.push(e.calidad);
            m.tiempo.push(e.tiempo);
            m.nps.push(e.nps);
        }
        const porMes = Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, vals]) => {
                const cnt = vals.nps.length;
                const prom = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
                const promo = vals.nps.filter(n => n >= 9).length;
                const detrac = vals.nps.filter(n => n <= 6).length;
                return {
                    label,
                    atencion: prom(vals.atencion),
                    calidad: prom(vals.calidad),
                    tiempo: prom(vals.tiempo),
                    nps: Math.round((promo / cnt) * 100) - Math.round((detrac / cnt) * 100),
                    count: cnt,
                };
            });

        // By operator: collect all operators that participated in OS with encuesta
        const opMap = new Map<string, { name: string; atencion: number[]; calidad: number[]; tiempo: number[]; nps: number[] }>();
        for (const e of encuestas) {
            for (const opRel of e.ordenServicio.operadores) {
                const opId = opRel.operadorId;
                const opName = opRel.operador.nombreCompleto;
                if (!opMap.has(opId)) opMap.set(opId, { name: opName, atencion: [], calidad: [], tiempo: [], nps: [] });
                const op = opMap.get(opId)!;
                op.atencion.push(e.atencion);
                op.calidad.push(e.calidad);
                op.tiempo.push(e.tiempo);
                op.nps.push(e.nps);
            }
        }
        const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
        const porOperador = Array.from(opMap.entries()).map(([id, data]) => {
            const cnt = data.nps.length;
            const prom2 = data.nps.filter(n => n >= 9).length;
            const detrac2 = data.nps.filter(n => n <= 6).length;
            return {
                id,
                nombre: data.name,
                atencion: avg(data.atencion),
                calidad: avg(data.calidad),
                tiempo: avg(data.tiempo),
                nps: cnt > 0 ? Math.round((prom2 / cnt) * 100) - Math.round((detrac2 / cnt) * 100) : null,
                count: cnt,
            };
        }).sort((a, b) => (b.atencion ?? 0) - (a.atencion ?? 0));

        return NextResponse.json({ total, nps, promedios, porMes, porOperador });
    } catch (e) {
        console.error('GET metricas-servicio error:', e);
        return NextResponse.json({ error: 'Error al calcular métricas', details: String(e) }, { status: 500 });
    }
}
