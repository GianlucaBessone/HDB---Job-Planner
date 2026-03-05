import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const tags = await prisma.projectTag.findMany({
            orderBy: { name: 'asc' },
            include: { checklists: true }
        });
        return NextResponse.json(tags);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
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
