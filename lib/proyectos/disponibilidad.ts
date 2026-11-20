/**
 * Disponibilidad de operadores por día, para asignar el equipo de un proyecto.
 *
 * Fuentes (solo lectura): bloques de Planificación (Planning.blocks), equipo asignado a
 * otros proyectos (ProyectoAsignacion), viajes no cancelados y el indicador de vacaciones.
 * Las vacaciones no tienen fechas en el sistema: se informan como "de vacaciones hoy".
 */
import { prisma } from '@/lib/prisma';
import { esFecha, sumarDias, esDiaHabil } from '@/lib/presupuestosServicio/calculos';
import { ErrorNegocio } from '@/lib/presupuestosServicio/sesion';

export type TipoCelda = 'libre' | 'ocupado' | 'viaje';

export interface Celda {
    tipo: TipoCelda;
    horas: number;
    detalle: string[];
}

export interface DisponibilidadOperador {
    id: string;
    nombre: string;
    role: string;
    etiquetas: string[];
    enVacaciones: boolean;
    celdas: Record<string, Celda>;
    conflictos: number;
}

function horasEntre(inicio?: string | null, fin?: string | null): number {
    if (!inicio || !fin || !/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fin)) return 0;
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    let d = h2 * 60 + m2 - (h1 * 60 + m1);
    if (d < 0) d += 24 * 60;
    return Math.round((d / 60) * 100) / 100;
}

export async function calcularDisponibilidad(params: { desde: string; hasta: string; excluirProyectoId?: string | null; soloHabiles?: boolean }) {
    const { desde, hasta } = params;
    if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) throw new ErrorNegocio('Rango de fechas inválido');
    const dias: string[] = [];
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
        if (params.soloHabiles === false || esDiaHabil(f)) dias.push(f);
        if (dias.length > 62) throw new ErrorNegocio('El rango no puede superar dos meses');
    }

    const [operadores, plannings, asignaciones, viajes] = await Promise.all([
        prisma.operator.findMany({
            where: { activo: true, role: { not: 'vendedor' } },
            select: { id: true, nombreCompleto: true, role: true, etiquetas: true, enVacaciones: true },
            orderBy: { nombreCompleto: 'asc' },
        }),
        prisma.planning.findMany({ where: { fecha: { gte: desde, lte: hasta } }, select: { fecha: true, blocks: true } }),
        prisma.proyectoAsignacion.findMany({
            where: {
                fechaDesde: { lte: hasta },
                fechaHasta: { gte: desde },
                ...(params.excluirProyectoId ? { projectId: { not: params.excluirProyectoId } } : {}),
                project: { estado: { notIn: ['finalizado', 'cancelado'] } },
            },
            select: { operatorId: true, fechaDesde: true, fechaHasta: true, horasDia: true, project: { select: { codigoProyecto: true, nombre: true } } },
        }),
        prisma.viaje.findMany({
            where: { estado: { not: 'cancelado' }, fechaInicio: { lte: new Date(hasta + 'T00:00:00Z') }, fechaFin: { gte: new Date(desde + 'T00:00:00Z') } },
            select: { codigo: true, destino: true, fechaInicio: true, fechaFin: true, participantes: { select: { operatorId: true } } },
        }),
    ]);

    const mapa = new Map<string, DisponibilidadOperador>();
    for (const o of operadores) {
        const celdas: Record<string, Celda> = {};
        for (const d of dias) celdas[d] = { tipo: 'libre', horas: 0, detalle: [] };
        mapa.set(o.id, {
            id: o.id,
            nombre: o.nombreCompleto,
            role: o.role,
            etiquetas: Array.isArray(o.etiquetas) ? (o.etiquetas as unknown[]).filter((e): e is string => typeof e === 'string') : [],
            enVacaciones: o.enVacaciones,
            celdas,
            conflictos: 0,
        });
    }
    const marcar = (opId: string | null | undefined, dia: string, tipo: TipoCelda, horas: number, detalle: string) => {
        const op = opId ? mapa.get(opId) : undefined;
        const c = op?.celdas[dia];
        if (!c) return;
        if (tipo === 'viaje') c.tipo = 'viaje';
        else if (c.tipo === 'libre') c.tipo = 'ocupado';
        c.horas = Math.round((c.horas + horas) * 100) / 100;
        if (!c.detalle.includes(detalle)) c.detalle.push(detalle);
    };

    for (const p of plannings) {
        const bloques = Array.isArray(p.blocks) ? (p.blocks as any[]) : [];
        for (const b of bloques) {
            if (!b || b.isNoteOnly || !Array.isArray(b.operatorIds)) continue;
            if (params.excluirProyectoId && b.projectId === params.excluirProyectoId) continue;
            const h = horasEntre(b.startTime, b.endTime);
            const etiqueta = `${b.projectName || 'Planificación'}${h ? ` · ${h} h` : ''}`;
            for (const opId of b.operatorIds) marcar(opId, p.fecha, 'ocupado', h, etiqueta);
        }
    }
    for (const a of asignaciones) {
        const nombre = a.project.codigoProyecto || a.project.nombre;
        for (const d of dias) if (d >= a.fechaDesde && d <= a.fechaHasta) marcar(a.operatorId, d, 'ocupado', a.horasDia, `Asignado a ${nombre}`);
    }
    for (const v of viajes) {
        const ini = v.fechaInicio.toISOString().slice(0, 10);
        const fin = v.fechaFin.toISOString().slice(0, 10);
        for (const part of v.participantes) {
            for (const d of dias) if (d >= ini && d <= fin) marcar(part.operatorId, d, 'viaje', 0, `Viaje ${v.codigo} a ${v.destino}`);
        }
    }

    const lista = Array.from(mapa.values());
    for (const o of lista) o.conflictos = Object.values(o.celdas).filter((c) => c.tipo !== 'libre').length;
    return { dias, operadores: lista };
}
