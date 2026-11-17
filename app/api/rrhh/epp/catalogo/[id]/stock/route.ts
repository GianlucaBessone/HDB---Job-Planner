import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addEppStock } from '@/lib/rrhh/eppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const ingresoSchema = z.object({
    cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a cero'),
    remitoFactura: z.string().max(120).optional(),
    proveedor: z.string().max(200).optional(),
    motivo: z.string().max(500).optional(),
});

/** Ingreso de stock de un elemento (kardex a nombre del usuario de la sesión). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Elemento inválido' });
    const body = await leerBody(req, ingresoSchema);
    if (body instanceof NextResponse) return body;
    return responder(await addEppStock(sesion.usuario, { eppItemId: id.data, ...body.data }));
}
