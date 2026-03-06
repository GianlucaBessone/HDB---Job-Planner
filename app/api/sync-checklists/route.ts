import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

export async function POST() {
    try {
        const projects = await prisma.project.findMany({
            select: { id: true, nombre: true, tags: true }
        });

        // Get DB templates too
        const allDbTags = await prisma.projectTag.findMany({
            include: { checklists: { where: { active: true } } }
        });

        let totalCreated = 0;

        for (const proj of projects) {
            const tags = (proj.tags as string[]) || [];
            if (!Array.isArray(tags) || tags.length === 0) continue;

            const existingItems = await prisma.checklistItem.findMany({
                where: { projectId: proj.id },
                select: { tag: true, description: true }
            });

            for (const tagName of tags) {
                const staticItems: string[] = CHECKLIST_TEMPLATES[tagName] || [];
                const dbTag = allDbTags.find(t => t.name === tagName);
                const dbItems: string[] = dbTag ? dbTag.checklists.map(c => c.description) : [];
                const allDescriptions = Array.from(new Set([...staticItems, ...dbItems]));

                for (const desc of allDescriptions) {
                    const exists = existingItems.find(i => i.tag === tagName && i.description === desc);
                    if (!exists) {
                        await prisma.checklistItem.create({
                            data: {
                                projectId: proj.id,
                                tag: tagName,
                                description: desc,
                                completed: false
                            }
                        });
                        totalCreated++;
                    }
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
