import { NextRequest } from 'next/server';
import { eppEnlaceSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { createEppPublicShare, getEppPublicShares } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
    return responder('ENLACES_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        return getEppPublicShares();
    });
}

/** Genera un enlace público (sin sesión) a la matriz de EPP. */
export function POST(req: NextRequest) {
    return responder('ENLACES_POST', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        return createEppPublicShare(await leerBody(req, eppEnlaceSchema), actor);
    }, 201);
}
