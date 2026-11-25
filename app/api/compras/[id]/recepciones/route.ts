import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { detalleOrden, registrarRecepcion } from '@/lib/compras';
import { primerError, recepcionSchema, respuestaError } from '@/lib/comprasApi';

export const dynamic = 'force-dynamic';

/** POST /api/compras/[id]/recepciones — registra mercadería recibida; entra stock al almacén de la orden. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await exigirAcceso(req, ['compras.recibir']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const parsed = recepcionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
    // Actualizar el costo cambia precios de venta: solo quien gestiona compras
    if (parsed.data.actualizarCostos && !acceso.puede('compras.gestionar')) {
        return NextResponse.json({ error: 'No tenés permiso para actualizar costos' }, { status: 403 });
    }
    try {
        const recepcion = await registrarRecepcion(id, parsed.data, { id: acceso.userId, nombre: acceso.nombre });
        return NextResponse.json({ recepcion, orden: await detalleOrden(id) }, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'recibir');
    }
}
