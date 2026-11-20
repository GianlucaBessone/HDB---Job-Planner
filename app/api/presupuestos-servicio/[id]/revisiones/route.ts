import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { crearRevision } from '@/lib/presupuestosServicio/servicio';

export const dynamic = 'force-dynamic';

const schema = z.object({ nota: z.string().trim().max(500).optional().nullable().transform((v) => v || null) });

/** POST: abre una revisión nueva (copia de la vigente, en borrador). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, schema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const p = await crearRevision(id, body.data.nota, s.usuario);
        return NextResponse.json({ presupuesto: p, message: `Revisión ${p.versionActual} creada` }, { status: 201 });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/revisiones');
    }
}
