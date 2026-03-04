import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const { force, userId } = await req.json();

        // 1. Get checklist and project
        const [project, checklist] = await Promise.all([
            prisma.project.findUnique({ where: { id } }),
            prisma.checklistItem.findMany({ where: { projectId: id } })
        ]);

        if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

        // 2. Filter checklist by active tags (Requirement 2.2: items of removed tags shouldn't block)
        const activeTags = (project.tags as string[]) || [];
        const activeChecklist = checklist.filter(item => activeTags.includes(item.tag));

        const pendingItems = activeChecklist.filter(item => !item.completed);

        if (pendingItems.length > 0 && !force) {
            return NextResponse.json({
                error: 'Existen verificaciones incompletas',
                pendingItems: pendingItems.map(p => ({ tag: p.tag, description: p.description }))
            }, { status: 400 });
        }

        // 3. Update project
        await prisma.project.update({
            where: { id },
            data: {
                estado: 'finalizado',
                fechaFin: new Date().toISOString().split('T')[0],
                finalizadoConPendientes: pendingItems.length > 0,
                pendientesSnapshot: pendingItems.length > 0 ? pendingItems : null,
            }
        });

        // Log who forced it if applicable
        console.log(`Proyecto ${id} finalizado por ${userId}${pendingItems.length > 0 ? ' CON PENDIENTES' : ''}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Project Finalization error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
