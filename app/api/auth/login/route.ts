import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

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

        if (operator.pin !== pin) {
            return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
        }

        if (!operator.activo) {
            return NextResponse.json({ error: 'El operador está inactivo.' }, { status: 403 });
        }

        // Return user info without PIN
        const { pin: _pin, ...userData } = operator;

        return NextResponse.json(userData);
    } catch (error) {
        return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
    }
}
