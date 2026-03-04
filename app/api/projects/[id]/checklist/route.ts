import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        // 1. Get project and its tags
        const project = await prisma.project.findUnique({
            where: { id },
            select: { tags: true }
        });

        if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

        const projectTags = (project.tags as string[]) || [];

        // 2. Get existing items
        const existingItems = await prisma.checklistItem.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'asc' }
        });

        // 3. Sync: If new tags added, create new items (don't delete removed ones for traceability, but they might be filtered in UI)
        let newlyCreated = false;
        for (const tag of projectTags) {
            const templateItems = CHECKLIST_TEMPLATES[tag] || [];
            for (const desc of templateItems) {
                const alreadyExists = existingItems.find(item => item.tag === tag && item.description === desc);
                if (!alreadyExists) {
                    await prisma.checklistItem.create({
                        data: {
                            projectId: id,
                            tag,
                            description: desc,
                            completed: false
                        }
                    });
                    newlyCreated = true;
                }
            }
        }

        const finalItems = (newlyCreated
            ? await prisma.checklistItem.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' } })
            : existingItems).filter(item => projectTags.includes(item.tag));

        return NextResponse.json(finalItems);
    } catch (error) {
        console.error('Checklist GET error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { itemId, completed, justification, requestChange } = body;

        const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
        if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });

        // Logic for confirmation/locking
        if (item.confirmedBySupervisor && !requestChange) {
            return NextResponse.json({ error: 'Este ítem ya fue confirmado y no puede modificarse directamente.' }, { status: 403 });
        }

        if (requestChange) {
            // Flow similar to time modification request
            await prisma.checklistItem.update({
                where: { id: itemId },
                data: {
                    pendingChange: true,
                    justification: justification || 'Sin justificación'
                }
            });

            // Create a notification for supervisors (optional but recommended)
            return NextResponse.json({ message: 'Solicitud de modificación enviada' });
        }

        const updated = await prisma.checklistItem.update({
            where: { id: itemId },
            data: {
                completed: completed !== undefined ? completed : item.completed,
                updatedAt: new Date()
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Checklist PATCH error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
