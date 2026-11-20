import type { Prisma, PrismaClient } from '@prisma/client';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Crea el checklist de avance técnico de un proyecto nuevo a partir de sus etiquetas:
 * ítems de las plantillas estáticas + los de la base (sin duplicar) y las copias de las
 * plantillas de checklist documentales vinculadas a cada etiqueta.
 *
 * Extraído sin cambios de dataLayer.createProject para poder usarlo dentro de una
 * transacción (wizard de proyectos). `db` puede ser el cliente o una transacción.
 */
export async function crearChecklistsPorEtiqueta(db: Db, projectId: string, tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    const tagTemplates = await db.projectTag.findMany({
        where: { name: { in: tags } },
        include: {
            checklists: { where: { active: true } },
            templates: {
                include: {
                    checklistTemplate: true,
                },
            },
        },
    });

    for (const tagName of tags) {
        // Merge: static + DB (deduplicate)
        const staticItems: string[] = (CHECKLIST_TEMPLATES as Record<string, string[]>)[tagName] || [];
        const dbTag = tagTemplates.find((t) => t.name === tagName);
        const dbItems: string[] = dbTag ? dbTag.checklists.map((c: any) => c.description) : [];
        const allDescriptions = Array.from(new Set([...staticItems, ...dbItems]));

        for (const desc of allDescriptions) {
            await db.checklistItem.create({
                data: {
                    projectId,
                    tag: tagName,
                    description: desc,
                    completed: false,
                },
            });
        }

        // Copias de las plantillas de checklist (ChecklistTemplate) vinculadas a la etiqueta
        if (dbTag?.templates) {
            let order = 0;
            for (const link of dbTag.templates) {
                const tmpl = link.checklistTemplate;
                if (tmpl.status !== 'active') continue;

                await db.documentChecklist.create({
                    data: {
                        projectId,
                        templateId: tmpl.id,
                        templateVersion: tmpl.version,
                        templateName: tmpl.name,
                        snapshotData: {
                            requiresEvidence: tmpl.requiresEvidence,
                            requiresPhotos: tmpl.requiresPhotos,
                            requiresSignature: tmpl.requiresSignature,
                            riskLevel: tmpl.riskLevel,
                            items: tmpl.checklistItems,
                        } as any,
                        editable: false,
                        mandatory: true,
                        order: order++,
                        status: 'pending',
                    },
                });
            }
        }
    }
}
