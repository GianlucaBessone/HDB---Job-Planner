import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import {
    INCLUIR_RESPONSABLE,
    WHERE_ACCION_MEJORA,
    asignarResponsable,
    comoAccionMejora,
    datosTareaDesdeAccion,
    estadoTareaDesdeCapa,
    origenDeAccion,
    proximoCodigoCapa,
} from '@/lib/acciones';

export const dynamic = 'force-dynamic';

/** Acciones de mejora (CAPA): tareas con tipo de acción (P31). Mismo formato de respuesta que antes. */
export async function GET(req: NextRequest) {
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');
        const tipoAccion = searchParams.get('tipo');

        const where: any = { ...WHERE_ACCION_MEJORA };
        if (estado) where.estado = estadoTareaDesdeCapa(estado);
        if (tipoAccion) where.tipoAccion = tipoAccion;

        const acciones = await prisma.tarea.findMany({
            where,
            include: {
                ...INCLUIR_RESPONSABLE,
                noConformidad: { select: { id: true, codigoNC: true } },
                sugerencia: { select: { id: true, titulo: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(acciones.map(comoAccionMejora));
    } catch (error) {
        console.error('Error fetching Acciones CAPA:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();

        // Validation H-003
        if (!body.descripcion || !body.tipoAccion || !body.origen) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const accion = await prisma.$transaction(async (tx) => {
            const codigo = body.codigoAccion || (await proximoCodigoCapa(tx));
            const datos = datosTareaDesdeAccion({ ...body, codigoAccion: codigo, prioridad: body.prioridad || 'Media', estado: 'Pendiente' });
            const tarea = await tx.tarea.create({
                data: {
                    ...(datos as any),
                    titulo: datos.titulo as string,
                    origenTipo: origenDeAccion(body),
                    creadorId: auth.userId,
                    creadorNombre: auth.nombre,
                },
            });
            await asignarResponsable(tx, tarea.id, body.responsableId || null);
            return tx.tarea.findUniqueOrThrow({ where: { id: tarea.id }, include: INCLUIR_RESPONSABLE });
        });

        const resultado = comoAccionMejora(accion);
        await logAudit({ userId: auth.userId, action: 'CREATE', entity: 'CAPA', entityId: accion.id, newValue: resultado });
        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        console.error('Error creating Accion CAPA:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Acción CAPA' }, { status: 500 });
    }
}
