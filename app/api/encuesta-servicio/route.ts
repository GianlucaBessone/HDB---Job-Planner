import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// POST /api/encuesta-servicio — Guardar encuesta de satisfacción
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { ordenServicioId, atencion, calidad, tiempo, nps, comentario } = body;

        if (!ordenServicioId || atencion == null || calidad == null || tiempo == null || nps == null) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        // Validate ranges
        if (atencion < 1 || atencion > 10 || calidad < 1 || calidad > 10 || tiempo < 1 || tiempo > 10) {
            return NextResponse.json({ error: 'Las calificaciones CSAT deben estar entre 1 y 10' }, { status: 400 });
        }
        if (nps < 0 || nps > 10) {
            return NextResponse.json({ error: 'El NPS debe estar entre 0 y 10' }, { status: 400 });
        }

        // Find OS by id or linkPublico
        const os = await prisma.ordenServicio.findFirst({
            where: { OR: [{ id: ordenServicioId }, { linkPublico: ordenServicioId }] },
            select: { id: true, projectId: true, estado: true }
        });

        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
        if (os.estado !== 'firmada') {
            return NextResponse.json({ error: 'Solo se puede encuestar una OS firmada' }, { status: 400 });
        }

        // Check if already answered
        const existing = await prisma.encuestaServicio.findUnique({ where: { ordenServicioId: os.id } });
        if (existing) {
            return NextResponse.json({ error: 'Ya existe una encuesta para esta OS' }, { status: 409 });
        }

        const encuesta = await prisma.encuestaServicio.create({
            data: {
                ordenServicioId: os.id,
                proyectoId: os.projectId,
                atencion: parseInt(atencion),
                calidad: parseInt(calidad),
                tiempo: parseInt(tiempo),
                nps: parseInt(nps),
                comentario: comentario?.trim() || null,
            }
        });

        return NextResponse.json({ success: true, encuesta });
    } catch (e) {
        console.error('POST encuesta-servicio error:', e);
        return NextResponse.json({ error: 'Error al guardar la encuesta', details: String(e) }, { status: 500 });
    }
}
