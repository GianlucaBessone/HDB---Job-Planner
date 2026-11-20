import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getOperatorEppProfile } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Ficha de EPP de un operario: entregas y solicitudes. */
export function GET(req: NextRequest, { params }: Params) {
    return responder('OPERADOR_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        const { id } = await params;
        return getOperatorEppProfile(id);
    });
}
