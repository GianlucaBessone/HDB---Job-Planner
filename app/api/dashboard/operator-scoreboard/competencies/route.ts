import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const PREDEFINED_SKILLS = [
    // Habilidades Relevantes
    { name: 'HyS', weight: 2, category: 'Seguridad' },
    { name: 'Técnico en Dispensers', weight: 2, category: 'Mecánica/Dispensers' },
    { name: 'Técnico en Refrigeración', weight: 3, category: 'Mecánica/Refrigeración' },
    { name: 'Técnico en CCTV/Alarmas', weight: 3, category: 'Sistemas' },
    { name: 'Electricista', weight: 4, category: 'Eléctrica' },
    { name: 'Instrumentista Industrial', weight: 4, category: 'Eléctrica' },
    { name: 'Especialista en Automatización (Neumática)', weight: 5, category: 'Automatización' },
    { name: 'Especialista en Automatización (PLC)', weight: 5, category: 'Automatización' },
    // Otras Habilidades
    { name: 'Lectura de Planos Eléctricos', weight: 3, category: 'Otras Habilidades' },
    { name: 'Lectura de Planos Civiles', weight: 3, category: 'Otras Habilidades' },
    { name: 'Soft Skills (Habilidades Blandas)', weight: 4, category: 'Otras Habilidades' },
    { name: 'Herramientas de Informática', weight: 3, category: 'Otras Habilidades' },
    { name: 'Team Leader', weight: 5, category: 'Otras Habilidades' }
];

