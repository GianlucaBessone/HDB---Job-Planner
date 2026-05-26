import { prisma } from '../prisma';

export interface ScoreMetrics {
    csat: number;
    nps: number;
    surveysCount: number;
    completedTrainings: number;
    totalTrainings: number;
    approvedExternalCerts: number;
    absences: number;
    unjustifiedAbsences: number;
    justifiedAbsences: number;
    timeCompliance: number;
    projectDelaysHours: number;
    projectDelaysCount: number;
    competencyScore: number;
    totalWorkedHours: number;
    hoursRewardBonus: number;
    safetyInfractionsCount: number;
    safetyPenalty: number;
    reworkCount: number;
    reworkPenalty: number;
    delayPenalty: number;
}

export interface OperatorScoreResult {
    operatorId: string;
    operatorName: string;
    role: string;
    metrics: ScoreMetrics;
    globalScore: number;
}

// ==========================================
// BUSINESS RULES & CONFIGURATION (ISO 9001)
// ==========================================
const SCORING_CONFIG = {
    // Competency: A weight of 25 is considered a "Full Specialist" benchmark (e.g., 3-4 core skills).
    // This prevents bias against specialized technicians compared to "master of all" generalists.
    COMPETENCY_TARGET_WEIGHT: 25, 
    
    // CSAT & NPS Balance
    CSAT_WEIGHT_PCT: 0.70,
    NPS_WEIGHT_PCT: 0.30,
    
    // Time Compliance Thresholds
    TIME_COMPLIANCE_DIFF_THRESHOLD_PCT: 15,
    TIME_COMPLIANCE_MAX_PENALTY: 20,
    
    // Bonuses
    OVERTIME_BONUS_THRESHOLD_HOURS: 180,
    OVERTIME_BONUS_DIVISOR: 2, // +1 pt per 2 hours
    OVERTIME_MAX_BONUS: 15,
    
    // Penalties
    DELAY_PENALTY_RATE_PER_HOUR: 0.2,
    DELAY_MAX_PENALTY: 10,
    SAFETY_PENALTY_PER_INFRACTION: 15,
    REWORK_PENALTY_1: 5,
    REWORK_PENALTY_2: 15,
    REWORK_PENALTY_3_PLUS: 30
};

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

/**
 * Calculates the number of weekdays (excluding weekends) in a given month.
 */
function getWeekdayCount(year: number, monthIdx: number): number {
    let count = 0;
    const date = new Date(year, monthIdx, 1);
    while (date.getMonth() === monthIdx) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
            count++;
        }
        date.setDate(date.getDate() + 1);
    }
    return count;
}

/**
 * Robust monthly performance score calculator for SGI (HDB SGI)
 * complying with Argentina's LCT 20.744 for HDB Servicios Eléctricos.
 */
