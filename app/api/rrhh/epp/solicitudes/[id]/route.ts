import { NextRequest } from 'next/server';
import { eppResolverSolicitudSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { resolveEppRequest } from '@/lib/rrhh/eppServer';

type Params = { params: Promise<{ id: string }> };

/** Aprobar o rechazar una solicitud de un operario. */
export function PATCH(req: NextRequest, { params }: Params) {
    return responder('SOLICITUD_PATCH', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        const { id } = await params;
        return resolveEppRequest(id, await leerBody(req, eppResolverSolicitudSchema), actor);
    });
}
