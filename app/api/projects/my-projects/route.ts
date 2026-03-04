import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const responsableId = searchParams.get('responsableId');

        if (!responsableId) {
            return NextResponse.json({ error: 'Falta responsableId' }, { status: 400 });
        }

        const projects = await prisma.project.findMany({
            where: {
                responsableId: responsableId,
                estado: { notIn: ['finalizado'] } // Only active/pending close etc.
            },
            include: {
                client: true,
                _count: {
                    select: { checklistItems: true }
                },
                checklistItems: {
                    select: { completed: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching my projects:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
