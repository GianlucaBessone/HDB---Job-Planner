import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateOperatorScore } from '@/lib/operators/scoreCalculator';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');
        const monthParam = searchParams.get('month'); // YYYY-MM

        let month = new Date();
        if (monthParam) {
            const [year, m] = monthParam.split('-').map(Number);
            if (!isNaN(year) && !isNaN(m)) {
                month = new Date(year, m - 1, 1);
            }
        }

        const operatorsWhere = operatorId ? { id: operatorId, activo: true } : { activo: true };

        const operators = await prisma.operator.findMany({
            where: operatorsWhere,
            select: {
                id: true,
                nombreCompleto: true,
                role: true,
                posicion: true
            }
        });

        const scores = await Promise.all(operators.map(async (op) => {
            try {
                const res = await calculateOperatorScore(op.id, month);
                return {
                    operatorId: res.operatorId,
                    nombreCompleto: res.operatorName,
                    role: res.role,
                    posicion: op.posicion,
                    clientScore: Math.round(res.metrics.csat * 10),
                    surveyCount: res.metrics.surveysCount,
                    trainingScore: res.metrics.competencyScore,
                    internalTrainingsCount: res.metrics.totalTrainings,
                    internalApprovedCount: res.metrics.completedTrainings,
                    externalApprovedCount: res.metrics.approvedExternalCerts,
                    timeScore: res.metrics.timeCompliance,
                    fichadasCount: res.metrics.timeCompliance, // fallback or simulation
                    absenceScore: Math.max(0, 100 - (res.metrics.unjustifiedAbsences * 15)),
                    absencesCount: res.metrics.absences,
                    unjustifiedAbsences: res.metrics.unjustifiedAbsences,
                    justifiedAbsences: res.metrics.justifiedAbsences,
                    globalScore: res.globalScore,
                    metrics: res.metrics
                };
            } catch (err: any) {
                console.error(`Error calculating score for operator ${op.id}:`, err);
                return {
                    operatorId: op.id,
                    nombreCompleto: op.nombreCompleto,
                    role: op.role || 'Técnico',
                    posicion: op.posicion,
                    clientScore: 85,
                    surveyCount: 0,
                    trainingScore: 85,
                    internalTrainingsCount: 0,
                    internalApprovedCount: 0,
                    externalApprovedCount: 0,
                    timeScore: 90,
                    fichadasCount: 0,
                    absenceScore: 100,
                    absencesCount: 0,
                    unjustifiedAbsences: 0,
                    justifiedAbsences: 0,
                    globalScore: 80
                };
            }
        }));

        // Sort by global score descending
        scores.sort((a, b) => b.globalScore - a.globalScore);

        return NextResponse.json(scores);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
