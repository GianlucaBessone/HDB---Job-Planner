import { NextResponse } from 'next/server';
import { generateObject } from '@/lib/ai';
import { ChecklistGenOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tipoTrabajo, etiquetas, categoria, normativa, userId, userName, userRole, saveAsTemplate } = body;

        if (!tipoTrabajo) {
            return NextResponse.json({ error: 'Falta parámetro obligatorio: tipoTrabajo.' }, { status: 400 });
        }

        // 1. Invocar el Servicio Centralizado de Checklist
        const aiResponse = await generateObject<ChecklistGenOutput>(
            'CHECKLIST_GEN',
            { 
                tipoTrabajo, 
                etiquetas: etiquetas || [], 
                categoria: categoria || 'General', 
                normativa: normativa || 'Normas internas HDB SGI' 
            },
            {
                userId,
                userName,
                userRole,
                entity: 'ChecklistTemplate',
                temperature: 0.3
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al generar checklist.' }, { status: 500 });
        }

        const checklist = aiResponse.data;

        // 2. Guardar en Base de Datos como plantilla si se requiere
        let savedTemplate = null;
        if (saveAsTemplate && userId) {
            // Formatear items para el JSON del template
            const formattedItems = checklist.items.map((item, index) => ({
                id: `ai-item-${index + 1}`,
                description: item.descripcion,
                esObligatorio: item.esObligatorio,
                requiresEvidence: item.requiereEvidencia,
                requiresPhotos: item.tipoEvidencia === 'foto',
                categoria: item.categoria
            }));

            // Crear el ChecklistTemplate
            savedTemplate = await prisma.checklistTemplate.create({
                data: {
                    name: checklist.titulo,
                    description: checklist.descripcion || `Checklist para ${tipoTrabajo} generado automáticamente por IA.`,
                    version: 1,
                    status: 'active',
                    requiresEvidence: checklist.items.some(i => i.requiereEvidencia),
                    requiresPhotos: checklist.items.some(i => i.tipoEvidencia === 'foto'),
                    requiresSignature: checklist.items.some(i => i.tipoEvidencia === 'firma'),
                    riskLevel: checklist.items.some(i => i.categoria === 'seguridad' && i.esObligatorio) ? 'high' : 'low',
                    checklistItems: formattedItems as any
                }
            });

            // Vincular con ProjectTags si existen
            if (etiquetas && etiquetas.length > 0) {
                for (const tagStr of etiquetas) {
                    // Buscar tag existente
                    const dbTag = await prisma.projectTag.findFirst({
                        where: { name: { equals: tagStr, mode: 'insensitive' } }
                    });

                    if (dbTag) {
                        await prisma.tagChecklistTemplate.create({
                            data: {
                                tagId: dbTag.id,
                                checklistTemplateId: savedTemplate.id
                            }
                        }).catch(e => console.error(`Error linking tag ${tagStr} to template:`, e));
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            checklist,
            templateDb: savedTemplate,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][GenerateChecklist] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
