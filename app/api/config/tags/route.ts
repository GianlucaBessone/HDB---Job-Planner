import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const forceSeed = searchParams.get('seed') === 'true';

        const targetTags = [
            "Seguridad eléctrica",
            "Trabajo en altura",
            "Protocolo sanitario",
            "Instalación dispenser",
            "Mantenimiento refrigeración"
        ];

        const count = await prisma.projectTag.count({
            where: { name: { in: targetTags } }
        });

        if (count < 5 || forceSeed) {
            // Reseed tags
            await prisma.projectTag.deleteMany({});
            for (const tagName of targetTags) {
                const items = CHECKLIST_TEMPLATES[tagName] || [];
                await prisma.projectTag.create({
                    data: {
                        name: tagName,
                        active: true,
                        impactsMetrics: true,
                        checklists: {
                            create: items.map((item, index) => ({
                                description: item,
                                active: true,
                                order: index
                            }))
                        }
                    }
                });
            }
        }

        const tags = await prisma.projectTag.findMany({
            orderBy: { name: 'asc' },
            include: { 
                checklists: true,
                templates: {
                    include: {
                        checklistTemplate: true
                    }
                }
            }
        });
        return NextResponse.json(tags);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch tags', details: error.message || String(error) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const tag = await prisma.projectTag.create({
            data: {
                name: body.name,
                active: body.active !== undefined ? body.active : true,
                impactsMetrics: body.impactsMetrics !== undefined ? body.impactsMetrics : false,
            }
        });
        return NextResponse.json(tag);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const tag = await prisma.projectTag.update({
            where: { id: body.id },
            data: {
                name: body.name,
                active: body.active,
                impactsMetrics: body.impactsMetrics,
            }
        });
        return NextResponse.json(tag);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        await prisma.projectTag.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
