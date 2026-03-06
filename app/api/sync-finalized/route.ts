import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function POST() {
    try {
        const finalized = await prisma.project.findMany({
            where: { estado: 'finalizado', finalizadoConPendientes: true },
            include: { checklistItems: true }
        });

        let fixed = 0;

        for (const proj of finalized) {
            const activeTags = (proj.tags as string[]) || [];
            const activeChecklist = proj.checklistItems.filter(i => activeTags.includes(i.tag) && !i.excluded);
            const pendingItems = activeChecklist.filter(i => !i.completed);

            if (pendingItems.length === 0) {
                await prisma.project.update({
                    where: { id: proj.id },
                    data: { finalizadoConPendientes: false, pendientesSnapshot: null }
                });
                fixed++;
                console.log('Fixed project pending state:', proj.nombre);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Revisión completada. ${fixed} proyectos corregidos.`,
            fixedCount: fixed
        });
    } catch (error) {
        console.error('Sync finalized error:', error);
        return NextResponse.json({ error: 'Error al revisar', details: String(error) }, { status: 500 });
    }
}
