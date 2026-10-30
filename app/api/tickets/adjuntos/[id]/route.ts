import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GESTORES = ['admin', 'qa', 'supervisor'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = req.headers.get('x-user-id');
        const role = (req.headers.get('x-user-role') || '').toLowerCase();

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
        }

        const adjunto = await prisma.ticketAdjunto.findUnique({
            where: { id },
            include: { ticket: { select: { reportadoPorId: true } } },
        });

        // Lo ve quien lo subió, el autor del ticket o un gestor. Si no, 404 para no revelar que existe.
        const puedeVer = adjunto && (
            GESTORES.includes(role) ||
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
