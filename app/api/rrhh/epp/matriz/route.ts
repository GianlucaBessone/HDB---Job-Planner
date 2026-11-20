import { NextResponse } from 'next/server';
import { getEppMatrix } from '@/lib/rrhh/eppServer';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Matriz de cobertura de EPP globales por operador. */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_ver']);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getEppMatrix(), 500);
}
