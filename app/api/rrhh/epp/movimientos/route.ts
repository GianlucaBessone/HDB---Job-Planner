import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { getEppStockMovements } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

/** Kardex: últimos 100 movimientos, opcionalmente de un elemento (?eppItemId=). */
export function GET(req: NextRequest) {
    return responder('MOVIMIENTOS_GET', async () => {
        await sesionEpp(req, 'rrhh.epp_ver');
        const eppItemId = req.nextUrl.searchParams.get('eppItemId')?.trim().slice(0, 64) || undefined;
        return getEppStockMovements(eppItemId);
    });
}
