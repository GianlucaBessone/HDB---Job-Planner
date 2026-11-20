import { NextRequest } from 'next/server';
import { eppEntregaSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { createEppDelivery } from '@/lib/rrhh/eppServer';

export function POST(req: NextRequest) {
    return responder('ENTREGA_POST', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        return createEppDelivery(await leerBody(req, eppEntregaSchema), actor);
    }, 201);
}
