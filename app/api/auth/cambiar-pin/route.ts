import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getPinLockMinutes, hashPin, lockedMessage, problemaPinNuevo, registerPinAttempt, verifyPin } from '@/lib/pinAuth';

export const dynamic = 'force-dynamic';

const schema = z.object({
    pinActual: z.string().min(1, 'Ingresá tu PIN actual.'),
    pinNuevo: z.string(),
});

/**
 * Cambia el PIN de la persona de la sesión. Es la única API que el middleware
 * deja pasar mientras la sesión tiene la marca `cambiarPin` (entró con un PIN
 * débil). Al terminar emite una sesión nueva sin la marca.
 */
export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 });
    }
    const { pinActual, pinNuevo } = parsed.data;

    const problema = problemaPinNuevo(pinNuevo);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });
    if (pinNuevo === pinActual) {
        return NextResponse.json({ error: 'El PIN nuevo tiene que ser distinto del actual.' }, { status: 400 });
    }

    const operador = await prisma.operator.findUnique({
        where: { id: userId },
        select: { id: true, nombreCompleto: true, role: true, activo: true, pin: true },
    });
    if (!operador || !operador.activo) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    // Mismo límite de intentos que el ingreso, con su propia clave.
    const clave = `cambiar-pin:${operador.id}`;
    const bloqueo = await getPinLockMinutes(clave);
    if (bloqueo > 0) return NextResponse.json({ error: lockedMessage(bloqueo) }, { status: 429 });

    const valido = verifyPin(pinActual, operador.pin);
    await registerPinAttempt(clave, valido, { userId: operador.id, userName: operador.nombreCompleto });
    if (!valido) return NextResponse.json({ error: 'El PIN actual no es correcto.' }, { status: 401 });

    await prisma.operator.update({ where: { id: operador.id }, data: { pin: hashPin(pinNuevo) } });
    await logAudit({
        userId: operador.id,
        userName: operador.nombreCompleto,
        action: 'UPDATE',
        entity: 'OPERATOR',
        entityId: operador.id,
        metadata: { pinCambiado: true, porElPropioUsuario: true },
    });

    // Sesión nueva, ya sin la marca de cambio obligatorio
    const token = await encrypt({ id: operador.id, role: operador.role, nombreCompleto: operador.nombreCompleto });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('sgi_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });
    return response;
}
