import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { opcionesDocumentoSchema } from '@/lib/presupuestosServicio/schemas';
import { guardarOpcionesDocumento } from '@/lib/presupuestosServicio/servicio';
import type { OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';

export const dynamic = 'force-dynamic';

/** PUT: guarda nivel de detalle y opciones del documento en la revisión vigente. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, opcionesDocumentoSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const opciones = await guardarOpcionesDocumento(id, body.data as OpcionesDocumento, s.usuario);
        return NextResponse.json({ opciones });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/documento');
    }
}
