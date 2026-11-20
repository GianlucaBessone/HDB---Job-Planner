import { NextRequest } from 'next/server';
import { responder, sesionEpp } from '@/lib/rrhh/eppSesion';
import { deleteEppPublicShare } from '@/lib/rrhh/eppServer';

type Params = { params: Promise<{ id: string }> };

/** Revoca un enlace público: deja de funcionar en el acto. */
export function DELETE(req: NextRequest, { params }: Params) {
    return responder('ENLACES_DELETE', async () => {
        const actor = await sesionEpp(req, 'rrhh.epp_gestionar');
        const { id } = await params;
        return deleteEppPublicShare(id, actor);
    });
}
