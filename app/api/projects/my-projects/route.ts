import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { ULTIMO_BLOQUEANTE, proyectoConSalud } from '@/lib/proyectos/salud';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const { searchParams } = new URL(req.url);
        const all = searchParams.get('all') === 'true';
        // "Mis proyectos" son los del usuario de la sesión (se ignoran ?responsableId y ?nombre).
        const responsableId = acceso.userId;
        const nombreCompleto = acceso.nombre;

        let where: any = {
            estado: { notIn: ['finalizado', 'archivado'] }
        };

        // "Mis proyectos": donde la persona es responsable (por id o, en los viejos, por nombre)
        // o está en el equipo asignado con una asignación vigente o futura.
        const hoy = new Date().toISOString().slice(0, 10);
        if (!responsableId) {
            return NextResponse.json({ error: 'Falta responsableId' }, { status: 400 });
        }
        const asignaciones = await prisma.proyectoAsignacion
            .findMany({ where: { operatorId: responsableId, fechaHasta: { gte: hoy } }, select: { projectId: true } })
            .catch(() => [] as { projectId: string }[]); // la tabla puede no existir en bases viejas
        const enEquipo = new Set(asignaciones.map(a => a.projectId));

        if (!all) {
            const orConditions: any[] = [{ responsableId }];
            if (nombreCompleto) orConditions.push({ responsableId: null, responsable: nombreCompleto });
            if (enEquipo.size) orConditions.push({ id: { in: Array.from(enEquipo) } });
            where.OR = orConditions;
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
                    select: { completed: true, excluded: true }
                },
                logs: ULTIMO_BLOQUEANTE,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Cómo participa la persona en cada proyecto, para mostrarlo en la lista
        const conRol = projects.map(proyecto => proyectoConSalud(proyecto)).map(p => ({
            ...p,
            miRol: p.responsableId === responsableId || (!p.responsableId && p.responsable === nombreCompleto)
                ? 'responsable'
                : enEquipo.has(p.id) ? 'equipo' : null,
        }));
        return NextResponse.json(conRol);
    } catch (error) {
        console.error('Error fetching my projects:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
