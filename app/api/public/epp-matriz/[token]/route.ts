import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicEppMatrixData } from '@/lib/rrhh/eppServer';

export const dynamic = 'force-dynamic';

// Los tokens son 16 bytes aleatorios en hex (lib/rrhh/eppServer.ts → createEppPublicShare).
const ENLACE_INVALIDO = 'El enlace de la matriz no es válido o ha sido desactivado.';
const tokenSchema = z.string().regex(/^[a-f0-9]{16,128}$/i);

/**
 * Matriz de EPP de un enlace público. No requiere sesión (el middleware deja
 * pasar /api/public): solo vale el token, y el enlace tiene que estar activo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
    const token = tokenSchema.safeParse((await params).token);
    if (!token.success) {
        return NextResponse.json(
            { success: false, error: ENLACE_INVALIDO },
            { status: 404 }
        );
    }
    const result = await getPublicEppMatrixData(token.data);
    if (!result.success) {
        const invalido = result.error === ENLACE_INVALIDO;
        if (!invalido) console.error('Error al leer la matriz pública de EPP:', result.error);
        // Ruta pública: no se exponen detalles internos del error.
        return NextResponse.json(
            { success: false, error: invalido ? ENLACE_INVALIDO : 'No se pudo cargar la matriz. Probá de nuevo más tarde.' },
            { status: invalido ? 404 : 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
