import { NextRequest } from 'next/server';
import { eppSolicitudSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { createOperatorEppRequest } from '@/lib/rrhh/eppServer';

/** Solicitud de recambio del operario de la sesión. */
export function POST(req: NextRequest) {
    return responder('MIS_EPP_SOLICITUD', async () => {
        const actor = await sesionEpp(req, 'rrhh.mis_epp');
        return createOperatorEppRequest(await leerBody(req, eppSolicitudSchema), actor);
    }, 201);
}
