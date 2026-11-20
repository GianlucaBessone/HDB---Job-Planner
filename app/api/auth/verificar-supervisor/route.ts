import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { autorizarConPin, emitirAutorizacion, FUNCIONES_CON_PIN } from '@/lib/autorizacionSupervisor';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    pin: z.string().trim().min(3).max(8),
    /** Acción que se autoriza. Por defecto, cambiar un precio en el PDV. */
    funcion: z.enum(FUNCIONES_CON_PIN).default('ventas.modificar_precios'),
});

/**
 * Valida el PIN de un usuario activo que tenga la función pedida (por rol o permiso
 * especial) y devuelve una autorización firmada, de corta duración, para usar en el
 * pedido que confirma la acción (por ejemplo, POST /api/ventas/pdv/confirmar).
 */
export async function POST(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Ingrese un PIN válido' }, { status: 400 });
    }
    const { pin, funcion } = parsed.data;

    const r = await autorizarConPin(pin, funcion, acceso.userId);
    if (!r.autorizante) {
        return NextResponse.json({ error: r.error }, { status: r.bloqueado ? 429 : 401 });
    }

    const autorizacion = await emitirAutorizacion(funcion, r.autorizante, acceso.userId);
    return NextResponse.json(
        { id: r.autorizante.id, nombreCompleto: r.autorizante.nombre, role: r.autorizante.role, autorizacion },
        { headers: { 'Cache-Control': 'private, no-store' } }
    );
}
