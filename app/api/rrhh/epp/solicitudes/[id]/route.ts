import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEppRequest } from '@/lib/rrhh/eppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const resolverSchema = z.object({
    accion: z.enum(['APROBAR', 'RECHAZAR']),
    motivoRechazo: z.string().max(1000).optional(),
});

/** Aprobar o rechazar una solicitud. "Resuelto por" es el usuario de la sesión. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Solicitud inválida' });
    const body = await leerBody(req, resolverSchema);
    if (body instanceof NextResponse) return body;
    return responder(await resolveEppRequest(sesion.usuario, { requestId: id.data, ...body.data }));
}
