import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOperatorEppRequest } from '@/lib/rrhh/misEppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const solicitudSchema = z.object({
    eppItemId: idSchema,
    talle: z.string().max(60).optional(),
    motivo: z.string().trim().max(60).default('VENCIMIENTO'),
    comentario: z.string().max(1000).optional(),
});

/** El operador de la sesión pide un EPP. */
export async function POST(req: Request) {
    const sesion = await sesionEpp(req);
    if (sesion instanceof NextResponse) return sesion;
    const body = await leerBody(req, solicitudSchema);
    if (body instanceof NextResponse) return body;
    return responder(await createOperatorEppRequest(sesion.usuario, body.data));
}
