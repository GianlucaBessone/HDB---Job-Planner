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

export interface ScoreFeatureFlags {
    enableCompetency?: boolean;
    enableCsat?: boolean;
    enableAttendance?: boolean;
    enableCompliance?: boolean;
    enableSafetyPenalty?: boolean;
    enableReworkPenalty?: boolean;
    enableDelayPenalty?: boolean;
    enableOvertimeBonus?: boolean;
}

// ==========================================
// BUSINESS RULES & CONFIGURATION (ISO 9001)
// ==========================================
const SCORING_CONFIG = {
    // Feature Flags
    ENABLE_GPS_TIME_COMPARISON: false, // Set to true once GPS Clock-in feature is fully implemented
    
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
    // Habilidades Relevantes
    { name: 'HyS', weight: 2 },
    { name: 'Técnico en Dispensers', weight: 2 },
    { name: 'Técnico en Refrigeración', weight: 3 },
    { name: 'Técnico en CCTV/Alarmas', weight: 3 },
    { name: 'Electricista', weight: 4 },
    { name: 'Instrumentista Industrial', weight: 4 },
    { name: 'Especialista en Automatización (Neumática)', weight: 5 },
    { name: 'Especialista en Automatización (PLC)', weight: 5 },
    // Otras Habilidades
    { name: 'Lectura de Planos Eléctricos', weight: 3 },
    { name: 'Lectura de Planos Civiles', weight: 3 },
    { name: 'Soft Skills (Habilidades Blandas)', weight: 4 },
    { name: 'Herramientas de Informática', weight: 3 },
    { name: 'Team Leader', weight: 5 }
];

/**
 * Helper to fetch Argentine holidays from nolaborables.com.ar
 */
const holidayCache: Record<number, any[]> = {};

