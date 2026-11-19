import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const { userId } = acceso;

        const adjunto = await prisma.ticketAdjunto.findUnique({
            where: { id },
            include: { ticket: { select: { reportadoPorId: true } } },
        });

        // Lo ve quien lo subió, el autor del ticket o un gestor. Si no, 404 para no revelar que existe.
        const puedeVer = adjunto && (
            acceso.puede('tickets.gestionar') ||
            adjunto.subidoPorId === userId ||
            adjunto.ticket?.reportadoPorId === userId
        );

        if (!adjunto || !puedeVer) {
            return NextResponse.json({ error: 'Adjunto no encontrado.' }, { status: 404 });
        }

        return new NextResponse(new Uint8Array(adjunto.datos), {
            headers: {
                'Content-Type': adjunto.mime,
                'Content-Length': String(adjunto.size),
                'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[TICKETS_ADJUNTO_GET]', error);
        return NextResponse.json({ error: 'Error al obtener el adjunto.' }, { status: 500 });
    }
}
