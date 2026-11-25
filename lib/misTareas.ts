import { prisma } from '@/lib/prisma';

/**
 * "Mis tareas" unificado (auditoría, P31 / FU9). Desde la etapa 2 todo vive en `Tarea`: las acciones de mejora
 * (CAPA) son tareas con tipo de acción y los planes de acción de KPI, tareas con KPI (`lib/acciones.ts`). Acá se
 * leen las de la persona con su origen, un estado común y el vencimiento.
 */

import type { EstadoComun, MiTarea, OrigenTarea } from '@/lib/misTareasTipos';
export type { EstadoComun, MiTarea, OrigenTarea } from '@/lib/misTareasTipos';

const fecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const corto = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const ABIERTAS = ['pendiente', 'en_progreso'];

const HREF: Record<OrigenTarea, string> = {
    tarea: '/tareas',
    accion_mejora: '/calidad/mejora?tab=capa',
    plan_kpi: '/okr-kpi?tab=planes',
};

export async function misTareas(userId: string, ahora = new Date()): Promise<MiTarea[]> {
    const involucrado = { involucrados: { some: { operatorId: userId } } };
    const tareas = await prisma.tarea
        .findMany({
            where: {
                estado: { in: ABIERTAS },
                // Las de calidad (CAPA, planes de KPI) son de su responsable; las comunes, también de quien las creó
                OR: [involucrado, { creadorId: userId, tipoAccion: null, kpiId: null }],
            },
            select: {
                id: true,
                titulo: true,
                descripcion: true,
                codigo: true,
                estado: true,
                fechaVencimiento: true,
                tipoAccion: true,
                origenDetalle: true,
                kpiId: true,
                project: { select: { nombre: true } },
                noConformidad: { select: { codigoNC: true } },
                sugerencia: { select: { titulo: true } },
                riesgo: { select: { codigo: true } },
                oportunidad: { select: { codigo: true } },
                kpi: { select: { nombre: true } },
            },
            take: 300,
        })
        .catch(() => []);

    const lista: MiTarea[] = tareas.map((t) => {
        const origen: OrigenTarea = t.kpiId ? 'plan_kpi' : t.tipoAccion ? 'accion_mejora' : 'tarea';
        const origenDetalle =
            origen === 'plan_kpi'
                ? `KPI ${t.kpi?.nombre ?? ''}`.trim()
                : origen === 'accion_mejora'
                  ? (t.noConformidad?.codigoNC && `No conformidad ${t.noConformidad.codigoNC}`) ||
                    (t.sugerencia && 'Sugerencia') ||
                    (t.riesgo && `Riesgo${t.riesgo.codigo ? ` ${t.riesgo.codigo}` : ''}`) ||
                    (t.oportunidad && `Oportunidad${t.oportunidad.codigo ? ` ${t.oportunidad.codigo}` : ''}`) ||
                    t.origenDetalle ||
                    'Acción de mejora'
                  : t.project?.nombre
                    ? `Tarea · ${t.project.nombre}`
                    : 'Tarea';
        const texto = origen === 'tarea' ? t.titulo : corto(t.descripcion || t.titulo);
        return {
            id: t.id,
            origen,
            origenDetalle,
            titulo: [origen === 'accion_mejora' ? t.codigo : null, texto].filter(Boolean).join(' · '),
            estado: (t.estado === 'en_progreso' ? 'en_curso' : 'pendiente') as EstadoComun,
            vence: fecha(t.fechaVencimiento),
            vencida: !!t.fechaVencimiento && t.fechaVencimiento < ahora,
            href: HREF[origen],
        };
    });

    // Vencidas primero; después por fecha (sin fecha al final)
    return lista.sort((a, b) => {
        if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
        if (a.vence && b.vence) return a.vence.localeCompare(b.vence);
        if (a.vence) return -1;
        if (b.vence) return 1;
        return a.titulo.localeCompare(b.titulo);
    });
}