async function getHolidays(year: number) {
    if (holidayCache[year]) return holidayCache[year];
    try {
        const res = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${year}?incluir=opcional`);
        if (!res.ok) return [];
        const data = await res.json();
        // Filtrar "nolaborable" ya que esos días se trabajan normal según reglas de la empresa
        const feriados = data.filter((d: any) => d.tipo !== 'nolaborable');
        holidayCache[year] = feriados;
        return feriados;
    } catch (e) {
        console.error("Error fetching holidays:", e);
        return [];
    }
}

/**
 * Calculates expected working hours between two dates:
 * 9 hours per weekday (Mon-Fri) excluding holidays.
 */
async function calculateExpectedHours(startDate: Date, endDate: Date): Promise<number> {
    let expectedHours = 0;
    
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    const holidaysByYear: Record<number, any[]> = {};
    for (let y = startYear; y <= endYear; y++) {
        holidaysByYear[y] = await getHolidays(y);
    }

    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        // Lunes a Viernes (1-5)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const y = current.getFullYear();
            const m = current.getMonth() + 1;
            const d = current.getDate();
            
            const holidays = holidaysByYear[y] || [];
            const isHoliday = holidays.some(h => h.mes === m && h.dia === d);
            
            if (!isHoliday) {
                expectedHours += 9; // 9 hs por día hábil
            }
        }
        current.setDate(current.getDate() + 1);
    }
    
    return expectedHours;
}

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
    month: Date,
    flags?: ScoreFeatureFlags
): Promise<OperatorScoreResult> {
    // Default all flags to true if not provided
    const f = {
        enableCompetency: flags?.enableCompetency ?? true,
        enableCsat: flags?.enableCsat ?? true,
        enableAttendance: flags?.enableAttendance ?? true,
        enableCompliance: flags?.enableCompliance ?? true,
        enableSafetyPenalty: flags?.enableSafetyPenalty ?? true,
        enableReworkPenalty: flags?.enableReworkPenalty ?? true,
        enableDelayPenalty: flags?.enableDelayPenalty ?? true,
        enableOvertimeBonus: flags?.enableOvertimeBonus ?? true,
    };
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
            role: true,
            createdAt: true
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
        where: { operatorId },
        include: { document: true }
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

    const activeTrainings = trainings.filter(t => {
        if (t.estado === 'obsoleto') return false;
        if (t.document?.estado === 'obsoleto' && t.estado !== 'aprobado') return false;
        return true;
    });

    const completedTrainings = activeTrainings.filter(t => t.estado === 'aprobado').length;
    const totalTrainings = activeTrainings.length;

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

    // 4. TIME COMPLIANCE (Cumplimiento Dinámico Histórico vs 180hs) (Weight: 25%)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const allTimeEntries = await prisma.timeEntry.findMany({
        where: {
            operatorId,
            estadoConfirmado: true,
            fecha: { lte: yesterdayStr }
        },
        orderBy: { fecha: 'asc' }
    });

    const totalHistoricWorkedHours = allTimeEntries
        .filter(te => !te.causaRegistro)
        .reduce((acc, te) => acc + (te.horasTrabajadas || 0), 0);

    let expectedHours = 0;
    if (allTimeEntries.length > 0) {
        const firstEntryDate = new Date(allTimeEntries[0].fecha + "T00:00:00");
        expectedHours = await calculateExpectedHours(firstEntryDate, yesterday);
    } else if (operator.createdAt) {
        // Fallback to operator creation date if no entries exist
        expectedHours = await calculateExpectedHours(operator.createdAt, yesterday);
    }

    let complianceComponent = 100;
    
    if (SCORING_CONFIG.ENABLE_GPS_TIME_COMPARISON) {
        if (expectedHours > 0) {
            // Calculamos el porcentaje real, cap a 150 para que no rompa desproporcionadamente el baseScore
            const complianceRate = (totalHistoricWorkedHours / expectedHours) * 100;
            complianceComponent = Math.min(150, Math.max(0, Math.round(complianceRate)));
        } else if (expectedHours === 0 && totalHistoricWorkedHours === 0) {
            // Si no se esperaba que trabaje nada y no trabajó nada (ej: entró hoy mismo)
            complianceComponent = 100;
        } else if (expectedHours === 0 && totalHistoricWorkedHours > 0) {
            // Trabajó sin tener horas esperadas (fines de semana al ingresar, etc)
            complianceComponent = 150;
        }
    }

    // Para el bono de carga mensual que se usa más abajo, necesitamos las horas del mes actual
    const manualHours = allTimeEntries
        .filter(te => te.fecha.startsWith(monthPrefix) && !te.causaRegistro)
        .reduce((acc, te) => acc + (te.horasTrabajadas || 0), 0);

    const fichadas = await prisma.fichada.findMany({
        where: {
            operatorId,
            fecha: { startsWith: monthPrefix }
        }
    });

    const automaticHours = fichadas.reduce((acc, f) => acc + (f.horasTrabajadas || 0), 0);

    // BASE SCORE (Out of 100) — Option 2: Neutral 100% when disabled, fixed weights
    const competencyVal = f.enableCompetency ? competencyScore : 100;
    const csatVal = f.enableCsat ? csatNpsScore : 100;
    const attendanceVal = f.enableAttendance ? attendanceComponent : 100;
    const complianceVal = f.enableCompliance ? complianceComponent : 100;

    const baseScore = 
        (competencyVal * 0.35) + 
        (csatVal * 0.20) + 
        (attendanceVal * 0.20) + 
        (complianceVal * 0.25);

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
    const effectiveDelayPenalty = f.enableDelayPenalty ? delayPenalty : 0;
    const effectiveSafetyPenalty = f.enableSafetyPenalty ? safetyPenalty : 0;
    const effectiveReworkPenalty = f.enableReworkPenalty ? reworkPenalty : 0;
    const effectiveHoursBonus = f.enableOvertimeBonus ? hoursRewardBonus : 0;
    const globalScore = Math.max(10, Math.min(100, Math.round(
        baseScore - effectiveDelayPenalty - effectiveSafetyPenalty - effectiveReworkPenalty + effectiveHoursBonus
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
