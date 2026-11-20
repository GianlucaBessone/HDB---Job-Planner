import { NextRequest } from 'next/server';
import { ErrorEpp, responder } from '@/lib/rrhh/eppSesion';
import { getPublicEppMatrixData } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

/**
 * Matriz de EPP compartida con un cliente. Pública (el middleware deja pasar
 * /api/public): la protege el token aleatorio, que se revoca desde EPP.
 */
export function GET(_req: NextRequest, { params }: Params) {
    return responder('MATRIZ_PUBLICA_GET', async () => {
        const { token } = await params;
        if (!/^[a-f0-9]{32}$/.test(token)) throw new ErrorEpp('El enlace de la matriz no es válido o ha sido desactivado.', 404);
        return getPublicEppMatrixData(token);
    });
}
