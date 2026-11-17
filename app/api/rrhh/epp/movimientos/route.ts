import { NextResponse } from 'next/server';
import { getEppStockMovements } from '@/lib/rrhh/eppServer';
import { idSchema, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Kardex: últimos movimientos, opcionalmente de un elemento (?eppItemId=). */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_ver']);
    if (sesion instanceof NextResponse) return sesion;
    const raw = new URL(req.url).searchParams.get('eppItemId');
    let eppItemId: string | undefined;
    if (raw) {
        const id = idSchema.safeParse(raw);
        if (!id.success) return responder({ success: false, error: 'Elemento inválido' });
        eppItemId = id.data;
    }
    return responder(await getEppStockMovements(eppItemId), 500);
}
