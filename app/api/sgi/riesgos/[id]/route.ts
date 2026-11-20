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
        const riesgo = await prisma.riesgo.findUnique({
            where: { id: params.id },
            include: { accionesMejora: true }
        });

        if (!riesgo) return NextResponse.json({ error: 'Riesgo no encontrado' }, { status: 404 });

        return NextResponse.json(riesgo);
    } catch (error) {
        console.error('Error fetching Riesgo details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        
        const currentRiesgo = await prisma.riesgo.findUnique({ where: { id: params.id } });

        const riesgo = await prisma.riesgo.update({
            where: { id: params.id },
            data: body
        });

        await logAudit({
            userId: auth.userId,
            action: 'UPDATE',
            entity: 'RIESGO',
            entityId: riesgo.id,
            oldValue: currentRiesgo,
            newValue: riesgo
        });

        return NextResponse.json(riesgo);
    } catch (error) {
        console.error('Error updating Riesgo:', error);
        return NextResponse.json({ error: 'Error al actualizar Riesgo' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const riesgo = await prisma.riesgo.findUnique({
            where: { id: params.id },
            include: { _count: { select: { accionesMejora: true } } },
        });
        if (!riesgo) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        const motivo = new URL(req.url).searchParams.get('motivo')?.trim() || null;
        const { _count, ...datos } = riesgo;

        // Recién creado y sin nada vinculado: se puede borrar (error de carga). Si no, se anula.
        if (!puedeBorrarseSgi(datos, 'Identificado', totalVinculados(_count))) {
            if (datos.estado === 'Anulado') return NextResponse.json({ error: 'Ya está anulado' }, { status: 409 });
            await prisma.riesgo.update({ where: { id: params.id }, data: { estado: 'Anulado' } });
            await logAudit({
                userId: auth.userId,
                userName: auth.nombre,
                action: 'UPDATE',
                entity: 'RIESGO',
                entityId: params.id,
                oldValue: { estado: datos.estado },
                newValue: { estado: 'Anulado' },
                metadata: { message: 'Anulado en lugar de eliminado', motivo, vinculados: _count },
            });
            return NextResponse.json({ success: true, modo: 'anulado', message: MENSAJE_ANULADO });
        }

        await prisma.riesgo.delete({ where: { id: params.id } });
        await logAudit({
            userId: auth.userId,
            userName: auth.nombre,
            action: 'DELETE',
            entity: 'RIESGO',
            entityId: params.id,
            oldValue: datos,
            metadata: { motivo },
        });
        return NextResponse.json({ success: true, modo: 'eliminado' });
    } catch (error) {
        console.error('Error deleting Riesgo:', error);
        return NextResponse.json({ error: 'Error al eliminar Riesgo' }, { status: 500 });
    }
}
