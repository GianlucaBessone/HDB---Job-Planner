import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// GET /api/encuesta-servicio/[osId] — Obtener encuesta por OS id o token
export async function GET(req: Request, { params }: { params: { osId: string } }) {
    const { osId } = params;
    try {
        const os = await prisma.ordenServicio.findFirst({
            where: { OR: [{ id: osId }, { linkPublico: osId }] },
            select: { id: true }
        });
        if (!os) return NextResponse.json({ error: 'OS no encontrada' }, { status: 404 });

        const encuesta = await prisma.encuestaServicio.findUnique({
            where: { ordenServicioId: os.id }
        });

        if (!encuesta) return NextResponse.json(null);
        return NextResponse.json(encuesta);
    } catch (e) {
        console.error('GET encuesta-servicio error:', e);
        return NextResponse.json({ error: 'Error al obtener la encuesta', details: String(e) }, { status: 500 });
    }
}
