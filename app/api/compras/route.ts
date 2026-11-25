import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { crearOrden, listarOrdenes } from '@/lib/compras';
import { ordenSchema, primerError, respuestaError } from '@/lib/comprasApi';
import { ESTADOS_ABIERTOS } from '@/lib/comprasTipos';

export const dynamic = 'force-dynamic';

const GRUPOS: Record<string, string[] | undefined> = {
    abiertas: ESTADOS_ABIERTOS,
    recibidas: ['recibida'],
    canceladas: ['cancelada'],
    todas: undefined,
};

/** GET /api/compras?grupo=abiertas|recibidas|canceladas|todas&q=&proveedorId= */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['compras.ver', 'compras.gestionar', 'compras.recibir']);
    if (acceso instanceof NextResponse) return acceso;
    const sp = new URL(req.url).searchParams;
    const grupo = sp.get('grupo') || 'abiertas';
    if (!(grupo in GRUPOS)) return NextResponse.json({ error: 'Grupo inválido' }, { status: 400 });
    try {
        const ordenes = await listarOrdenes({
            estados: GRUPOS[grupo],
            q: sp.get('q')?.trim().slice(0, 80) || undefined,
            proveedorId: sp.get('proveedorId') || undefined,
        });
        return NextResponse.json({ ordenes });
    } catch (error) {
        return respuestaError(error, 'listar');
    }
}

/** POST /api/compras — nueva orden en borrador. */
export async function POST(req: Request) {
    const acceso = await exigirAcceso(req, ['compras.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const parsed = ordenSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
    try {
        const orden = await crearOrden(parsed.data, { id: acceso.userId, nombre: acceso.nombre });
        return NextResponse.json(orden, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'crear');
    }
}
