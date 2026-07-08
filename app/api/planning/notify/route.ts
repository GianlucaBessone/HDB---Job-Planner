import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

export async function POST(req: Request) {
    const { fecha, blocks } = await req.json();

    try {
        // 1. Archive previous activities for this planning date
        await prisma.activityRecipient.updateMany({
            where: {
                activity: {
                    type: 'PLANNING_ASSIGNMENT',
                    entityId: fecha
                }
            },
            data: { archivedAt: new Date() }
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
                type: 'PLANNING_ASSIGNMENT',
                priority: 'NORMAL',
                category: 'System',
                title: `Planificación Asignada`,
                message: `Tienes ${opAssignments.length} asignaciones para el ${fecha}. Toca para ver los detalles.`,
                entityType: 'planning',
                entityId: fecha,
                metadata: {
                    fecha,
                    assignments: opAssignments,
                    notes: globalNotes
                },
                operatorId: opId // Keep this for recipient mapping later
            });
        }

        // 2. Summary for Administrators
        const administrators = await prisma.operator.findMany({
            where: { role: { in: ['admin', 'qa'] } }
        });

        let summaryText = `Asignaciones publicadas para el ${fecha}:\n\n`;
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
                type: 'PLANNING_ASSIGNMENT_SUMMARY',
                priority: 'LOW',
                category: 'System',
                title: `Resumen Planificación`,
                message: summaryText,
                entityType: 'planning',
                entityId: fecha,
                metadata: {
                    fecha,
                    fullBlocks: blocks
                },
                operatorId: admin.id
            });
        }

        if (notificationsData.length > 0) {
            console.log("🔔 [INTERNAL_ACTIVITY] Generando actividades:", {
                fecha,
                total: notificationsData.length,
                operatorIds: notificationsData.map(n => n.operatorId),
                types: notificationsData.map(n => n.type)
            });

            // Create activities one by one due to nested recipients
            await Promise.all(notificationsData.map(data => 
                prisma.activity.create({
                    data: {
                        type: data.type,
                        priority: data.priority,
                        category: data.category,
                        title: data.title,
                        message: data.message,
                        entityType: data.entityType,
                        entityId: data.entityId,
                        metadata: data.metadata,
                        recipients: { create: [{ operatorId: data.operatorId }] }
                    }
                })
            ));

            console.log("✅ [INTERNAL_ACTIVITY] Guardadas en DB correctamente");

            // Send push notifications - MUST await before returning response (Vercel compatibility)
            console.log("📡 [PUSH_DISPATCH_START] Sending", notificationsData.length, "push notifications");

            const pushResults = [];
            for (const notif of notificationsData) {
                console.log("📢 [PLANNING_NOTIFY_TRIGGER]", {
                    operatorId: notif.operatorId,
                    type: notif.type,
                    relatedId: notif.relatedId
                });

                try {
                    const result = await sendPushNotification({
                        userIds: notif.operatorId ? [notif.operatorId] : undefined,
                        forSupervisors: notif.forSupervisors || false,
                        title: notif.title,
                        message: notif.message,
                        data: {
                            type: notif.type,
                            relatedId: notif.relatedId,
                            metadata: notif.metadata
                        }
                    });
                    pushResults.push({ operatorId: notif.operatorId, success: true, result });
                } catch (e: any) {
                    console.error("❌ [PUSH_DISPATCH_ERROR]", {
                        operatorId: notif.operatorId,
                        error: e?.message || String(e)
                    });
                    pushResults.push({ operatorId: notif.operatorId, success: false, error: e?.message });
                }
            }

            console.log("📡 [PUSH_DISPATCH_COMPLETE]", {
                total: pushResults.length,
                successful: pushResults.filter(r => r.success).length,
                failed: pushResults.filter(r => !r.success).length,
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
