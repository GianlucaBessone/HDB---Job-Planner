import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEppPublicShare, getEppPublicShares } from '@/lib/rrhh/eppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const crearSchema = z.object({
    tipo: z.enum(['GENERAL', 'CLIENTE']),
    clientId: idSchema.optional(),
    titulo: z.string().trim().max(200).optional(),
});

/** Enlaces públicos de la matriz (incluyen el token, por eso exigen gestionar). */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getEppPublicShares(), 500);
}

/** Genera un enlace público. "Creado por" es el usuario de la sesión. */
export async function POST(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const body = await leerBody(req, crearSchema);
    if (body instanceof NextResponse) return body;
    return responder(await createEppPublicShare(sesion.usuario, body.data));
}
