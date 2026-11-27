import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { aprobarFinalizacionesDe } from '@/lib/solicitudes';
import { logAudit } from '@/lib/audit';

const bodySchema = z.object({
    /** Cerrar aunque queden verificaciones del checklist sin completar. */
    force: z.boolean().optional().default(false),
});

/**
 * Finaliza el proyecto. Pide `proyectos.finalizar`: quien no la tiene pide el cierre a un
 * supervisor (solicitud proyecto_finalizar). Usuario y permisos salen de la sesión.
 */
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        // Finaliza quien tiene la función; el responsable lo pide por aviso desde "Mis proyectos".
        const acceso = await exigirAcceso(req, ['proyectos.finalizar'], 'No tenés permiso para finalizar proyectos. Pedí la finalización a un supervisor.');
        if (acceso instanceof NextResponse) return acceso;

        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        }
        const { force } = parsed.data;
        const { id } = params;

        // 1. Get checklist and project
        const [project, checklist] = await Promise.all([
            prisma.project.findUnique({ where: { id } }),
            prisma.checklistItem.findMany({ where: { projectId: id } })
        ]);

        if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

        // 2. Filter checklist by active tags (Requirement 2.2: items of removed tags shouldn't block)
        const activeTags = (project.tags as string[]) || [];
        const activeChecklist = checklist.filter(item => activeTags.includes(item.tag) && !item.excluded);

        const pendingItems = activeChecklist.filter(item => !item.completed);

        if (pendingItems.length > 0 && !force) {
            return NextResponse.json({
                error: 'Existen verificaciones incompletas',
                pendingItems: pendingItems.map(p => ({ tag: p.tag, description: p.description }))
            }, { status: 400 });
        }

        // 3. Update project
        const fechaFin = new Date().toISOString().split('T')[0];
        await prisma.project.update({
            where: { id },
            data: {
                estado: 'finalizado',
                fechaFin,
                finalizadoConPendientes: pendingItems.length > 0,
                pendientesSnapshot: pendingItems.length > 0 ? pendingItems : null,
            }
        });

        // Quién lo cerró, y si fue con pendientes
        await logAudit({
            userId: acceso.userId,
            userName: acceso.nombre,
            action: 'UPDATE',
            entity: 'PROJECT',
            entityId: id,
            oldValue: { estado: project.estado, fechaFin: project.fechaFin },
            newValue: { estado: 'finalizado', fechaFin },
            metadata: {
                accion: 'finalizar',
                conPendientes: pendingItems.length,
                pendientes: pendingItems.map(p => ({ tag: p.tag, description: p.description })),
            },
        });

        // Los pedidos de finalización pendientes quedan aprobados (y se avisa a quien los pidió)
        await aprobarFinalizacionesDe(id, acceso).catch((e) => console.error('No se pudieron cerrar las solicitudes de finalización:', e));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Project Finalization error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
