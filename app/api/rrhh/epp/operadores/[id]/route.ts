import { NextResponse } from 'next/server';
import { getOperatorEppProfile } from '@/lib/rrhh/eppServer';
import { idSchema, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Legajo de EPP de un operador: entregas y solicitudes. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req, ['rrhh.epp_ver']);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Operador inválido' });
    const result = await getOperatorEppProfile(id.data);
    return responder(result, result.error === 'Operador no encontrado' ? 404 : 500);
}
