import { NextResponse } from 'next/server';
import { deleteEppPublicShare } from '@/lib/rrhh/eppServer';
import { idSchema, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

/** Revoca un enlace público de la matriz. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Enlace inválido' });
    return responder(await deleteEppPublicShare(sesion.usuario, id.data));
}
