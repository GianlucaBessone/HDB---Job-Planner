import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { crearPresupuestoDesdePliego, ErrorPliegoPresupuesto, previaPresupuesto } from '@/lib/presupuestoDesdePliego';
import { ErrorNegocio } from '@/lib/presupuestosServicio/sesion';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const SIN_CACHE = { 'Cache-Control': 'private, no-store' };

/** GET /api/pliegos/[id]/presupuesto — qué se cargaría y los presupuestos ya armados desde el pliego (P36). */
export async function GET(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['pliegos.ver', 'pliegos.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    try {
        const previa = await previaPresupuesto(id);
        if (!previa) return NextResponse.json({ error: 'Pliego no encontrado' }, { status: 404 });
        return NextResponse.json({ ...previa, puedeCrear: acceso.puede('presupuestos.gestionar') }, { headers: SIN_CACHE });
    } catch (e) {
        console.error('Error en pliegos/presupuesto (GET):', e);
        return NextResponse.json({ error: 'No se pudo cargar' }, { status: 500 });
    }
}

const schema = z.object({
    clienteId: z.string().trim().max(64).nullable().optional(),
    titulo: z.string().trim().min(3, 'Escribí un título de al menos 3 caracteres').max(200).nullable().optional(),
    incluirSinMarcar: z.boolean().default(true),
    incluirSugeridos: z.boolean().default(false),
});

/** POST /api/pliegos/[id]/presupuesto — arma un presupuesto de servicio en borrador desde el último análisis. */
export async function POST(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['presupuestos.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    if (!acceso.puede('pliegos.ver') && !acceso.puede('pliegos.gestionar')) {
        return NextResponse.json({ error: 'No tenés permiso para ver pliegos' }, { status: 403 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    try {
        const r = await crearPresupuestoDesdePliego(id, parsed.data, { id: acceso.userId, nombre: acceso.nombre });
        return NextResponse.json(r, { status: 201, headers: SIN_CACHE });
    } catch (e) {
        if (e instanceof ErrorPliegoPresupuesto || e instanceof ErrorNegocio) return NextResponse.json({ error: e.message }, { status: e.status });
        if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        console.error('Error en pliegos/presupuesto (POST):', e);
        return NextResponse.json({ error: 'No se pudo armar el presupuesto' }, { status: 500 });
    }
}
