import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const item = await prisma.tagChecklistItem.create({
            data: {
                tagId: body.tagId,
                description: body.description,
                active: body.active !== undefined ? body.active : true,
                order: body.order || 0,
            }
        });
        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const item = await prisma.tagChecklistItem.update({
            where: { id: body.id },
            data: {
                description: body.description,
                active: body.active,
                order: body.order,
            }
        });
        return NextResponse.json(item);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await prisma.tagChecklistItem.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
    }
}
