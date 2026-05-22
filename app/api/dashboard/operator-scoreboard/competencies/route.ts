import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const PREDEFINED_SKILLS = [
    { name: 'Programación de PLC', weight: 10, category: 'Automatización' },
    { name: 'Automatización Industrial', weight: 9, category: 'Automatización' },
    { name: 'Electricidad Industrial', weight: 8, category: 'Eléctrica' },
    { name: 'Técnico de Dispensers', weight: 6, category: 'Mecánica/Dispensers' },
    { name: 'Instalaciones de Baja Tensión', weight: 5, category: 'Eléctrica' },
    { name: 'Seguridad Eléctrica y NFPA 70E', weight: 8, category: 'Seguridad' },
    { name: 'Trabajo en Altura', weight: 4, category: 'Seguridad' },
    { name: 'Mantenimiento Preventivo', weight: 4, category: 'Mantenimiento' }
];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const operatorId = searchParams.get('operatorId');
        if (!operatorId) {
            return NextResponse.json({ error: 'El ID de operador es obligatorio.' }, { status: 400 });
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
