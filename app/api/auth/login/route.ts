import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/auth';
import { getPinLockMinutes, hashPin, isPinHashed, lockedMessage, registerPinAttempt, verifyPin } from '@/lib/pinAuth';

export async function POST(req: Request) {
    try {
        const { operatorId, pin } = await req.json();

        if (!operatorId || !pin) {
            return NextResponse.json({ error: 'Operador y PIN son requeridos.' }, { status: 400 });
        }

        const operator = await prisma.operator.findUnique({
            where: { id: operatorId }
        });

        if (!operator) {
            return NextResponse.json({ error: 'Operador no encontrado.' }, { status: 404 });
        }

        // Bloqueo por intentos fallidos (5 en 15 minutos por operador)
        const throttleKey = `login:${operator.id}`;
        const lockMinutes = await getPinLockMinutes(throttleKey);
        if (lockMinutes > 0) {
            return NextResponse.json({ error: lockedMessage(lockMinutes) }, { status: 429 });
        }

        const isValid = verifyPin(String(pin), operator.pin);
        const intento = { userId: operator.id, userName: operator.nombreCompleto, ip: req.headers.get('x-forwarded-for') };
        await registerPinAttempt(throttleKey, isValid, intento);

        if (!isValid) {
            return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
        }

        // Migrar PINs heredados en texto plano a hash
        if (!isPinHashed(operator.pin)) {
            await prisma.operator.update({ where: { id: operator.id }, data: { pin: hashPin(String(pin)) } });
        }

        if (!operator.activo) {
            return NextResponse.json({ error: 'El operador está inactivo.' }, { status: 403 });
        }

        // Issue JWT token
        const sessionPayload = {
            id: operator.id,
            role: operator.role,
            nombreCompleto: operator.nombreCompleto
        };
        const sessionToken = await encrypt(sessionPayload);

        // Return user info without PIN
        const { pin: _pin, ...userData } = operator;

        const response = NextResponse.json(userData);
        
        // Set HTTP-Only Cookie
        response.cookies.set('sgi_session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
    }
}
