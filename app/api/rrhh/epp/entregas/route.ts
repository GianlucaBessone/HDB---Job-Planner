import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEppDelivery } from '@/lib/rrhh/eppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { firmaImagenSchema } from '@/lib/rrhh/eppFirma';

export const dynamic = 'force-dynamic';

const entregaSchema = z.object({
    operatorId: idSchema,
    items: z.array(z.object({
        eppItemId: idSchema,
        cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a cero'),
        talle: z.string().max(60).optional(),
    })).min(1, 'Debe seleccionar al menos un elemento de EPP').max(100),
    observaciones: z.string().max(2000).optional(),
    // Firma manuscrita en el puesto de entrega (data URL de la imagen).
    // No se aceptan signatureId/signatureHash: una firma con checksum solo la genera
    // el operario desde Mis EPP.
    firmaPresencialBase64: firmaImagenSchema.optional(),
});

/** Acta de entrega de EPP. "Entregado por" es siempre el usuario de la sesión. */
export async function POST(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_entregar']);
    if (sesion instanceof NextResponse) return sesion;
    const body = await leerBody(req, entregaSchema);
    if (body instanceof NextResponse) return body;
    return responder(await createEppDelivery(sesion.usuario, body.data));
}
