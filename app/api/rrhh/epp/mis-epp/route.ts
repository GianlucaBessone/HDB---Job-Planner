import { NextResponse } from 'next/server';
import { getMyEppData } from '@/lib/rrhh/misEppServer';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** EPP del operador de la sesión: pendientes de firma, asignados, solicitudes y catálogo. */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getMyEppData(sesion.usuario), 500);
}
