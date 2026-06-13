import { NextRequest, NextResponse } from 'next/server';

export function requireSGIRole(req: NextRequest, allowedRoles: string[]) {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!userId || !role) {
        return { error: NextResponse.json({ error: 'No autorizado. Faltan credenciales.' }, { status: 401 }) };
    }

    if (!allowedRoles.includes(role)) {
        return { error: NextResponse.json({ error: 'Acceso denegado. Rol insuficiente para esta operación SGI.' }, { status: 403 }) };
    }

    return { user: { id: userId, role } };
}
