import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

export async function POST() {
    try {
        const projects = await prisma.project.findMany({
            select: { id: true, nombre: true, tags: true }
        });

        // Get QMS Controlled Documents
        const qmsDocuments = await prisma.controlledDocument.findMany({
            where: { estado: 'vigente' },
            include: {
                versions: {
                    where: { estado: 'vigente' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        let totalCreated = 0;

        for (const proj of projects) {
            const tags = (proj.tags as string[]) || [];
            if (!Array.isArray(tags) || tags.length === 0) continue;

            const existingItems = await prisma.checklistItem.findMany({
                where: { projectId: proj.id },
                select: { tag: true, description: true }
            });

            // Find documents that match project tags
            const matchedDocs = qmsDocuments.filter(doc => {
                const docTags = (doc.tags as string[]) || [];
                return tags.some(pt => docTags.includes(pt));
            });

            let documentChecklistItems: { tag: string, description: string }[] = [];
            matchedDocs.forEach(doc => {
                if (doc.versions && doc.versions.length > 0) {
                    const version = doc.versions[0];
                    const template = version.checklistTemplate as any[];
                    if (Array.isArray(template)) {
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

            for (const item of documentChecklistItems) {
                const exists = existingItems.find(i => i.description === item.description);
                if (!exists) {
                    await prisma.checklistItem.create({
                        data: {
                            projectId: proj.id,
                            tag: item.tag,
                            description: item.description,
                            completed: false
                        }
                    });
                    totalCreated++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sincronización completada. ${totalCreated} ítems de checklist creados.`,
            created: totalCreated
        });
    } catch (error) {
        console.error('Sync checklists error:', error);
        return NextResponse.json({ error: 'Error al sincronizar', details: String(error) }, { status: 500 });
    }
}
