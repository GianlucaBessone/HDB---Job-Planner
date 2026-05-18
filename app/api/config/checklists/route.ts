import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/config/checklists - Vincular una plantilla de checklist a una etiqueta
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tagId, checklistTemplateId } = body;

        if (!tagId || !checklistTemplateId) {
            return NextResponse.json({ error: 'tagId y checklistTemplateId son requeridos' }, { status: 400 });
        }

        // Evitar duplicados
        const existing = await prisma.tagChecklistTemplate.findUnique({
            where: {
                tagId_checklistTemplateId: {
                    tagId,
                    checklistTemplateId
                }
            }
        });

        if (existing) {
            return NextResponse.json(existing);
        }

        const link = await prisma.tagChecklistTemplate.create({
            data: {
                tagId,
                checklistTemplateId
            },
            include: {
                checklistTemplate: true
            }
        });

        return NextResponse.json(link);
    } catch (error: any) {
        console.error('Error linking template to tag:', error);
        return NextResponse.json({ error: 'Error al vincular plantilla a etiqueta', details: error.message }, { status: 500 });
    }
}

// DELETE /api/config/checklists - Desvincular plantilla de una etiqueta
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tagId = searchParams.get('tagId');
        const checklistTemplateId = searchParams.get('checklistTemplateId');
        const id = searchParams.get('id');

        if (tagId && checklistTemplateId) {
            await prisma.tagChecklistTemplate.deleteMany({
                where: { tagId, checklistTemplateId }
            });
            return NextResponse.json({ success: true });
        } else if (id) {
            await prisma.tagChecklistTemplate.delete({
                where: { id }
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'tagId y checklistTemplateId, o id son requeridos' }, { status: 400 });
    } catch (error: any) {
        console.error('Error unlinking template from tag:', error);
        return NextResponse.json({ error: 'Error al desvincular plantilla', details: error.message }, { status: 500 });
    }
}
