import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { fichaLegajo, guardarDatos } from '@/lib/legajo';
import { datosLegajoSchema, respuestaError, SIN_CACHE } from '@/lib/legajoApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rrhh/legajos/[id] — ficha del legajo de una persona (id de Operator). */
export async function GET(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_ver', 'rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    try {
        const ficha = await fichaLegajo(id);
        if (!ficha) return NextResponse.json({ error: 'La persona no existe' }, { status: 404 });
        return NextResponse.json({ ficha }, { headers: SIN_CACHE });
    } catch (error) {
        return respuestaError(error, 'ficha');
    }
}

/** PUT /api/rrhh/legajos/[id] — guarda los datos del legajo (solo los campos enviados). */
export async function PUT(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const parsed = datosLegajoSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    try {
        await guardarDatos(id, parsed.data, acceso.nombre);
        // Auditoría sin los valores: son datos personales
        await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: 'UPDATE', entity: 'LegajoPersonal', entityId: id, metadata: { campos: Object.keys(parsed.data) } });
        return NextResponse.json({ ficha: await fichaLegajo(id) }, { headers: SIN_CACHE });
    } catch (error) {
        return respuestaError(error, 'guardar');
    }
}
