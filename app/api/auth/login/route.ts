import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';

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

        // Check password using bcrypt. If it doesn't match, we reject.
        // Fallback for non-migrated passwords (only during transition if needed, but we already migrated all):
        let isValid = false;
        if (operator.pin && operator.pin.startsWith('$2')) {
            isValid = bcrypt.compareSync(pin, operator.pin);
        } else {
            isValid = operator.pin === pin; // Just in case a new one was created in plain text momentarily
        }

        if (!isValid) {
            return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
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
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
    }
}
