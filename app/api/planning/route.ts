import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { prisma } from '@/lib/dataLayer';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const fecha = url.searchParams.get('fecha');
    if (!fecha) return NextResponse.json({ error: 'Fecha required' }, { status: 400 });
    const planning = await dataLayer.getPlanningByDate(fecha);
    return NextResponse.json(planning || { blocks: [] });
}

export async function POST(req: Request) {
    const { fecha, blocks } = await req.json();
    const planning = await dataLayer.savePlanning(fecha, blocks);

    // Create notifications for assigned operators
    try {
        // Find existing notifications for this planning date
        await prisma.notification.deleteMany({
            where: {
                type: 'PLANNING_ASSIGNMENT',
                relatedId: fecha
            }
        });

        const notificationsData: any[] = [];

        // Ensure we load project names for better notification messages
        const projects = await prisma.project.findMany();
        const projectMap = projects.reduce((acc, p) => ({ ...acc, [p.id]: p.nombre }), {} as Record<string, string>);

        // Extract operators and group their assignments
        const operatorBlocks: Record<string, any[]> = {};
        const globalNotes: any[] = [];

        for (const block of blocks) {
            if (block.isNoteOnly) {
                globalNotes.push(block);
                continue;
            }
            if (!block.projectId || !block.operatorIds) continue;

            const projName = projectMap[block.projectId] || 'un proyecto';
            const assignmentInfo = {
                projectId: block.projectId,
                projectName: projName,
                startTime: block.startTime,
                endTime: block.endTime,
                note: block.note,
                companionNames: block.operatorNames || []
            };

            for (const opId of block.operatorIds) {
                if (!operatorBlocks[opId]) operatorBlocks[opId] = [];
                // remove the operator themselves from companionNames if we can easily do it later, or pass them all
                operatorBlocks[opId].push(assignmentInfo);
            }
        }

        for (const opId of Object.keys(operatorBlocks)) {
            const opAssignments = operatorBlocks[opId];
            notificationsData.push({
                operatorId: opId,
                forSupervisors: false,
                title: `Planificación Asignada`,
                message: `Tienes ${opAssignments.length} asignaciones para el ${fecha}. Toca para ver los detalles.`,
                type: 'PLANNING_ASSIGNMENT',
                relatedId: fecha,
                metadata: {
                    fecha,
                    assignments: opAssignments,
                    notes: globalNotes
                }
            });
        }

        if (notificationsData.length > 0) {
            await prisma.notification.createMany({
                data: notificationsData
            });
        }
    } catch (e) {
        console.error('Error generating notifications for planning: ', e);
    }

    return NextResponse.json(planning);
}
