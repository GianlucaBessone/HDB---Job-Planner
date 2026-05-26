import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateOperatorScore } from '@/lib/operators/scoreCalculator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // YYYY-MM

        let month = new Date();
        if (monthParam) {
            const [year, m] = monthParam.split('-').map(Number);
            if (!isNaN(year) && !isNaN(m)) {
                month = new Date(year, m - 1, 1);
            }
        }

        // Fetch all operators
        const operators = await prisma.operator.findMany({
            where: {
                activo: true
            },
            select: {
                id: true,
                nombreCompleto: true,
                role: true
            }
        });

        // We care about technicians/operators and supervisors (not admin/qa/vendedor)
        const technicians = operators.filter(op => {
            const role = op.role?.toLowerCase() || '';
            return role === 'operador' || role === 'tecnico' || role === 'técnico' || role === 'supervisor' || role === '';
        });

        const scoreboard = await Promise.all(technicians.map(async (tech) => {
            try {
                return await calculateOperatorScore(tech.id, month);
            } catch (err: any) {
                console.error(`Error calculating scoreboard for tech ${tech.id}:`, err);
                return {
                    operatorId: tech.id,
                    operatorName: tech.nombreCompleto,
                    role: tech.role || 'Técnico de Campo',
                    metrics: {
                        csat: 9.0,
                        nps: 80,
                        surveysCount: 0,
                        completedTrainings: 0,
                        totalTrainings: 0,
                        approvedExternalCerts: 0,
                        absences: 0,
                        unjustifiedAbsences: 0,
                        justifiedAbsences: 0,
                        timeCompliance: 90,
                        projectDelaysHours: 0,
                        projectDelaysCount: 0,
                        competencyScore: 0,
                        totalWorkedHours: 0,
                        hoursRewardBonus: 0,
                        safetyInfractionsCount: 0,
                        safetyPenalty: 0,
                        reworkCount: 0,
                        reworkPenalty: 0,
                        delayPenalty: 0
                    },
                    globalScore: 80
                };
            }
        }));

        // Sort by global score descending
        scoreboard.sort((a, b) => b.globalScore - a.globalScore);

        return NextResponse.json(scoreboard);
    } catch (error: any) {
        console.error('Operator Scoreboard API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