export async function calculateOperatorScore(
    operatorId: string,
    month: Date
): Promise<OperatorScoreResult> {
    const year = month.getFullYear();
    const monthIdx = month.getMonth();
    const monthStr = String(monthIdx + 1).padStart(2, '0');
    const monthPrefix = `${year}-${monthStr}`; // YYYY-MM

    const startOfMonth = new Date(year, monthIdx, 1);
    const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

    // Fetch Operator details
    const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: {
            id: true,
            nombreCompleto: true,
            role: true
        }
    });

    if (!operator) {
        throw new Error(`Operator with ID ${operatorId} not found`);
    }

    // 1. COMPETENCY SCORE (Weight: 35%)
    const competencies = await prisma.technicianCompetency.findMany({
        where: { operatorId }
    });

    const trainings = await prisma.technicianTraining.findMany({
        where: { operatorId }
    });

    // Map LMS approved trainings to skill names
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

    const activeCompetencies = new Set<string>();
    competencies.filter(c => c.estado === 'vigente').forEach(c => activeCompetencies.add(c.nombre));
    lmsSkills.forEach(skill => activeCompetencies.add(skill));

    let activeWeightSum = 0;
    PREDEFINED_SKILLS.forEach(skill => {
        if (activeCompetencies.has(skill.name)) {
            activeWeightSum += skill.weight;
        }
    });
    
    // Use target weight benchmark instead of sum of all skills to avoid punishing specialists
    const competencyScore = Math.min(100, Math.round((activeWeightSum / SCORING_CONFIG.COMPETENCY_TARGET_WEIGHT) * 100));

    const completedTrainings = trainings.filter(t => t.estado === 'aprobado').length;
    const totalTrainings = trainings.length;

    // Fetch approved external certificates
    const extCertificates = await prisma.externalCertificate.findMany({
        where: {
            operatorId,
            estado: 'aprobado'
        }
    });
    const approvedExternalCerts = extCertificates.length;

    // 2. CLIENT SURVEY (CSAT + NPS) (Weight: 20%)
    const osAssignments = await prisma.ordenServicioOperador.findMany({
        where: {
            operadorId: operatorId,
            ordenServicio: {
                fechaCreacion: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        },
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
    let npsImpactSum = 0;

    osAssignments.forEach(oo => {
        const encuesta = oo.ordenServicio?.encuesta;
        if (encuesta) {
            surveyCount++;
            totalAtencion += encuesta.atencion || 0;
            totalCalidad += encuesta.calidad || 0;
            totalTiempo += encuesta.tiempo || 0;
            
            const npsVal = encuesta.nps;
            // NPS Impact
            if (npsVal >= 9) {
                npsImpactSum += 100;
                npsPromotores++;
            } else if (npsVal >= 7) {
                npsImpactSum += 70;
            } else {
                npsImpactSum += 0;
                npsDetractores++;
            }
        }
    });

    // Default baseline values if no surveys
    let csat = 9.0; 
    let avgNpsImpact = 85.0; 
    let npsScore = 80;

    if (surveyCount > 0) {
        csat = (totalAtencion + totalCalidad + totalTiempo) / (3 * surveyCount);
        avgNpsImpact = npsImpactSum / surveyCount;
        npsScore = Math.round(((npsPromotores - npsDetractores) / surveyCount) * 100);
    }

    const csatScale100 = csat * 10;
    const csatNpsScore = (csatScale100 * SCORING_CONFIG.CSAT_WEIGHT_PCT) + (avgNpsImpact * SCORING_CONFIG.NPS_WEIGHT_PCT);

    // 3. ATTENDANCE (AsistenciaNeutra) (Weight: 20%)
    const absencesEntries = await prisma.timeEntry.findMany({
        where: {
            operatorId,
            fecha: { startsWith: monthPrefix },
            causaRegistro: { not: null }
        }
    });

    let unjustifiedAbsences = 0;
    let justifiedAbsences = 0;

    absencesEntries.forEach(entry => {
        const causa = (entry.causaRegistro || '').toLowerCase();
        const desc = (entry.descripcionDevolucion || '').toLowerCase();
        
        const isAbsence = causa.includes('falta') || 
                          causa.includes('inasistencia') || 
                          causa.includes('ausente') ||
                          causa.includes('carpeta') ||
                          causa.includes('licencia') ||
                          causa.includes('permiso');
        
        if (isAbsence) {
             const isJustified = causa.includes('justificada') || 
                                 causa.includes('medica') || 
                                 causa.includes('médica') || 
                                 causa.includes('carpeta') || 
                                 causa.includes('licencia') || 
                                 causa.includes('permiso') ||
                                 desc.includes('justificada') ||
                                 desc.includes('medica') ||
                                 desc.includes('médica') ||
                                 desc.includes('justificativo') ||
                                 desc.includes('certificado');
                                 
            if (isJustified) {
                justifiedAbsences++;
            } else {
                unjustifiedAbsences++;
            }
        }
    });

    const totalDays = getWeekdayCount(year, monthIdx);
    const netDays = Math.max(1, totalDays - justifiedAbsences);
    
    // Mathematical fix: Calculate proportional rate without double penalty
    const attendanceRate = netDays > 0 ? ((netDays - unjustifiedAbsences) / netDays) * 100 : 100;
    const attendanceComponent = Math.max(0, Math.round(attendanceRate));

    // 4. TIME COMPLIANCE (Cumplimiento) (Weight: 25%)
    const fichadas = await prisma.fichada.findMany({
        where: {
            operatorId,
            fecha: { startsWith: monthPrefix }
        }
    });

    const totalFichadas = fichadas.length;
    const suspiciousFichadas = fichadas.filter(f => f.isSuspicious).length;

    // Validate manual hour load against automatic Fichadas
    const automaticHours = fichadas.reduce((acc, f) => acc + (f.horasTrabajadas || 0), 0);
    
    const timeEntries = await prisma.timeEntry.findMany({
        where: {
            operatorId,
            fecha: { startsWith: monthPrefix },
            estadoConfirmado: true
        }
    });
    const manualHours = timeEntries
        .filter(te => !te.causaRegistro)
        .reduce((acc, te) => acc + (te.horasTrabajadas || 0), 0);

    // Compute discrepancy penalty proportionally 
    let discrepancyPenalty = 0;
    if (manualHours > 0 || automaticHours > 0) {
        const diff = Math.abs(automaticHours - manualHours);
        const avg = (automaticHours + manualHours) / 2;
        const pctDiff = avg > 0 ? (diff / avg) * 100 : 0;
        if (pctDiff > SCORING_CONFIG.TIME_COMPLIANCE_DIFF_THRESHOLD_PCT) {
            discrepancyPenalty = Math.min(SCORING_CONFIG.TIME_COMPLIANCE_MAX_PENALTY, Math.round(pctDiff / 4));
        }
    }

    let complianceComponent = 100;
    if (totalFichadas > 0) {
        complianceComponent = Math.max(0, 100 - ((suspiciousFichadas / totalFichadas) * 100) - discrepancyPenalty);
    } else {
        complianceComponent = Math.max(0, 100 - discrepancyPenalty);
    }

    // BASE SCORE (Out of 100)
    const baseScore = 
        (competencyScore * 0.35) + 
        (csatNpsScore * 0.20) + 
        (attendanceComponent * 0.20) + 
        (complianceComponent * 0.25);

    // 5. MODIFIERS (Deductions & Bonuses)
    
    // Overtime reward bonus
    const totalWorkedHours = Math.max(automaticHours, manualHours);
    const extraHours = Math.max(0, totalWorkedHours - SCORING_CONFIG.OVERTIME_BONUS_THRESHOLD_HOURS);
    const hoursRewardBonus = Math.min(
        SCORING_CONFIG.OVERTIME_MAX_BONUS, 
        Math.round(extraHours / SCORING_CONFIG.OVERTIME_BONUS_DIVISOR)
    );

    // Delay penalty
    const osProjects = osAssignments.map(oo => oo.ordenServicio?.projectId).filter(Boolean) as string[];
    const fichadaProjects = fichadas.map(f => f.projectId).filter(Boolean) as string[];
    const assignedProjectIds = Array.from(new Set([...osProjects, ...fichadaProjects]));

    const clientDelays = assignedProjectIds.length > 0
        ? await prisma.clientDelay.findMany({
            where: {
                projectId: { in: assignedProjectIds },
                fecha: { startsWith: monthPrefix }
            }
        })
        : [];

    const totalDelayHours = clientDelays.reduce((acc, d) => acc + (d.duracion || 0), 0);
    const totalDelayEvents = clientDelays.length;
    const delayPenalty = Math.min(SCORING_CONFIG.DELAY_MAX_PENALTY, totalDelayHours * SCORING_CONFIG.DELAY_PENALTY_RATE_PER_HOUR);

    // Safety violations (SST)
    const safetyAudits = await prisma.safetyAudit.findMany({
        where: {
            operatorId,
            fecha: { startsWith: monthPrefix }
        }
    });
    const safetyInfractionsCount = safetyAudits.filter(
        a => !a.eppAprobado || !a.lotoAplicado || !a.cumpleNormativa
    ).length;
    const safetyPenalty = safetyInfractionsCount * SCORING_CONFIG.SAFETY_PENALTY_PER_INFRACTION; 

    // Rework penalty (FTFR)
    const reworkCount = await prisma.ordenServicioOperador.count({
        where: {
            operadorId: operatorId,
            ordenServicio: {
                esReTrabajo: true,
                fechaCreacion: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        }
    });
    
    // Apply progressive penalty array
    const reworkPenalty = reworkCount === 1 ? SCORING_CONFIG.REWORK_PENALTY_1 
                        : reworkCount === 2 ? SCORING_CONFIG.REWORK_PENALTY_2 
                        : reworkCount >= 3 ? SCORING_CONFIG.REWORK_PENALTY_3_PLUS : 0;

    // FINAL GLOBAL SCORE (Bounded between 10 and 100)
    const globalScore = Math.max(10, Math.min(100, Math.round(
        baseScore - delayPenalty - safetyPenalty - reworkPenalty + hoursRewardBonus
    )));

    return {
        operatorId: operator.id,
        operatorName: operator.nombreCompleto,
        role: operator.role || 'Técnico de Campo',
        metrics: {
            csat: Number(csat.toFixed(1)),
            nps: npsScore,
            surveysCount: surveyCount,
            completedTrainings,
            totalTrainings,
            approvedExternalCerts,
            absences: unjustifiedAbsences + justifiedAbsences, // Fixed visual bug of 0.5 absences
            unjustifiedAbsences,
            justifiedAbsences,
            timeCompliance: Math.round(complianceComponent),
            projectDelaysHours: Number(totalDelayHours.toFixed(1)),
            projectDelaysCount: totalDelayEvents,
            competencyScore,
            totalWorkedHours: Number(totalWorkedHours.toFixed(1)),
            hoursRewardBonus,
            safetyInfractionsCount,
            safetyPenalty,
            reworkCount,
            reworkPenalty,
            delayPenalty
        },
        globalScore
    };
}
