import { NextResponse } from 'next/server';
import { generateObject } from '@/lib/ai';
import { AutoObservationsOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();
        const { 
            checklistData, 
            inspeccionDetalles, 
            anomaliasConfirmadas, 
            imagenDescripcion, 
            ordenServicioId
        } = body;
        // Usuario, nombre y rol salen de la sesión (se ignoran los del cuerpo).
        const userId = acceso.userId;
        const userName = acceso.nombre;
        const userRole = acceso.role;

        if (!checklistData) {
            return NextResponse.json({ error: 'Falta el parámetro obligatorio: checklistData.' }, { status: 400 });
        }

        // 1. Invocar el Servicio Centralizado de Observaciones
        const aiResponse = await generateObject<AutoObservationsOutput>(
            'GENERATE_OBS',
            {
                checklistData,
                inspeccionDetalles: inspeccionDetalles || 'Inspección de rutina',
                anomaliasConfirmadas: anomaliasConfirmadas || [],
                imagenDescripcion: imagenDescripcion || 'Sin imagen de referencia'
            },
            {
                userId,
                userName,
                userRole,
                entity: ordenServicioId ? 'OrdenServicio' : undefined,
                entityId: ordenServicioId,
                temperature: 0.2
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al redactar observaciones.' }, { status: 500 });
        }

        const generatedObs = aiResponse.data;

        // 2. Si hay ordenServicioId, registrar/actualizar el comentario de la OS en DB
        if (ordenServicioId) {
            const formattedComment = `
[Observaciones IA - ${new Date().toLocaleDateString()}]
${generatedObs.conclusionesGenerales}

Hallazgos clave:
${generatedObs.hallazgosClave.map(h => `- [${h.criticidad.toUpperCase()}] ${h.hallazgo} (Recomendación: ${h.sugerenciaAccion})`).join('\n')}

Recomendaciones técnicas adicionales:
${generatedObs.recomendacionesTecnicas.map((r, i) => `${i + 1}. ${r}`).join('\n')}
            `.trim();

            await prisma.ordenServicio.update({
                where: { id: ordenServicioId },
                data: {
                    comentario: formattedComment
                }
            });
        }

        return NextResponse.json({
            success: true,
            observations: generatedObs,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][GenerateObs] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
