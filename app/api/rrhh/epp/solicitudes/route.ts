import { NextResponse } from 'next/server';
import { getEppRequests } from '@/lib/rrhh/eppServer';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Solicitudes de EPP de todos los operadores. */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_ver']);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getEppRequests(), 500);
}
