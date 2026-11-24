import { prisma } from '@/lib/prisma';

/**
 * "Mis tareas" unificado (auditoría, P31 / FU9, etapa 1). Tareas, acciones de mejora (CAPA) y planes de acción
 * de KPI son "algo que alguien tiene que hacer para una fecha", cada uno en su módulo y con sus estados. Acá se
 * leen juntos para la persona, con su origen, un estado común y el vencimiento. Las tablas no cambian.
 */

import type { EstadoComun, MiTarea } from '@/lib/misTareasTipos';
export type { EstadoComun, MiTarea, OrigenTarea } from '@/lib/misTareasTipos';

const fecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const corto = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Estados abiertos de cada origen (lo cerrado, completado o cancelado no se muestra). */
const ABIERTOS = {
    tarea: ['pendiente', 'en_progreso'],
    accion: ['Pendiente', 'En Progreso'],
    plan: ['Pendiente', 'En Curso'],
};

export async function misTareas(userId: string, ahora = new Date()): Promise<MiTarea[]> {
    const [tareas, acciones, planes] = await Promise.all([
        prisma.tarea
            .findMany({
                where: {
                    estado: { in: ABIERTOS.tarea },
                    OR: [{ creadorId: userId }, { involucrados: { some: { operatorId: userId } } }],
                },
                select: { id: true, titulo: true, estado: true, fechaVencimiento: true, project: { select: { nombre: true } } },
                take: 200,
            })
            .catch(() => []),
        prisma.accionMejora
            .findMany({
                where: { responsableId: userId, estado: { in: ABIERTOS.accion } },
                select: {
                    id: true,
                    codigoAccion: true,
                    descripcion: true,
                    estado: true,
                    origen: true,
                    fechaCompromiso: true,
                    noConformidad: { select: { codigoNC: true } },
                    sugerencia: { select: { titulo: true } },
                    riesgo: { select: { codigo: true } },
                    oportunidad: { select: { codigo: true } },
                },
                take: 200,
            })
            .catch(() => []),
        prisma.planAccionKpi
            .findMany({
                where: { responsableId: userId, estado: { in: ABIERTOS.plan } },
                select: { id: true, descripcion: true, estado: true, fechaCompromiso: true, kpi: { select: { nombre: true } } },
                take: 200,
            })
            .catch(() => []),
    ]);

    const lista: MiTarea[] = [
        ...tareas.map((t) => ({
            id: t.id,
            origen: 'tarea' as const,
            origenDetalle: t.project?.nombre ? `Tarea · ${t.project.nombre}` : 'Tarea',
            titulo: t.titulo,
            estado: (t.estado === 'en_progreso' ? 'en_curso' : 'pendiente') as EstadoComun,
            vence: fecha(t.fechaVencimiento),
            vencida: !!t.fechaVencimiento && t.fechaVencimiento < ahora,
            href: '/tareas',
        })),
        ...acciones.map((a) => ({
            id: a.id,
            origen: 'accion_mejora' as const,
            origenDetalle:
                (a.noConformidad?.codigoNC && `No conformidad ${a.noConformidad.codigoNC}`) ||
                (a.sugerencia && 'Sugerencia') ||
                (a.riesgo && `Riesgo${a.riesgo.codigo ? ` ${a.riesgo.codigo}` : ''}`) ||
                (a.oportunidad && `Oportunidad${a.oportunidad.codigo ? ` ${a.oportunidad.codigo}` : ''}`) ||
                a.origen ||
                'Acción de mejora',
            titulo: [a.codigoAccion, corto(a.descripcion)].filter(Boolean).join(' · '),
            estado: (a.estado === 'En Progreso' ? 'en_curso' : 'pendiente') as EstadoComun,
            vence: fecha(a.fechaCompromiso),
            vencida: !!a.fechaCompromiso && a.fechaCompromiso < ahora,
            href: '/calidad?tab=capa',
        })),
        ...planes.map((p) => ({
            id: p.id,
            origen: 'plan_kpi' as const,
            origenDetalle: `KPI ${p.kpi.nombre}`,
            titulo: corto(p.descripcion),
            estado: (p.estado === 'En Curso' ? 'en_curso' : 'pendiente') as EstadoComun,
            vence: fecha(p.fechaCompromiso),
            vencida: !!p.fechaCompromiso && p.fechaCompromiso < ahora,
            href: '/okr-kpi?tab=planes',
        })),
    ];

    // Vencidas primero; después por fecha (sin fecha al final)
    return lista.sort((a, b) => {
        if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
        if (a.vence && b.vence) return a.vence.localeCompare(b.vence);
        if (a.vence) return -1;
        if (b.vence) return 1;
        return a.titulo.localeCompare(b.titulo);
    });
}
