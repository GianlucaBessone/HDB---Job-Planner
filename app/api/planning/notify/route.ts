import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function POST(req: Request) {
    const { fecha, blocks } = await req.json();

    try {
        // 1. Delete previous notifications for this planning date
        await prisma.notification.deleteMany({
            where: {
                type: 'PLANNING_ASSIGNMENT',
                relatedId: fecha
            }
        });

        const notificationsData: any[] = [];
        const projects = await prisma.project.findMany();
        const projectMap = projects.reduce((acc, p) => ({ ...acc, [p.id]: p.nombre }), {} as Record<string, string>);

        const operatorBlocks: Record<string, any[]> = {};
        const globalNotes: any[] = [];
        const operatorIdsNotified: string[] = [];

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
                operatorBlocks[opId].push(assignmentInfo);
                if (!operatorIdsNotified.includes(opId)) operatorIdsNotified.push(opId);
            }
        }

        // Create individual notifications for operators
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

        // 2. Summary for Administrators
        const administrators = await prisma.operator.findMany({
            where: { role: 'admin' }
        });

        // Format summary message
        let summaryText = `Resumen de Planificación (${fecha}):\n`;
        const operatorIds = Object.keys(operatorBlocks);

        if (operatorIds.length > 0) {
            const notifiedOperators = await prisma.operator.findMany({
                where: { id: { in: operatorIds } }
            });

            for (const op of notifiedOperators) {
                const opAssignments = operatorBlocks[op.id];
                summaryText += `- ${op.nombreCompleto}: ${opAssignments.map(a => a.projectName).join(', ')}\n`;
            }
        } else {
            summaryText += "No hay asignaciones para esta fecha.";
        }

        for (const admin of administrators) {
            notificationsData.push({
                operatorId: admin.id,
                forSupervisors: false,
                title: `Resumen Planificación`,
                message: summaryText,
                type: 'PLANNING_ASSIGNMENT_SUMMARY',
                relatedId: fecha,
                metadata: {
                    fecha,
                    fullBlocks: blocks
                }
            });
        }

        if (notificationsData.length > 0) {
            await prisma.notification.createMany({
                data: notificationsData
            });
        }

        // Return the names of notified operators for the toast
        const notifiedNames = operatorIds.length > 0
            ? await prisma.operator.findMany({
                where: { id: { in: operatorIds } },
                select: { nombreCompleto: true }
            }).then(users => users.map(u => u.nombreCompleto))
            : [];

        return NextResponse.json({ success: true, notifiedCount: notifiedNames.length, notifiedNames });
    } catch (e) {
        console.error('Error generating notifications for planning: ', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
