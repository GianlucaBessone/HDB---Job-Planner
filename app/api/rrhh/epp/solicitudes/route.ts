import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getEppRequests } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
    return responder('SOLICITUDES_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        return getEppRequests();
    });
}
