import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getPinLockMinutes, lockedMessage, registerPinAttempt, verifyPin } from '@/lib/pinAuth';

export const dynamic = 'force-dynamic';

const ROLES_AUTORIZANTES = ['admin', 'administrador', 'supervisor'];

const bodySchema = z.object({
    pin: z.string().trim().min(3).max(8),
});

/**
 * Valida el PIN de un supervisor/admin activo para autorizar una acción en caja.
 * Reemplaza la comparación que se hacía en el navegador con la lista de operadores.
 */
export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id') || '';
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Ingrese un PIN válido' }, { status: 400 });
    }

    // El bloqueo es por usuario que intenta autorizar, para frenar la prueba de PINs desde una caja.
    const throttleKey = `supervisor-pin:${userId}`;
    const lockMinutes = await getPinLockMinutes(throttleKey);
    if (lockMinutes > 0) {
        return NextResponse.json({ error: lockedMessage(lockMinutes) }, { status: 429 });
    }

    const candidatos = await prisma.operator.findMany({
        where: { activo: true },
        select: { id: true, nombreCompleto: true, role: true, pin: true },
    });
    const supervisor = candidatos.find(op =>
        ROLES_AUTORIZANTES.includes((op.role || '').toLowerCase()) && verifyPin(parsed.data.pin, op.pin)
    );

    await registerPinAttempt(throttleKey, !!supervisor, { userId, autorizadoPor: supervisor?.id ?? null });

    if (!supervisor) {
        return NextResponse.json(
            { error: 'PIN incorrecto o no pertenece a un Supervisor / Administrador activo.' },
            { status: 401 }
        );
    }

    return NextResponse.json({ id: supervisor.id, nombreCompleto: supervisor.nombreCompleto, role: supervisor.role });
}
