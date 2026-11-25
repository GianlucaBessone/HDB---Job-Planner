import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

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
            // La acción de mejora es una Tarea (P31)
            await prisma.tarea.update({
                where: { id: body.accionMejoraId },
                data: { eficacia: body.eficaz ? 'Eficaz' : 'Ineficaz' }
            });
        }

        await logAudit({
            userId: auth.userId,
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
