import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Mismos roles que ven "Gestión de Usuarios" en lib/viewAccess.ts
const ROLES_GESTION_USUARIOS = ['admin', 'supervisor', 'qa'];

function puedeGestionarUsuarios(req: Request) {
    const role = (req.headers.get('x-user-role') || '').toLowerCase();
    return ROLES_GESTION_USUARIOS.includes(role);
}

export async function GET(req: Request) {
    try {
        const operators = await dataLayer.getOperators();
        const session = await getSessionFromRequest(req);

        // Sin sesión (login, formulario público de sugerencias) solo se exponen los nombres.
        const body = session
            ? operators.map(({ pin: _pin, ...op }) => op)
            : operators.map(op => ({ id: op.id, nombreCompleto: op.nombreCompleto, activo: op.activo }));

        // La respuesta depende de la sesión: no puede quedar en la caché compartida de la CDN.
        return NextResponse.json(body, {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!puedeGestionarUsuarios(req)) {
        return NextResponse.json({ error: 'No tenés permisos para gestionar usuarios' }, { status: 403 });
    }
    const data = await req.json();
    const operator = await dataLayer.createOperator(data);
    const { pin: _pin, ...safe } = operator;
    return NextResponse.json(safe);
}

export async function PATCH(req: Request) {
    if (!puedeGestionarUsuarios(req)) {
        return NextResponse.json({ error: 'No tenés permisos para gestionar usuarios' }, { status: 403 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const data = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    // PIN vacío = mantener el actual
    if (typeof data.pin === 'string' && !data.pin.trim()) delete data.pin;
    const operator = await dataLayer.updateOperator(id, data);
    const { pin: _pin, ...safe } = operator;
    return NextResponse.json(safe);
}

export async function DELETE(req: Request) {
    if (!puedeGestionarUsuarios(req)) {
        return NextResponse.json({ error: 'No tenés permisos para gestionar usuarios' }, { status: 403 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await dataLayer.deleteOperator(id);
    return NextResponse.json({ success: true });
}
