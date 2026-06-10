import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateObject } from '@/lib/ai/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                responsablesTratamiento: {
                    include: {
                        trainings: {
                            include: { document: true }
                        }
                    }
                }
            }
        });

        if (!nc) return NextResponse.json({ error: 'NC no encontrada' }, { status: 404 });

        // Fetch active documents to check against
        const activeDocs = await prisma.controlledDocument.findMany({
            where: { estado: 'vigente' },
            select: {
                codigoDocumental: true,
                titulo: true,
                descripcion: true,
                area: true,
                tipoDocumento: true
            }
        });

        // Format operators and their training history
        const operatorTrainingInfo = nc.responsablesTratamiento.map(op => {
            const trainings = op.trainings.map(t => 
                `- Documento: ${t.document?.codigoDocumental || 'N/A'} (${t.document?.titulo || 'N/A'}), Fecha Inicio: ${t.fechaInicio ? new Date(t.fechaInicio).toLocaleDateString() : 'Desconocida'}, Estado: ${t.estado}`
            ).join('\n');
            return `Operador responsable: ${op.nombreCompleto}\nCapacitaciones Registradas:\n${trainings || 'Ninguna capacitación registrada en el sistema.'}`;
        }).join('\n\n');

        // Format documents context
        const docsInfo = activeDocs.map(doc => 
            `[${doc.codigoDocumental}] ${doc.titulo} (${doc.tipoDocumento} - Área: ${doc.area})\nResumen: ${doc.descripcion || 'Sin descripción'}`
        ).join('\n\n');

        const result = await generateObject<{ reporteAuditoria: string }>(
            "NC_DOC_ANALYSIS",
            {
                codigoNC: nc.codigoNC || 'N/A',
                origen: nc.origen || 'N/A',
                areaAfectada: nc.areaAfectada || 'N/A',
                procesoAfectado: nc.procesoAfectado || 'N/A',
                descripcion: nc.descripcion || '',
                docsInfo,
                operatorTrainingInfo
            },
            {
                userId: "sistema",
                entityId: nc.id,
                entity: "NoConformidad"
            }
        );

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Fallo en IA' }, { status: 500 });
        }

        return NextResponse.json({ result: result.data?.reporteAuditoria });

    } catch (error: any) {
        console.error('Error in IA Doc Analysis:', error);
        return NextResponse.json({ error: error.message || 'Error analizando documentos' }, { status: 500 });
    }
}
