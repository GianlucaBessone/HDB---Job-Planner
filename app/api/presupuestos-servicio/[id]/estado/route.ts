import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError, errorJson } from '@/lib/presupuestosServicio/sesion';
import { accionEstadoSchema } from '@/lib/presupuestosServicio/schemas';
import { enviarPresupuesto, aceptarPresupuesto, rechazarPresupuesto } from '@/lib/presupuestosServicio/servicio';
import type { OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';

export const dynamic = 'force-dynamic';

/**
 * POST /api/presupuestos-servicio/[id]/estado
 *   { accion: 'enviar', opcionesDocumento? }            → presupuestos.gestionar
 *   { accion: 'aceptar', fechaAceptacion, referenciaCliente?, comentario? } → presupuestos.aprobar
 *   { accion: 'rechazar', motivo }                       → presupuestos.aprobar
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, accionEstadoSchema);
    if (body instanceof NextResponse) return body;
    const { id } = await params;
    const d = body.data;
    try {
        if (d.accion === 'enviar') {
            if (!s.acceso.puede('presupuestos.gestionar')) return errorJson(403, 'No tenés permiso para enviar presupuestos');
            const p = await enviarPresupuesto(id, d.opcionesDocumento as OpcionesDocumento | undefined, s.usuario);
            return NextResponse.json({ presupuesto: p, message: `Presupuesto ${p.numero} enviado` });
        }
        if (!s.acceso.puede('presupuestos.aprobar')) return errorJson(403, 'No tenés permiso para registrar la respuesta del cliente');
        if (d.accion === 'aceptar') {
            const p = await aceptarPresupuesto(id, { fechaAceptacion: d.fechaAceptacion, referenciaCliente: d.referenciaCliente, comentario: d.comentario }, s.usuario);
            return NextResponse.json({ presupuesto: p, message: `Aceptación de ${p.numero} registrada` });
        }
        const p = await rechazarPresupuesto(id, d.motivo, s.usuario);
        return NextResponse.json({ presupuesto: p, message: `Rechazo de ${p.numero} registrado` });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/estado');
    }
}
