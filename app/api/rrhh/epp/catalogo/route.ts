import { NextRequest } from 'next/server';
import { eppItemCrearSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { createEppItem, getEppCatalog } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
    return responder('CATALOGO_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        return getEppCatalog();
    });
}

export function POST(req: NextRequest) {
    return responder('CATALOGO_POST', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        return createEppItem(await leerBody(req, eppItemCrearSchema), actor);
    }, 201);
}
