import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MENSAJE_ANULADO, puedeBorrarseSgi, totalVinculados } from '@/lib/sgi/bajas';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { INCLUIR_RESPONSABLE, WHERE_ACCION_MEJORA, asignarResponsable, comoAccionMejora, datosTareaDesdeAccion, origenDeAccion } from '@/lib/acciones';

export const dynamic = 'force-dynamic';

/** Acción de mejora (CAPA) = tarea con tipo de acción (P31). */
async function buscar(id: string) {
    return prisma.tarea.findFirst({ where: { id, ...WHERE_ACCION_MEJORA }, include: INCLUIR_RESPONSABLE });
}

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const accion = await prisma.tarea.findFirst({
            where: { id: params.id, ...WHERE_ACCION_MEJORA },
            include: { ...INCLUIR_RESPONSABLE, noConformidad: true, sugerencia: true, verificaciones: true },
        });
        if (!accion) return NextResponse.json({ error: 'Acción CAPA no encontrada' }, { status: 404 });
        return NextResponse.json(comoAccionMejora(accion));
    } catch (error) {
        console.error('Error fetching Accion CAPA details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const actual = await buscar(params.id);
        if (!actual) return NextResponse.json({ error: 'Acción CAPA no encontrada' }, { status: 404 });

        const datos = datosTareaDesdeAccion(body);
        if (['ncId', 'sugerenciaId', 'riesgoId', 'oportunidadId'].some((k) => body[k] !== undefined)) {
            datos.origenTipo = origenDeAccion({ ...actual, ...body });
        }
        const accion = await prisma.$transaction(async (tx) => {
            await tx.tarea.update({ where: { id: params.id }, data: datos });
            await asignarResponsable(tx, params.id, body.responsableId);
            return tx.tarea.findUniqueOrThrow({ where: { id: params.id }, include: INCLUIR_RESPONSABLE });
        });

        const resultado = comoAccionMejora(accion);
        await logAudit({ userId: auth.userId, action: 'UPDATE', entity: 'CAPA', entityId: accion.id, oldValue: comoAccionMejora(actual), newValue: resultado });
        return NextResponse.json(resultado);
    } catch (error) {
        console.error('Error updating Accion CAPA:', error);
        return NextResponse.json({ error: 'Error al actualizar Acción CAPA' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const tarea = await prisma.tarea.findFirst({
            where: { id: params.id, ...WHERE_ACCION_MEJORA },
            include: { ...INCLUIR_RESPONSABLE, _count: { select: { verificaciones: true } } },
        });
        if (!tarea) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        const motivo = new URL(req.url).searchParams.get('motivo')?.trim() || null;
        const { _count, ...resto } = tarea;
        const datos = comoAccionMejora(resto);

        // Recién creada y sin nada vinculado: se puede borrar (error de carga). Si no, se anula.
        if (!puedeBorrarseSgi(datos, 'Pendiente', totalVinculados(_count))) {
            if (datos.estado === 'Anulada') return NextResponse.json({ error: 'Ya está anulado' }, { status: 409 });
            await prisma.tarea.update({ where: { id: params.id }, data: { estado: 'anulada' } });
            await logAudit({
                userId: auth.userId,
                userName: auth.nombre,
                action: 'UPDATE',
                entity: 'CAPA',
                entityId: params.id,
                oldValue: { estado: datos.estado },
                newValue: { estado: 'Anulada' },
                metadata: { message: 'Anulado en lugar de eliminado', motivo, vinculados: _count },
            });
            return NextResponse.json({ success: true, modo: 'anulado', message: MENSAJE_ANULADO });
        }

        await prisma.tarea.delete({ where: { id: params.id } });
        await logAudit({ userId: auth.userId, userName: auth.nombre, action: 'DELETE', entity: 'CAPA', entityId: params.id, oldValue: datos, metadata: { motivo } });
        return NextResponse.json({ success: true, modo: 'eliminado' });
    } catch (error) {
        console.error('Error deleting Accion CAPA:', error);
        return NextResponse.json({ error: 'Error al eliminar Acción CAPA' }, { status: 500 });
    }
}
