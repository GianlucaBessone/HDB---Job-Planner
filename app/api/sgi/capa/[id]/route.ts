import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MENSAJE_ANULADO, puedeBorrarseSgi, totalVinculados } from '@/lib/sgi/bajas';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const accion = await prisma.accionMejora.findUnique({
            where: { id: params.id },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                noConformidad: true,
                sugerencia: true,
                verificaciones: true
            }
        });

        if (!accion) return NextResponse.json({ error: 'Acción CAPA no encontrada' }, { status: 404 });

        return NextResponse.json(accion);
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
        
        // Transform date strings back to Date objects if needed
        const dataToUpdate = { ...body };
        if (dataToUpdate.fechaInicio) dataToUpdate.fechaInicio = new Date(dataToUpdate.fechaInicio);
        if (dataToUpdate.fechaCompromiso) dataToUpdate.fechaCompromiso = new Date(dataToUpdate.fechaCompromiso);
        if (dataToUpdate.fechaCierre) dataToUpdate.fechaCierre = new Date(dataToUpdate.fechaCierre);

        const currentAction = await prisma.accionMejora.findUnique({ where: { id: params.id } });

        const accion = await prisma.accionMejora.update({
            where: { id: params.id },
            data: dataToUpdate
        });

        await logAudit({
            userId: auth.userId,
            action: 'UPDATE',
            entity: 'CAPA',
            entityId: accion.id,
            oldValue: currentAction,
            newValue: accion
        });

        return NextResponse.json(accion);
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
        const accion = await prisma.accionMejora.findUnique({
            where: { id: params.id },
            include: { _count: { select: { verificaciones: true } } },
        });
        if (!accion) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        const motivo = new URL(req.url).searchParams.get('motivo')?.trim() || null;
        const { _count, ...datos } = accion;

        // Recién creado y sin nada vinculado: se puede borrar (error de carga). Si no, se anula.
        if (!puedeBorrarseSgi(datos, 'Pendiente', totalVinculados(_count))) {
            if (datos.estado === 'Anulada') return NextResponse.json({ error: 'Ya está anulado' }, { status: 409 });
            await prisma.accionMejora.update({ where: { id: params.id }, data: { estado: 'Anulada' } });
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

        await prisma.accionMejora.delete({ where: { id: params.id } });
        await logAudit({
            userId: auth.userId,
            userName: auth.nombre,
            action: 'DELETE',
            entity: 'CAPA',
            entityId: params.id,
            oldValue: datos,
            metadata: { motivo },
        });
        return NextResponse.json({ success: true, modo: 'eliminado' });
    } catch (error) {
        console.error('Error deleting Accion CAPA:', error);
        return NextResponse.json({ error: 'Error al eliminar Acción CAPA' }, { status: 500 });
    }
}
