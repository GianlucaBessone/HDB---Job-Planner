import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { esMimeInline } from '@/lib/tipoArchivo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Pública, igual que la pizarra de /ideas-sugerencias-reclamos que lista las sugerencias.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const adjunto = await prisma.sugerenciaAdjunto.findUnique({ where: { id } });
        if (!adjunto) {
            return NextResponse.json({ error: 'Adjunto no encontrado.' }, { status: 404 });
        }

        // Imágenes y PDF se ven en el navegador; Office y texto se descargan siempre.
        const disposicion = esMimeInline(adjunto.mime) ? 'inline' : 'attachment';

        return new NextResponse(new Uint8Array(adjunto.datos), {
            headers: {
                'Content-Type': adjunto.mime,
                'Content-Length': String(adjunto.size),
                'Content-Disposition': `${disposicion}; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[SUGERENCIA_ADJUNTO_GET]', error);
        return NextResponse.json({ error: 'Error al obtener el adjunto.' }, { status: 500 });
    }
}
