import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { listarBorradores, guardarBorrador, borrarBorrador } from '@/lib/proyectos/wizard';

export const dynamic = 'force-dynamic';

const schema = z.object({
    id: z.string().trim().max(64).optional().nullable(),
    titulo: z.string().trim().max(200).optional().nullable(),
    paso: z.coerce.number().int().min(1).max(6),
    presupuestoId: z.string().trim().max(64).optional().nullable(),
    datos: z.record(z.string(), z.unknown()),
});

/** Borradores del wizard de proyectos del usuario de la sesión. */
export async function GET(req: NextRequest) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    try {
        return NextResponse.json(await listarBorradores(s.usuario.id), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'projects/borradores GET');
    }
}

export async function PUT(req: NextRequest) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, schema);
    if (body instanceof NextResponse) return body;
    if (JSON.stringify(body.data.datos).length > 500_000) return NextResponse.json({ error: 'El borrador es demasiado grande' }, { status: 413 });
    try {
        return NextResponse.json(await guardarBorrador(s.usuario.id, body.data));
    } catch (e) {
        return responderError(e, 'projects/borradores PUT');
    }
}

/** DELETE /api/projects/borradores?id= */
export async function DELETE(req: NextRequest) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el id del borrador' }, { status: 400 });
    try {
        await borrarBorrador(s.usuario.id, id);
        return NextResponse.json({ success: true, message: 'Borrador descartado' });
    } catch (e) {
        return responderError(e, 'projects/borradores DELETE');
    }
}
