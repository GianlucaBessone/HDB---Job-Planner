import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { INCLUIR_RESPONSABLE, comoAccionMejora } from '@/lib/acciones';
import { MENSAJE_ANULADO, puedeBorrarseSgi, totalVinculados } from '@/lib/sgi/bajas';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const opt = await prisma.oportunidad.findUnique({
            where: { id: params.id },
            include: { accionesMejora: { include: INCLUIR_RESPONSABLE } }
        });

        if (!opt) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 });

        return NextResponse.json({ ...opt, accionesMejora: opt.accionesMejora.map(comoAccionMejora) });
    } catch (error) {
        console.error('Error fetching Oportunidad details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        
        const currentOpt = await prisma.oportunidad.findUnique({ where: { id: params.id } });

        const opt = await prisma.oportunidad.update({
            where: { id: params.id },
            data: body
        });

        await logAudit({
            userId: auth.userId,
            action: 'UPDATE',
            entity: 'OPORTUNIDAD',
            entityId: opt.id,
            oldValue: currentOpt,
            newValue: opt
        });

        return NextResponse.json(opt);
    } catch (error) {
        console.error('Error updating Oportunidad:', error);
        return NextResponse.json({ error: 'Error al actualizar Oportunidad' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const opt = await prisma.oportunidad.findUnique({
            where: { id: params.id },
            include: { _count: { select: { accionesMejora: true } } },
        });
        if (!opt) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        const motivo = new URL(req.url).searchParams.get('motivo')?.trim() || null;
        const { _count, ...datos } = opt;

        // Recién creado y sin nada vinculado: se puede borrar (error de carga). Si no, se anula.
        if (!puedeBorrarseSgi(datos, 'Identificada', totalVinculados(_count))) {
            if (datos.estado === 'Anulada') return NextResponse.json({ error: 'Ya está anulado' }, { status: 409 });
            await prisma.oportunidad.update({ where: { id: params.id }, data: { estado: 'Anulada' } });
            await logAudit({
                userId: auth.userId,
                userName: auth.nombre,
                action: 'UPDATE',
                entity: 'OPORTUNIDAD',
                entityId: params.id,
                oldValue: { estado: datos.estado },
                newValue: { estado: 'Anulada' },
                metadata: { message: 'Anulado en lugar de eliminado', motivo, vinculados: _count },
            });
            return NextResponse.json({ success: true, modo: 'anulado', message: MENSAJE_ANULADO });
        }

        await prisma.oportunidad.delete({ where: { id: params.id } });
        await logAudit({
            userId: auth.userId,
            userName: auth.nombre,
            action: 'DELETE',
            entity: 'OPORTUNIDAD',
            entityId: params.id,
            oldValue: datos,
            metadata: { motivo },
        });
        return NextResponse.json({ success: true, modo: 'eliminado' });
    } catch (error) {
        console.error('Error deleting Oportunidad:', error);
        return NextResponse.json({ error: 'Error al eliminar Oportunidad' }, { status: 500 });
    }
}
