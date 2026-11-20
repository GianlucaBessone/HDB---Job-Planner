import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { cargarOrdenesACuenta, listarOrdenesPorCargar } from '@/lib/ventas/cargosServicio';

export const dynamic = 'force-dynamic';

/** GET: OS cobradas y ciclos de OT firmados que todavía no están en la cuenta corriente. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['ventas.cc_ver'], 'No tenés permiso para ver cuentas corrientes');
    if (acceso instanceof NextResponse) return acceso;
    try {
        const clienteId = new URL(req.url).searchParams.get('clienteId') || undefined;
        const ordenes = await listarOrdenesPorCargar(clienteId);
        return NextResponse.json(ordenes, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('ordenes-por-cargar GET', e);
        return NextResponse.json({ error: 'No se pudieron listar las órdenes por cargar' }, { status: 500 });
    }
}

const cargaSchema = z.object({
    items: z
        .array(z.object({ origenTipo: z.enum(['OS', 'OT_CICLO']), origenId: z.string().min(1).max(64) }))
        .min(1, 'Elegí al menos una orden')
        .max(100, 'Se cargan hasta 100 órdenes por vez'),
});

/** POST: carga las órdenes elegidas como cargo por servicio (misma función que los débitos manuales). */
export async function POST(req: Request) {
    const acceso = await exigirAcceso(req, ['ventas.cc_ajustar'], 'No tenés permiso para registrar cargos en cuenta corriente');
    if (acceso instanceof NextResponse) return acceso;
    const parsed = cargaSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    try {
        const resultados = await cargarOrdenesACuenta(parsed.data.items, { id: acceso.userId, nombre: acceso.nombre });
        return NextResponse.json({ resultados, cargadas: resultados.filter(r => r.ok).length });
    } catch (e) {
        console.error('ordenes-por-cargar POST', e);
        return NextResponse.json({ error: 'No se pudieron cargar las órdenes' }, { status: 500 });
    }
}
