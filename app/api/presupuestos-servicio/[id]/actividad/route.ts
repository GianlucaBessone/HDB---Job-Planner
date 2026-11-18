import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesion, responderError } from '@/lib/presupuestosServicio/sesion';

export const dynamic = 'force-dynamic';

/** GET: actividad del presupuesto registrada en Auditoría (más reciente primero). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.ver']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        const logs = await prisma.auditLog.findMany({
            where: { entity: 'PRESUPUESTO_SERVICIO', entityId: id },
            orderBy: { timestamp: 'desc' },
            take: 100,
            select: { id: true, action: true, userName: true, timestamp: true, oldValue: true, newValue: true, metadata: true },
        });
        return NextResponse.json(logs, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/actividad');
    }
}
