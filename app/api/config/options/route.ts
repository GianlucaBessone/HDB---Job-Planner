import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');

        let options;
        if (category) {
            options = await prisma.configOption.findMany({
                where: { category },
                orderBy: { order: 'asc' }
            });
        } else {
            options = await prisma.configOption.findMany({
                orderBy: [{ category: 'asc' }, { order: 'asc' }]
            });
        }
        return NextResponse.json(options);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config options' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const option = await prisma.configOption.create({
            data: {
                category: body.category,
                value: body.value,
                active: body.active !== undefined ? body.active : true,
                order: body.order || 0,
            }
        });
        return NextResponse.json(option);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const option = await prisma.configOption.update({
            where: { id: body.id },
            data: {
                category: body.category,
                value: body.value,
                active: body.active,
                order: body.order,
            }
        });
        return NextResponse.json(option);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await prisma.configOption.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
    }
}