const SKILL_MIGRATION_MAP: Record<string, string> = {
    'Programación de PLC': 'Especialista en Automatización (PLC)',
    'Automatización Industrial': 'Especialista en Automatización (Neumática)',
    'Electricidad Industrial': 'Electricista',
    'Técnico de Dispensers': 'Técnico en Dispensers',
    'Instalaciones de Baja Tensión': 'Electricista',
    'Seguridad Eléctrica y NFPA 70E': 'HyS',
    'Trabajo en Altura': 'HyS',
    'Mantenimiento Preventivo': 'HyS'
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const operatorId = searchParams.get('operatorId');
        if (!operatorId) {
            return NextResponse.json({ error: 'El ID de operador es obligatorio.' }, { status: 400 });
        }

        // Self-healing migration for old competency names in the database
        for (const [oldName, newName] of Object.entries(SKILL_MIGRATION_MAP)) {
            const oldComps = await prisma.technicianCompetency.findMany({
                where: { nombre: oldName }
            });
            for (const comp of oldComps) {
                const exists = await prisma.technicianCompetency.findFirst({
                    where: { operatorId: comp.operatorId, nombre: newName }
                });
                if (!exists) {
                    await prisma.technicianCompetency.update({
                        where: { id: comp.id },
                        data: { nombre: newName }
                    });
                } else {
                    await prisma.technicianCompetency.delete({
                        where: { id: comp.id }
                    });
                }
            }
        }

        // Fetch competencies
        const competencies = await prisma.technicianCompetency.findMany({
            where: { operatorId }
        });

        // Fetch LMS completed courses to dynamically see if any map to competencies
        const completedTrainings = await prisma.technicianTraining.findMany({
            where: { operatorId, estado: 'aprobado' }
        });

        // Compute LMS auto-granted skills
        const lmsSkills = new Set<string>();
        completedTrainings.forEach(t => {
            const title = t.titulo.toLowerCase();
            if (title.includes('plc') || title.includes('programación') || title.includes('programacion')) {
                lmsSkills.add('Especialista en Automatización (PLC)');
            }
            if (title.includes('automatización') || title.includes('automatizacion')) {
                lmsSkills.add('Especialista en Automatización (Neumática)');
            }
            if (title.includes('industrial')) {
                lmsSkills.add('Instrumentista Industrial');
            }
            if (title.includes('eléctrica') || title.includes('electrica') || title.includes('electricidad') || title.includes('baja tensión') || title.includes('baja tension')) {
                lmsSkills.add('Electricista');
            }
            if (title.includes('dispenser') || title.includes('dispensadores')) {
                lmsSkills.add('Técnico en Dispensers');
            }
            if (title.includes('seguridad') || title.includes('nfpa') || title.includes('loto') || title.includes('altura') || title.includes('alturas')) {
                lmsSkills.add('HyS');
            }
            if (title.includes('refrigeración') || title.includes('refrigeracion')) {
                lmsSkills.add('Técnico en Refrigeración');
            }
            if (title.includes('cctv') || title.includes('alarma') || title.includes('alarmas')) {
                lmsSkills.add('Técnico en CCTV/Alarmas');
            }
            if (title.includes('plano') || title.includes('planos')) {
                if (title.includes('eléctrico') || title.includes('electrico')) {
                    lmsSkills.add('Lectura de Planos Eléctricos');
                } else if (title.includes('civil') || title.includes('civiles')) {
                    lmsSkills.add('Lectura de Planos Civiles');
                }
            }
            if (title.includes('soft') || title.includes('blanda') || title.includes('blandas')) {
                lmsSkills.add('Soft Skills (Habilidades Blandas)');
            }
            if (title.includes('informática') || title.includes('informatica') || title.includes('computación') || title.includes('computacion')) {
                lmsSkills.add('Herramientas de Informática');
            }
            if (title.includes('team') || title.includes('leader') || title.includes('líder') || title.includes('lider')) {
                lmsSkills.add('Team Leader');
            }
        });

        // Format predefined matrix with current states
        const matrix = PREDEFINED_SKILLS.map(skill => {
            const matchedDb = competencies.find(c => c.nombre === skill.name);
            const isLmsGranted = lmsSkills.has(skill.name);
            
            let status = 'inactiva';
            let source = 'No adquirida';
            let id = matchedDb?.id || null;
            let evidence = matchedDb?.evidencia || null;

            if (isLmsGranted) {
                status = 'vigente';
                source = 'LMS (Curso aprobado)';
            } else if (matchedDb) {
                status = matchedDb.estado; // 'vigente' | 'pendiente'
                source = matchedDb.evidencia?.startsWith('Certificado:') 
                    ? 'Certificado Externo' 
                    : 'Manual (Asignada por Supervisor)';
            }

            return {
                ...skill,
                id,
                status,
                source,
                evidence
            };
        });

        return NextResponse.json({
            operatorId,
            matrix,
            totalPossibleWeight: PREDEFINED_SKILLS.reduce((acc, s) => acc + s.weight, 0)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST is for toggling/saving manual competencies
export async function POST(request: Request) {
    try {
        const { operatorId, skillName, active, userId, userName } = await request.json();
        
        if (!operatorId || !skillName) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios.' }, { status: 400 });
        }

        const existing = await prisma.technicianCompetency.findFirst({
            where: { operatorId, nombre: skillName }
        });

        if (active) {
            if (!existing) {
                await prisma.technicianCompetency.create({
                    data: {
                        operatorId,
                        nombre: skillName,
                        estado: 'vigente',
                        evidencia: 'Manual (Asignada por Supervisor)',
                        aprobadorId: userId || null,
                        aprobadorNombre: userName || null
                    }
                });
            } else if (existing.estado !== 'vigente') {
                await prisma.technicianCompetency.update({
                    where: { id: existing.id },
                    data: {
                        estado: 'vigente',
                        evidencia: 'Manual (Asignada por Supervisor)',
                        aprobadorId: userId || null,
                        aprobadorNombre: userName || null
                    }
                });
            }
        } else {
            if (existing) {
                await prisma.technicianCompetency.delete({
                    where: { id: existing.id }
                });
            }
        }

        // Audit Log
        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'TECHNICIAN_COMPETENCY',
            entityId: operatorId,
            newValue: { skillName, active }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT is for approving pending competencies extracted from external certificates
export async function PUT(request: Request) {
    try {
        const { competencyId, approve, userId, userName } = await request.json();

        if (!competencyId) {
            return NextResponse.json({ error: 'El ID de la competencia es obligatorio.' }, { status: 400 });
        }

        const competency = await prisma.technicianCompetency.findUnique({
            where: { id: competencyId }
        });

        if (!competency) {
            return NextResponse.json({ error: 'Competencia no encontrada.' }, { status: 404 });
        }

        if (approve) {
            await prisma.technicianCompetency.update({
                where: { id: competencyId },
                data: {
                    estado: 'vigente',
                    aprobadorId: userId || null,
                    aprobadorNombre: userName || null
                }
            });
        } else {
            // Reject: delete it or mark as inactiva. Deleting is cleaner.
            await prisma.technicianCompetency.delete({
                where: { id: competencyId }
            });
        }

        // Audit Log
        await logAudit({
            userId,
            userName,
            action: approve ? 'APPROVE' : 'REJECT',
            entity: 'TECHNICIAN_COMPETENCY',
            entityId: competencyId,
            newValue: { approve }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
