import { NextRequest } from 'next/server';
import { eppIngresoStockSchema } from '@/lib/rrhh/epp';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { addEppStock } from '@/lib/rrhh/eppServer';

type Params = { params: Promise<{ id: string }> };

/** Ingreso de stock (compra o remito). */
export function POST(req: NextRequest, { params }: Params) {
    return responder('STOCK_POST', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        const { id } = await params;
        return addEppStock(id, await leerBody(req, eppIngresoStockSchema), actor);
    }, 201);
}
