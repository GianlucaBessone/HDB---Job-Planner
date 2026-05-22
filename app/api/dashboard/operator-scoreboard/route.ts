import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
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
            // 1. Fetch internal training statistics
            const trainings = await prisma.technicianTraining.findMany({
                where: { operatorId: tech.id }
            });
            const totalTrainings = trainings.length;
            const completedTrainings = trainings.filter(t => t.estado === 'aprobado').length;
            const trainingScore = totalTrainings > 0 ? (completedTrainings / totalTrainings) * 100 : 0;

            // 2. Fetch external certificates
            const extCertificates = await prisma.externalCertificate.findMany({
                where: {
                    operatorId: tech.id,
                    estado: 'aprobado'
                }
            });
            const approvedExternalCerts = extCertificates.length;

            // 3. Fetch client surveys for this operator
            const osOps = await prisma.ordenServicioOperador.findMany({
                where: { operadorId: tech.id },
                include: {
                    ordenServicio: {
                        include: {
                            encuesta: true
                        }
                    }
                }
            });

            let totalAtencion = 0;
            let totalCalidad = 0;
            let totalTiempo = 0;
            let npsPromotores = 0;
            let npsDetractores = 0;
            let surveyCount = 0;

            osOps.forEach(oo => {
                const encuesta = oo.ordenServicio?.encuesta;
                if (encuesta) {
                    surveyCount++;
                    totalAtencion += encuesta.atencion || 0;
                    totalCalidad += encuesta.calidad || 0;
                    totalTiempo += encuesta.tiempo || 0;
                    
                    const npsVal = encuesta.nps;
                    if (npsVal >= 9) npsPromotores++;
                    else if (npsVal <= 6) npsDetractores++;
                }
            });

            const avgAtencion = surveyCount > 0 ? totalAtencion / surveyCount : 9.0; 
            const avgCalidad = surveyCount > 0 ? totalCalidad / surveyCount : 9.0;
            const avgTiempo = surveyCount > 0 ? totalTiempo / surveyCount : 9.0;
            const csat = (avgAtencion + avgCalidad + avgTiempo) / 3; // 1 to 10 scale
            
            const npsScore = surveyCount > 0 
                ? Math.round(((npsPromotores - npsDetractores) / surveyCount) * 100) 
                : 80;

            // 4. Fetch attendance & punch-in compliance from Fichadas
            const fichadas = await prisma.fichada.findMany({
                where: { operatorId: tech.id }
            });

            const totalFichadas = fichadas.length;
            const suspiciousFichadas = fichadas.filter(f => f.isSuspicious).length;

            // Fetch actual absences recorded as TimeEntry with causaRegistro "Falta"
            const realAbsences = await prisma.timeEntry.count({
                where: {
                    operatorId: tech.id,
                    causaRegistro: {
                        in: ['Falta', 'Falta Injustificada', 'Falta sin aviso']
                    }
                }
            });

            // 5. Fetch manual hour load and validate against automatic Fichadas
            const automaticHours = fichadas.reduce((acc, f) => acc + (f.horasTrabajadas || 0), 0);
            
            const timeEntries = await prisma.timeEntry.findMany({
                where: {
                    operatorId: tech.id,
                    estadoConfirmado: true
                }
            });
            const manualHours = timeEntries.reduce((acc, te) => acc + (te.horasTrabajadas || 0), 0);

            // Compute discrepancy penalty: if they mismatch by > 15%, apply a penalty (max 20 pts)
            let discrepancyPenalty = 0;
            if (manualHours > 0 || automaticHours > 0) {
                const diff = Math.abs(automaticHours - manualHours);
                const avg = (automaticHours + manualHours) / 2;
                const pctDiff = avg > 0 ? (diff / avg) * 100 : 0;
                if (pctDiff > 15) {
                    discrepancyPenalty = Math.min(20, Math.round(pctDiff / 4));
                }
            }

            // Reward for high hours workload: +1 point per 15 total confirmed worked hours, max +15 points
            const totalWorkedHours = Math.max(automaticHours, manualHours);
            const hoursRewardBonus = Math.min(15, Math.round(totalWorkedHours / 15));

            // Time compliance calculation (real database inputs only, no hardcoding fallback!)
            let complianceComponent = 100;
            if (totalFichadas > 0) {
                complianceComponent = Math.max(0, 100 - ((suspiciousFichadas / totalFichadas) * 100) - discrepancyPenalty);
            } else {
                // If they never punch in but have manual hours confirmed, evaluate compliance based on discrepancies
                complianceComponent = Math.max(0, 100 - discrepancyPenalty);
            }

            // 6. Fetch project delays for projects the operator is assigned to
            const osProjects = osOps.map(oo => oo.ordenServicio?.projectId).filter(Boolean) as string[];
            const fichadaProjects = fichadas.map(f => f.projectId).filter(Boolean) as string[];
            
            const assignedProjectIds = Array.from(new Set([
                ...osProjects,
                ...fichadaProjects
            ]));

            const clientDelays = assignedProjectIds.length > 0
                ? await prisma.clientDelay.findMany({
                    where: {
                        projectId: {
                            in: assignedProjectIds
                        }
                    }
                })
                : [];

            const totalDelayHours = clientDelays.reduce((acc, d) => acc + (d.duracion || 0), 0);
            const totalDelayEvents = clientDelays.length;
            const delayPenalty = Math.min(10, totalDelayHours * 0.2);

            // 7. Competencies Matrix Calculation
            const competencies = await prisma.technicianCompetency.findMany({
                where: { operatorId: tech.id }
            });

            // Map LMS trainings to skills
            const lmsSkills = new Set<string>();
            trainings.filter(t => t.estado === 'aprobado').forEach(t => {
                const title = t.titulo.toLowerCase();
                if (title.includes('plc') || title.includes('programación') || title.includes('programacion')) {
                    lmsSkills.add('Programación de PLC');
                }
                if (title.includes('automatización') || title.includes('automatizacion') || title.includes('industrial')) {
                    lmsSkills.add('Automatización Industrial');
                }
                if (title.includes('eléctrica') || title.includes('electrica') || title.includes('electricidad')) {
                    lmsSkills.add('Electricidad Industrial');
                }
                if (title.includes('dispenser') || title.includes('dispensadores')) {
                    lmsSkills.add('Técnico de Dispensers');
                }
                if (title.includes('baja tensión') || title.includes('baja tension')) {
                    lmsSkills.add('Instalaciones de Baja Tensión');
                }
                if (title.includes('seguridad') || title.includes('nfpa') || title.includes('loto')) {
                    lmsSkills.add('Seguridad Eléctrica y NFPA 70E');
                }
                if (title.includes('altura') || title.includes('alturas')) {
                    lmsSkills.add('Trabajo en Altura');
                }
                if (title.includes('mantenimiento') || title.includes('preventivo')) {
                    lmsSkills.add('Mantenimiento Preventivo');
                }
            });

            // Combine manual, approved certificate, and auto-granted LMS competencies
            const activeCompetencies = new Set<string>();
            competencies.filter(c => c.estado === 'vigente').forEach(c => activeCompetencies.add(c.nombre));
            lmsSkills.forEach(skill => activeCompetencies.add(skill));

            const PREDEFINED_SKILLS = [
                { name: 'Programación de PLC', weight: 10 },
                { name: 'Automatización Industrial', weight: 9 },
                { name: 'Electricidad Industrial', weight: 8 },
                { name: 'Técnico de Dispensers', weight: 6 },
                { name: 'Instalaciones de Baja Tensión', weight: 5 },
                { name: 'Seguridad Eléctrica y NFPA 70E', weight: 8 },
                { name: 'Trabajo en Altura', weight: 4 },
                { name: 'Mantenimiento Preventivo', weight: 4 }
            ];

            let activeWeightSum = 0;
            PREDEFINED_SKILLS.forEach(skill => {
                if (activeCompetencies.has(skill.name)) {
                    activeWeightSum += skill.weight;
                }
            });
            const maxPossibleWeight = PREDEFINED_SKILLS.reduce((acc, s) => acc + s.weight, 0); // 54
            const competencyScore = maxPossibleWeight > 0 
                ? Math.round((activeWeightSum / maxPossibleWeight) * 100) 
                : 0;

            // Score Weighting Scheme (Total base = 100 pts)
            // 40% Competencies Matrix (Focus on learning and growth)
            // 20% CSAT/NPS
            // 20% Attendance (Deducted by realAbsences)
            // 20% Time compliance (Deducted by suspicious Fichadas and manual discrepancies)
            // Modifier: + hoursRewardBonus (recompensa por alta carga horaria)
            // Modifier: - delayPenalty (proyectos atrasados)
            const csatComponent = csat * 10;
            const attendanceComponent = Math.max(0, 100 - (realAbsences * 15));

            const globalScore = Math.max(10, Math.min(100, Math.round(
                (competencyScore * 0.4) +
                (csatComponent * 0.2) +
                (attendanceComponent * 0.2) +
                (complianceComponent * 0.2) -
                delayPenalty +
                hoursRewardBonus
            )));

            return {
                operatorId: tech.id,
                operatorName: tech.nombreCompleto,
                role: tech.role || 'Técnico de Campo',
                metrics: {
                    csat: Number(csat.toFixed(1)),
                    nps: npsScore,
                    surveysCount: surveyCount,
                    completedTrainings,
                    totalTrainings,
                    approvedExternalCerts,
                    absences: realAbsences,
                    timeCompliance: Math.round(complianceComponent),
                    projectDelaysHours: Number(totalDelayHours.toFixed(1)),
                    projectDelaysCount: totalDelayEvents,
                    competencyScore,
                    totalWorkedHours: Number(totalWorkedHours.toFixed(1)),
                    hoursRewardBonus
                },
                globalScore
            };
        }));

        // Sort by global score descending
        scoreboard.sort((a, b) => b.globalScore - a.globalScore);

        return NextResponse.json(scoreboard);
    } catch (error: any) {
        console.error('Operator Scoreboard API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
