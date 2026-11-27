import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { crearSolicitud, ErrorSolicitud, listarSolicitudes } from '@/lib/solicitudes';
import { TIPOS_SOLICITUD } from '@/lib/solicitudesTipos';

export const dynamic = 'force-dynamic';
const SIN_CACHE = { 'Cache-Control': 'private, no-store' };

/** GET /api/solicitudes?vista=para_aprobar|mias|resueltas */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const v = new URL(req.url).searchParams.get('vista') || 'mias';
    if (!['para_aprobar', 'mias', 'resueltas'].includes(v)) return NextResponse.json({ error: 'Vista inválida' }, { status: 400 });
    try {
        return NextResponse.json({ solicitudes: await listarSolicitudes(acceso, v as 'mias') }, { headers: SIN_CACHE });
    } catch (e) {
        console.error('Error en solicitudes (GET):', e);
        return NextResponse.json({ error: 'No se pudieron cargar las solicitudes' }, { status: 500 });
    }
}

const hora = z.union([z.literal(''), z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:mm)')]).nullish();
const cambiosSchema = z
    .object({
        horaIngreso: hora,
        horaEgreso: hora,
        isExtra: z.boolean().optional(),
        isDevolucion: z.boolean().optional(),
        descripcionDevolucion: z.string().max(2000).nullish(),
    })
    .strict();

const schema = z.object({
    tipo: z.enum(TIPOS_SOLICITUD),
    entidadId: z.string().trim().min(1).max(64),
    motivo: z.string().trim().min(3, 'Contá el motivo').max(2000),
    cambios: cambiosSchema.optional(),
});

/** POST /api/solicitudes — crea la solicitud y avisa a quienes pueden aprobarla. */
export async function POST(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    try {
        const r = await crearSolicitud(acceso, parsed.data);
        return NextResponse.json(r, { status: 201, headers: SIN_CACHE });
    } catch (e) {
        if (e instanceof ErrorSolicitud) return NextResponse.json({ error: e.message }, { status: e.status });
        console.error('Error en solicitudes (POST):', e);
        return NextResponse.json({ error: 'No se pudo crear la solicitud' }, { status: 500 });
    }
}
