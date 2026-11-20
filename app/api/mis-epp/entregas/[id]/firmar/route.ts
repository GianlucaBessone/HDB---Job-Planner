import { NextRequest } from 'next/server';
import { eppFirmaEntregaSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { signEppDelivery } from '@/lib/rrhh/eppServer';

type Params = { params: Promise<{ id: string }> };

/** El operario de la sesión firma un acta de entrega propia. */
export function POST(req: NextRequest, { params }: Params) {
    return responder('MIS_EPP_FIRMAR', async () => {
        const actor = await sesionEpp(req, 'rrhh.mis_epp');
        const { id } = await params;
        const body = await leerBody(req, eppFirmaEntregaSchema);
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        return signEppDelivery(id, body, actor, ip);
    });
}
