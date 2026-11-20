import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getMyEppData } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

/** EPP del operario de la sesión: pendientes de firma, asignados, historial, solicitudes y catálogo. */
export function GET(req: NextRequest) {
    return responder('MIS_EPP_GET', async () => {
        const actor = await sesionEpp(req, 'rrhh.mis_epp');
        return getMyEppData(actor.id);
    });
}
