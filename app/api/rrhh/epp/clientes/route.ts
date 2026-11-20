import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getClientsForEppShare } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

/** Clientes activos, para compartir la matriz filtrada por cliente. */
export function GET(req: NextRequest) {
    return responder('CLIENTES_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        return getClientsForEppShare();
    });
}
