import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.resultado || typeof body.eficaz !== 'boolean' || (!body.ncId && !body.accionMejoraId)) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const verificacion = await prisma.verificacionEficacia.create({
            data: {
                ncId: body.ncId,
                accionMejoraId: body.accionMejoraId,
                resultado: body.resultado,
                observaciones: body.observaciones,
                eficaz: body.eficaz,
                fechaVerificacion: body.fechaVerificacion ? new Date(body.fechaVerificacion) : new Date(),
                responsableVerificacionId: body.responsableVerificacionId
            }
        });

        // Update CAPA efficacy if linked
        if (body.accionMejoraId) {
            await prisma.accionMejora.update({
                where: { id: body.accionMejoraId },
                data: { eficacia: body.eficaz ? 'Eficaz' : 'Ineficaz' }
            });
        }

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'VERIFICACION_EFICACIA',
            entityId: verificacion.id,
            newValue: verificacion
        });

        return NextResponse.json(verificacion, { status: 201 });
    } catch (error) {
        console.error('Error creating VerificacionEficacia:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Verificación' }, { status: 500 });
    }
}
