import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { esGestorViajes } from '@/lib/viajes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = req.headers.get('x-user-id');
        const role = req.headers.get('x-user-role');
        if (!userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

        const comp = await prisma.viajeComprobante.findUnique({
            where: { id },
            include: {
                viaje: { select: { responsableId: true, participantes: { select: { operatorId: true } } } },
            },
        });

        // Lo ven gestores, quien lo subió y las personas del viaje. Si no, 404 para no revelar que existe.
        const puedeVer = comp && (
            esGestorViajes(role) ||
            comp.subidoPorId === userId ||
            comp.viaje?.responsableId === userId ||
            comp.viaje?.participantes.some(p => p.operatorId === userId)
        );
        if (!comp || !puedeVer) return NextResponse.json({ error: 'Comprobante no encontrado.' }, { status: 404 });

        return new NextResponse(new Uint8Array(comp.datos), {
            headers: {
                'Content-Type': comp.mime,
                'Content-Length': String(comp.size),
                'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(comp.nombre)}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[VIAJES_COMPROBANTE_GET]', error);
        return NextResponse.json({ error: 'Error al obtener el comprobante.' }, { status: 500 });
    }
}
