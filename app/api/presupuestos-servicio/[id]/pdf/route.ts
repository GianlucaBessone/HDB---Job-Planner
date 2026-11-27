import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesion, responderError, errorJson } from '@/lib/presupuestosServicio/sesion';
import { includeVersion } from '@/lib/presupuestosServicio/servicio';
import { normalizarOpcionesDocumento } from '@/lib/presupuestosServicio/calculos';
import { renderPdfPresupuesto } from '@/lib/presupuestosServicio/pdf';

export const dynamic = 'force-dynamic';

function bool(v: string | null, d: boolean): boolean {
    return v === null ? d : v === '1' || v === 'true';
}

/**
 * GET /api/presupuestos-servicio/[id]/pdf?version=&nivel=&cantidades=&horas=&tareas=&plazo=&condiciones=&download=
 * Sin parámetros de opciones usa las guardadas en la revisión (así el PDF enviado sale siempre igual).
 * Los parámetros permiten la vista previa en vivo antes de guardar.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.ver']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        const sp = new URL(req.url).searchParams;
        const p = await prisma.presupuestoServicio.findUnique({
            where: { id },
            include: { cliente: { select: { nombre: true, direccion: true, telefono: true, email: true } } },
        });
        if (!p) return errorJson(404, 'Presupuesto no encontrado');
        const numVersion = parseInt(sp.get('version') || '', 10) || p.versionActual;
        const v = await prisma.presupuestoServicioVersion.findUnique({
            where: { presupuestoId_version: { presupuestoId: id, version: numVersion } },
            include: includeVersion,
        });
        if (!v) return errorJson(404, 'Revisión no encontrada');

        const guardadas = normalizarOpcionesDocumento(v.opcionesDocumento);
        const opciones = normalizarOpcionesDocumento({
            nivel: sp.get('nivel') ? Number(sp.get('nivel')) : guardadas.nivel,
            cantidades: bool(sp.get('cantidades'), guardadas.cantidades),
            horas: bool(sp.get('horas'), guardadas.horas),
            tareas: bool(sp.get('tareas'), guardadas.tareas),
            plazo: bool(sp.get('plazo'), guardadas.plazo),
            condiciones: bool(sp.get('condiciones'), guardadas.condiciones),
        });

        const buffer = await renderPdfPresupuesto(p, v, opciones);
        const filename = `Presupuesto_${p.numero}_rev${v.version}.pdf`;
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${sp.get('download') === 'true' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/pdf');
    }
}
