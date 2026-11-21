import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { buscarMateriales, preciosPorCodigos } from '@/lib/ventas/precioMaterial';

export const dynamic = 'force-dynamic';

/**
 * Materiales del catálogo de Productos con su precio de venta vigente (P8). Reemplaza a
 * `/api/inventario`, que leía la tabla `MaterialMaestro`.
 *
 *  - `?q=texto`: búsqueda por código o descripción (buscador de materiales de las OT).
 *  - `?codigos=a,b,c`: precios de esos códigos (precarga del cobro de una OS).
 *  - `proyectoId` o `clienteId`: la lista de precios a usar (la del proyecto, la del cliente o la predeterminada).
 */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    try {
        const sp = new URL(req.url).searchParams;
        const ctx = { proyectoId: sp.get('proyectoId'), clienteId: sp.get('clienteId') };
        const codigos = sp.get('codigos');
        if (codigos !== null) {
            const lista = codigos.split(',').map(c => c.trim()).filter(Boolean).slice(0, 200);
            return NextResponse.json(await preciosPorCodigos(lista, ctx), { headers: { 'Cache-Control': 'private, no-store' } });
        }
        const q = (sp.get('q') || '').slice(0, 100);
        return NextResponse.json(await buscarMateriales(q, ctx), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('materiales/catalogo GET', e);
        return NextResponse.json({ error: 'No se pudo consultar el catálogo' }, { status: 500 });
    }
}
