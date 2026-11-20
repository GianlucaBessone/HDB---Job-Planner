import { NextRequest } from 'next/server';
import { eppItemEditarSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { updateEppItem } from '@/lib/rrhh/eppServer';

type Params = { params: Promise<{ id: string }> };

export function PATCH(req: NextRequest, { params }: Params) {
    return responder('CATALOGO_PATCH', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        const { id } = await params;
        return updateEppItem(id, await leerBody(req, eppItemEditarSchema), actor);
    });
}
