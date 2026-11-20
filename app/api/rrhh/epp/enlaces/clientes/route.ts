import { NextResponse } from 'next/server';
import { getClientsForEppShare } from '@/lib/rrhh/eppServer';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Clientes activos, para generar un enlace de matriz por cliente. */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getClientsForEppShare(), 500);
}
