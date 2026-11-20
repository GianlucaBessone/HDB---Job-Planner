import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getEppMatrix } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
    return responder('MATRIZ_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        return getEppMatrix();
    });
}
