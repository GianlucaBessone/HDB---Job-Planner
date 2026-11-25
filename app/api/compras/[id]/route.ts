import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { borrarOrden, cancelarOrden, detalleOrden, editarOrden, enviarOrden, vincularFactura } from '@/lib/compras';
import { itemOrdenSchema, primerError, respuestaError } from '@/lib/comprasApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/compras/[id] — orden con ítems, recepciones y factura. */
export async function GET(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['compras.ver', 'compras.gestionar', 'compras.recibir']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    try {
        const orden = await detalleOrden(id);
        if (!orden) return NextResponse.json({ error: 'La orden no existe' }, { status: 404 });
        return NextResponse.json({ orden });
    } catch (error) {
        return respuestaError(error, 'detalle');
    }
}

const patchSchema = z.discriminatedUnion('accion', [
    z.object({
        accion: z.literal('editar'),
        proveedorId: z.string().min(1).optional(),
        almacenId: z.string().min(1).optional(),
        fechaEsperada: z.string().nullable().optional(),
        observaciones: z.string().max(2000).nullable().optional(),
        items: z.array(itemOrdenSchema).min(1, 'Agregá al menos un producto').max(300).optional(),
    }),
    z.object({ accion: z.literal('enviar') }),
    z.object({ accion: z.literal('cancelar') }),
    z.object({ accion: z.literal('vincular_factura'), facturaId: z.string().min(1).nullable() }),
]);

/** PATCH /api/compras/[id] — editar, enviar, cancelar o vincular la factura. */
export async function PATCH(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['compras.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
    const b = parsed.data;
    try {
        if (b.accion === 'editar') {
            let fechaEsperada: Date | null | undefined;
            if (b.fechaEsperada !== undefined) {
                fechaEsperada = b.fechaEsperada ? new Date(b.fechaEsperada.length === 10 ? `${b.fechaEsperada}T12:00:00` : b.fechaEsperada) : null;
                if (fechaEsperada && isNaN(fechaEsperada.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
            }
            await editarOrden(id, { proveedorId: b.proveedorId, almacenId: b.almacenId, fechaEsperada, observaciones: b.observaciones, items: b.items });
        } else if (b.accion === 'enviar') await enviarOrden(id);
        else if (b.accion === 'cancelar') await cancelarOrden(id);
        else await vincularFactura(id, b.facturaId);
        return NextResponse.json({ orden: await detalleOrden(id) });
    } catch (error) {
        return respuestaError(error, b.accion);
    }
}

/** DELETE /api/compras/[id] — solo una orden en borrador. */
export async function DELETE(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['compras.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    try {
        await borrarOrden(id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'borrar');
    }
}
