import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { esFecha } from '@/lib/presupuestosServicio/calculos';
import { sesion, leerBody, responderError, errorJson, esTablaFaltante } from '@/lib/presupuestosServicio/sesion';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** GET: equipo asignado al proyecto. */
export async function GET(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        const a = await prisma.proyectoAsignacion.findMany({
            where: { projectId: id },
            include: { operator: { select: { id: true, nombreCompleto: true } } },
            orderBy: { createdAt: 'asc' },
        });
        return NextResponse.json(a, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        if (esTablaFaltante(e)) return NextResponse.json([]);
        return responderError(e, 'projects/[id]/asignaciones GET');
    }
}

const putSchema = z
    .object({
        operadores: z.array(z.string().trim().min(1).max(64)).max(100),
        fechaDesde: z.string().refine(esFecha, 'Fecha inválida'),
        fechaHasta: z.string().refine(esFecha, 'Fecha inválida'),
        horasDia: z.coerce.number().min(1).max(24).default(8),
    })
    .refine((d) => d.fechaHasta >= d.fechaDesde, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fechaHasta'] });

/** PUT: reemplaza el equipo asignado al proyecto. No modifica la planificación diaria. */
export async function PUT(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, putSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
        if (!project) return errorJson(404, 'Proyecto no encontrado');
        const ids = Array.from(new Set(body.data.operadores));
        const validos = await prisma.operator.count({ where: { id: { in: ids }, activo: true } });
        if (validos !== ids.length) return errorJson(400, 'Alguno de los operadores no existe o está inactivo');
        const antes = await prisma.proyectoAsignacion.findMany({ where: { projectId: id }, select: { operatorId: true, fechaDesde: true, fechaHasta: true } });
        await prisma.$transaction([
            prisma.proyectoAsignacion.deleteMany({ where: { projectId: id } }),
            prisma.proyectoAsignacion.createMany({
                data: ids.map((operatorId) => ({
                    projectId: id, operatorId, fechaDesde: body.data.fechaDesde, fechaHasta: body.data.fechaHasta, horasDia: body.data.horasDia, creadoPorId: s.usuario.id,
                })),
            }),
        ]);
        await logAudit({
            userId: s.usuario.id,
            userName: s.usuario.nombre,
            action: 'UPDATE',
            entity: 'PROYECTO_ASIGNACION',
            entityId: id,
            oldValue: antes,
            newValue: { operadores: ids, fechaDesde: body.data.fechaDesde, fechaHasta: body.data.fechaHasta, horasDia: body.data.horasDia },
        });
        return NextResponse.json({ success: true, message: 'Equipo actualizado' });
    } catch (e) {
        return responderError(e, 'projects/[id]/asignaciones PUT');
    }
}
