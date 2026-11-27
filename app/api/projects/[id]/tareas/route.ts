import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sesion, leerBody, responderError, errorJson, esTablaFaltante } from '@/lib/presupuestosServicio/sesion';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** GET: tareas del proyecto (vacío para proyectos creados sin el asistente). */
export async function GET(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        const tareas = await prisma.proyectoTarea.findMany({ where: { projectId: id }, orderBy: { orden: 'asc' } });
        // Horas reales por tarea: registros de horas que indican la tarea (sin devoluciones)
        const sumas = tareas.length
            ? await prisma.timeEntry.groupBy({ by: ['proyectoTareaId'], where: { projectId: id, isDevolucion: false, proyectoTareaId: { in: tareas.map((t) => t.id) } }, _sum: { horasTrabajadas: true } })
            : [];
        const reales = new Map(sumas.map((x) => [x.proyectoTareaId, Math.round((x._sum.horasTrabajadas || 0) * 100) / 100]));
        return NextResponse.json(tareas.map((t) => ({ ...t, horasReales: reales.get(t.id) ?? 0 })), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        if (esTablaFaltante(e)) return NextResponse.json([]);
        return responderError(e, 'projects/[id]/tareas GET');
    }
}

const patchSchema = z.object({ tareaId: z.string().trim().min(1).max(64), completada: z.boolean() });

/** PATCH: marca o desmarca una tarea como hecha. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, patchSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const antes = await prisma.proyectoTarea.findFirst({ where: { id: body.data.tareaId, projectId: id } });
        if (!antes) return errorJson(404, 'Tarea no encontrada');
        const t = await prisma.proyectoTarea.update({
            where: { id: antes.id },
            data: body.data.completada
                ? { completada: true, completadaEn: new Date(), completadaPorId: s.usuario.id }
                : { completada: false, completadaEn: null, completadaPorId: null },
        });
        await logAudit({
            userId: s.usuario.id,
            userName: s.usuario.nombre,
            action: 'UPDATE',
            entity: 'PROYECTO_TAREA',
            entityId: t.id,
            oldValue: { completada: antes.completada },
            newValue: { completada: t.completada, descripcion: t.descripcion },
            metadata: { projectId: id },
        });
        return NextResponse.json(t);
    } catch (e) {
        return responderError(e, 'projects/[id]/tareas PATCH');
    }
}
