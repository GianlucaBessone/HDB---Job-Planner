import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');

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
            // 1. CLIENT EVALUATIONS (Weight: 30%)
            // Get all service orders this operator worked on
            const osAssignments = await prisma.ordenServicioOperador.findMany({
                where: { operadorId: op.id },
                select: { ordenServicioId: true }
            });
            const osIds = osAssignments.map(a => a.ordenServicioId);

            // Get client surveys for those service orders
            let clientScore = 85; // Default baseline if no surveys
            let surveyCount = 0;
            if (osIds.length > 0) {
                const surveys = await prisma.encuestaServicio.findMany({
                    where: { ordenServicioId: { in: osIds } }
                });
                surveyCount = surveys.length;
                if (surveys.length > 0) {
                    const totalSurveysScore = surveys.reduce((sum, s) => {
                        // atencion (1-10), calidad (1-10), tiempo (1-10) -> average * 10 to scale to 100
                        const avg = (s.atencion + s.calidad + s.tiempo) / 3;
                        return sum + (avg * 10);
                    }, 0);
                    clientScore = Math.round(totalSurveysScore / surveys.length);
                }
            }

            // 2. TRAINING COMPLIANCE (Weight: 30%)
            // Internal trainings
            const assignedTrainings = await prisma.technicianTraining.findMany({
                where: { operatorId: op.id }
            });
            const totalTrainings = assignedTrainings.length;
            const approvedTrainings = assignedTrainings.filter(t => t.estado === 'aprobado').length;

            let internalTrainingScore = totalTrainings > 0 ? (approvedTrainings / totalTrainings) * 100 : 100;

            // External certificates (adds bonus or factors in)
            const extCerts = await prisma.externalCertificate.findMany({
                where: { operatorId: op.id, estado: 'aprobado' }
            });
            const approvedCertsCount = extCerts.length;
            
            // Final training score is internal training score + 5 bonus points per approved external cert (cap at 100)
            let trainingScore = Math.min(100, Math.round(internalTrainingScore + (approvedCertsCount * 5)));
            // If neither has entries, default to 85
            if (totalTrainings === 0 && approvedCertsCount === 0) {
                trainingScore = 85;
            }

            // 3. TIME COMPLIANCE (Weight: 25%)
            // Let's look at Fichadas and compute a compliance score based on isSuspicious or riskLevel
            const fichadas = await prisma.fichada.findMany({
                where: { operatorId: op.id }
            });
            
            let timeScore = 90; // Default baseline if no fichadas
            if (fichadas.length > 0) {
                const suspiciousCount = fichadas.filter(f => f.isSuspicious).length;
                const highRiskCount = fichadas.filter(f => f.riskLevel === 'HIGH').length;
                // Subtract 15 points per suspicious, 10 per high risk
                timeScore = Math.max(0, 100 - (suspiciousCount * 15) - (highRiskCount * 10));
            }

            // 4. ABSENCES (Weight: 15%)
            // Get absences from TimeEntry
            const timeEntries = await prisma.timeEntry.findMany({
                where: { 
                    operatorId: op.id,
                    causaRegistro: { in: ['Falta', 'Inasistencia', 'Falta Injustificada'] }
                }
            });
            const absencesCount = timeEntries.length;
            // Subtract 20 points per absence
            const absenceScore = Math.max(0, 100 - (absencesCount * 20));

            // COMPOSITE GLOBAL SCORE
            const globalScore = Math.round(
                (clientScore * 0.30) +
                (trainingScore * 0.30) +
                (timeScore * 0.25) +
                (absenceScore * 0.15)
            );

            return {
                operatorId: op.id,
                nombreCompleto: op.nombreCompleto,
                role: op.role,
                posicion: op.posicion,
                clientScore,
                surveyCount,
                trainingScore,
                internalTrainingsCount: totalTrainings,
                internalApprovedCount: approvedTrainings,
                externalApprovedCount: approvedCertsCount,
                timeScore,
                fichadasCount: fichadas.length,
                absenceScore,
                absencesCount,
                globalScore
            };
        }));

        // Sort by global score descending
        scores.sort((a, b) => b.globalScore - a.globalScore);

        return NextResponse.json(scores);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
