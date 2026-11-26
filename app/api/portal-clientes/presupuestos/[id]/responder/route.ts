import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aceptarPresupuesto, rechazarPresupuesto } from '@/lib/presupuestosServicio/servicio';
import { hoyArgentina } from '@/lib/presupuestosServicio/calculos';
import { ErrorNegocio } from '@/lib/presupuestosServicio/sesion';
import { presupuestoDelCliente, responsablePortal, sinPermiso, SIN_CACHE, usuarioPortal } from '@/lib/portalCompleto';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('respuesta', [
    z.object({
        respuesta: z.literal('aceptar'),
        referenciaCliente: z.string().trim().max(80).nullable().optional(),
        comentario: z.string().trim().max(1000).nullable().optional(),
    }),
    z.object({ respuesta: z.literal('rechazar'), motivo: z.string().trim().min(3, 'Contanos el motivo del rechazo').max(1000) }),
]);

/**
 * POST /api/portal-clientes/presupuestos/[id]/responder — el cliente acepta (con su referencia, p. ej. nº de orden de
 * compra) o rechaza un presupuesto enviado y vigente. La aceptación queda sellada igual que cuando se registra en HDB.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const r = await responsablePortal(req);
    if (r instanceof NextResponse) return r;
    if (!r.aprobarPresupuestos) return sinPermiso('No tenés habilitado aceptar o rechazar presupuestos. Pedíselo a HDB.');
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    const p = await presupuestoDelCliente(r, id);
    if (!p) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    if (p.estado !== 'enviado' || (p.fechaVencimiento && p.fechaVencimiento < hoyArgentina())) {
        return NextResponse.json({ error: p.estado === 'enviado' ? 'El presupuesto venció: pedile a HDB que lo actualice' : 'El presupuesto ya fue respondido' }, { status: 409 });
    }
    const usuario = usuarioPortal(r, p.cliente?.nombre || p.clienteNombre);
    try {
        const b = parsed.data;
        if (b.respuesta === 'aceptar') {
            await aceptarPresupuesto(id, { fechaAceptacion: hoyArgentina(), referenciaCliente: b.referenciaCliente || null, comentario: b.comentario || null }, usuario);
        } else {
            await rechazarPresupuesto(id, b.motivo, usuario);
        }
        return NextResponse.json({ ok: true }, { headers: SIN_CACHE });
    } catch (e) {
        if (e instanceof ErrorNegocio) return NextResponse.json({ error: e.message }, { status: e.status });
        console.error('Error en portal/presupuestos/responder:', e);
        return NextResponse.json({ error: 'No se pudo registrar la respuesta' }, { status: 500 });
    }
}
