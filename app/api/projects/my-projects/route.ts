import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const all = searchParams.get('all') === 'true';
        const responsableId = searchParams.get('responsableId');

        let where: any = {
            estado: { notIn: ['finalizado'] }
        };

        if (!all) {
            if (!responsableId) {
                return NextResponse.json({ error: 'Falta responsableId' }, { status: 400 });
            }
            where.responsableId = responsableId;
        }

        const projects = await prisma.project.findMany({
            where,
            include: {
                client: true,
                responsableUser: {
                    select: { nombreCompleto: true }
                },
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
