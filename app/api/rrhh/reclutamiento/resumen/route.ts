import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    embudoPorVacante, getActorRRHH, nombresOperadores, permisosDe, POSTULANTE_LISTA_SELECT, prohibido, respuestaError,
    serializarPostulanteLista, totalesEmbudo,
} from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

const DIA = 86_400_000;
const PESO_PRIORIDAD: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

/** Indicadores del tablero de reclutamiento. */
export async function GET(req: NextRequest) {
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();

        const ahora = Date.now();
        const hace30 = new Date(ahora - 30 * DIA);
        const hace90 = new Date(ahora - 90 * DIA);

        const [vacantes, totalPostulantes, nuevos30, contratacionesRows, actividadRows, recientes] = await Promise.all([
            prisma.recruitmentVacancy.findMany({
                where: { status: { in: ['ABIERTA', 'PAUSADA'] } },
                select: { id: true, title: true, branch: true, status: true, priority: true, positionsCount: true, startDate: true, createdAt: true },
            }),
            prisma.candidate.count(),
            prisma.candidate.count({ where: { createdAt: { gte: hace30 } } }),
            prisma.candidateStageHistory.findMany({
                where: { stage: 'CONTRATADO', createdAt: { gte: hace90 } },
                select: { candidateId: true, vacancyId: true, createdAt: true },
            }),
            prisma.candidateStageHistory.findMany({
                orderBy: { createdAt: 'desc' },
                take: 12,
                select: {
                    id: true, stage: true, notes: true, createdAt: true, movedById: true,
                    candidate: { select: { id: true, firstName: true, lastName: true } },
                    vacancy: { select: { id: true, title: true } },
                },
            }),
            prisma.candidate.findMany({ select: POSTULANTE_LISTA_SELECT, orderBy: { createdAt: 'desc' }, take: 6 }),
        ]);

        // Embudo de las búsquedas en curso.
        const embudo = await embudoPorVacante(vacantes.map(v => v.id));
        const embudoGlobal: Record<string, number> = {};
        for (const conteo of Array.from(embudo.values())) {
            for (const [etapa, n] of Object.entries(conteo) as [string, number][]) embudoGlobal[etapa] = (embudoGlobal[etapa] || 0) + n;
        }

        // Tiempo de contratación: desde que entró a la vacante hasta que pasó a CONTRATADO.
        let diasPromedio: number | null = null;
        if (contratacionesRows.length) {
            const inicios = await prisma.candidateStageHistory.groupBy({
                by: ['candidateId', 'vacancyId'],
                where: { OR: contratacionesRows.map(c => ({ candidateId: c.candidateId, vacancyId: c.vacancyId })) },
                _min: { createdAt: true },
            });
            const inicio = new Map(inicios.map(i => [`${i.candidateId}:${i.vacancyId}`, i._min.createdAt]));
            const dias = contratacionesRows
                .map(c => {
                    const desde = inicio.get(`${c.candidateId}:${c.vacancyId}`);
                    return desde ? (c.createdAt.getTime() - desde.getTime()) / DIA : null;
                })
                .filter((d): d is number => d != null);
            if (dias.length) diasPromedio = Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10;
        }

        const nombres = await nombresOperadores(actividadRows.map(a => a.movedById));
        const abiertas = vacantes.filter(v => v.status === 'ABIERTA');

        return NextResponse.json({
            indicadores: {
                vacantesAbiertas: abiertas.length,
                vacantesUrgentes: abiertas.filter(v => v.priority === 'URGENTE' || v.priority === 'ALTA').length,
                puestosAbiertos: abiertas.reduce((a, v) => a + v.positionsCount, 0),
                vacantesPausadas: vacantes.length - abiertas.length,
                totalPostulantes,
                nuevos30,
                enProceso: totalesEmbudo(embudoGlobal).activos,
                contratados90: new Set(contratacionesRows.map(c => c.candidateId)).size,
                diasPromedioContratacion: diasPromedio,
            },
            embudo: embudoGlobal,
            busquedas: vacantes
                .map(v => ({ ...v, ...totalesEmbudo(embudo.get(v.id)), diasAbierta: Math.floor((ahora - v.startDate.getTime()) / DIA) }))
                .sort((a, b) => (a.status === b.status ? 0 : a.status === 'ABIERTA' ? -1 : 1) || (PESO_PRIORIDAD[a.priority] ?? 9) - (PESO_PRIORIDAD[b.priority] ?? 9) || b.diasAbierta - a.diasAbierta)
                .slice(0, 8),
            actividad: actividadRows.map(a => ({
                id: a.id, etapa: a.stage, notas: a.notes, fecha: a.createdAt,
                candidato: a.candidate, vacante: a.vacancy, por: a.movedById ? nombres.get(a.movedById) || null : null,
            })),
            recientes: recientes.map(serializarPostulanteLista),
            permisos: permisosDe(actor),
        });
    } catch (error) {
        return respuestaError(error, 'RESUMEN', 'No se pudo cargar el tablero de reclutamiento.');
    }
}
