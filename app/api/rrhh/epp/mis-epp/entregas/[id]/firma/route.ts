import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signEppDelivery } from '@/lib/rrhh/misEppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const firmaSchema = z.object({
    itemIdsConfirmed: z.array(idSchema).min(1, 'Debe seleccionar y confirmar al menos un ítem entregado').max(200),
    signatureId: z.string().trim().min(1, 'Firma digital con checksum requerida').max(200),
    signatureHash: z.string().trim().min(1, 'Firma digital con checksum requerida').max(500),
    firmaManuscritaUrl: z.string().max(5_000_000).optional(),
});

/** El operador de la sesión firma una entrega propia. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Entrega inválida' });
    const body = await leerBody(req, firmaSchema);
    if (body instanceof NextResponse) return body;
    return responder(await signEppDelivery(sesion.usuario, { deliveryId: id.data, ...body.data }));
}
