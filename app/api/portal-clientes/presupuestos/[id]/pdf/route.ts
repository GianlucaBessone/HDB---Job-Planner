import { NextResponse } from 'next/server';
import { normalizarOpcionesDocumento } from '@/lib/presupuestosServicio/calculos';
import { cargarVersion, renderPdfPresupuesto } from '@/lib/presupuestosServicio/pdf';
import { presupuestoDelCliente, responsablePortal } from '@/lib/portalCompleto';

export const dynamic = 'force-dynamic';

/** GET /api/portal-clientes/presupuestos/[id]/pdf — el mismo PDF que se envió (opciones guardadas de la revisión). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const r = await responsablePortal(req);
    if (r instanceof NextResponse) return r;
    const { id } = await params;
    try {
        const p = await presupuestoDelCliente(r, id);
        if (!p) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
        const v = await cargarVersion(id, p.versionActual);
        if (!v || v.estado === 'borrador') return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
        const buffer = await renderPdfPresupuesto(p, v, normalizarOpcionesDocumento(v.opcionesDocumento));
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${encodeURIComponent(`Presupuesto_${p.numero}_rev${v.version}.pdf`)}"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (e) {
        console.error('Error en portal/presupuestos/pdf:', e);
        return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
    }
}
