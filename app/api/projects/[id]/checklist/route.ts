import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

        // 1.5 Get checklists from QMS controlled documents assigned to these tags
        const qmsDocuments = await prisma.controlledDocument.findMany({
            where: {
                estado: 'vigente',
                // We'll filter tags in JS because JSON array querying is complex across DB engines
            },
            include: {
                versions: {
                    where: { estado: 'vigente' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // 2. Get existing items
        const existingItems = await prisma.checklistItem.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'asc' }
        });

        // 3. Sync: If new tags added, create new items
        let newlyCreated = false;
        
        // Find documents that match project tags
        const matchedDocs = qmsDocuments.filter(doc => {
            const docTags = (doc.tags as string[]) || [];
            return projectTags.some(pt => docTags.includes(pt));
        });

        // Extract checklists from matched documents
        let documentChecklistItems: { tag: string, description: string }[] = [];
        matchedDocs.forEach(doc => {
            if (doc.versions && doc.versions.length > 0) {
                const version = doc.versions[0];
                const template = version.checklistTemplate as any[];
                if (Array.isArray(template)) {
                    // We assign the first matching tag from the document for the item's tag categorization
                    const primaryTag = Array.isArray(doc.tags) && doc.tags.length > 0 ? String(doc.tags[0]) : 'General';
                    template.forEach(item => {
                        if (item.descripcion) {
                            documentChecklistItems.push({
                                tag: primaryTag,
                                description: item.descripcion
                            });
                        }
                    });
                }
            }
        });

        // Create missing checklist items
        for (const item of documentChecklistItems) {
            const alreadyExists = existingItems.find(ex => ex.description === item.description);
            if (!alreadyExists) {
                await prisma.checklistItem.create({
                    data: {
                        projectId: id,
                        tag: item.tag,
                        description: item.description,
                        completed: false
                    }
                });
                newlyCreated = true;
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
        const { itemId, completed, excluded, justification, requestChange } = body;

        const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
        if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });

        // Logic for confirmation/locking
        // Excluded items can be toggled by supervisors even if confirmed?
        // Let's allow excluding even if confirmed for now, as it's a supervisor action.

        if (item.confirmedBySupervisor && !requestChange && excluded === undefined) {
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
                excluded: excluded !== undefined ? excluded : item.excluded,
                updatedAt: new Date()
            }
        });

        // If the project is already finalized and flagged with pending items, 
        // we re-evaluate in case this change resolved the pending status (e.g. was excluded or completed)
        const project = await prisma.project.findUnique({
            where: { id: params.id },
            include: { checklistItems: true }
        });

        if (project && project.estado === 'finalizado' && project.finalizadoConPendientes) {
            const activeTags = (project.tags as string[]) || [];
            const activeChecklist = project.checklistItems.filter(i => activeTags.includes(i.tag) && !i.excluded);
            const pendingItems = activeChecklist.filter(i => !i.completed);

            if (pendingItems.length === 0) {
                await prisma.project.update({
                    where: { id: project.id },
                    data: { finalizadoConPendientes: false, pendientesSnapshot: null }
                });
            }
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Checklist PATCH error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
