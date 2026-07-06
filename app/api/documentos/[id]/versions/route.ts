import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documentos/[id]/versions — List all versions
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const versions = await prisma.documentVersion.findMany({
            where: { documentId: params.id },
            include: {
                files: true
            },
            orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }]
        });

        return NextResponse.json(versions);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener versiones', details: e.message }, { status: 500 });
    }
}

/**
 * POST /api/documentos/[id]/versions — Create a new version
 * Automatically obsoletes the previous vigente version.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const {
            tipoVersion, // 'mayor' | 'menor'
            motivoCambio, notas, checklistTemplate,
            autorId, autorNombre,
            userId, userName
        } = data;

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    where: { estado: 'vigente' },
                    take: 1
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        // Calculate new version number
        let newMayor = doc.versionMayor;
        let newMenor = doc.versionMenor;

        if (tipoVersion === 'mayor') {
            newMayor += 1;
            newMenor = 0;
        } else {
            newMenor += 1;
        }

        const versionLabel = `${newMayor}.${newMenor}`;

        // Crear un snapshot de la informacion del documento actual para preservar la inmutabilidad de la version
        const documentSnapshot = {
            titulo: doc.titulo,
            codigoDocumental: doc.codigoDocumental,
            tipoDocumento: doc.tipoDocumento,
            area: doc.area,
            estado: doc.estado,
            descripcion: doc.descripcion,
            nivelCriticidad: doc.nivelCriticidad,
            tags: doc.tags,
            operatorIds: doc.operatorIds || [],
            requiereConfirmacionLectura: doc.requiereConfirmacionLectura,
            requiereCapacitacion: doc.requiereCapacitacion,
            validezMeses: doc.validezMeses,
            observaciones: doc.observaciones,
            fechaEmision: doc.fechaEmision,
            fechaRevision: doc.fechaRevision,
            proximaRevision: doc.proximaRevision,
        };

        // Create new version
        const version = await prisma.documentVersion.create({
            data: {
                documentId: params.id,
                versionMayor: newMayor,
                versionMenor: newMenor,
                versionLabel,
                estado: 'borrador',
                autorId: autorId || userId || null,
                autorNombre: autorNombre || userName || null,
                motivoCambio: motivoCambio || null,
                notas: notas || null,
                checklistTemplate: checklistTemplate || null,
                documentSnapshot: documentSnapshot,
            }
        });

        // Update the document's version snapshot
        await prisma.controlledDocument.update({
            where: { id: params.id },
            data: {
                versionMayor: newMayor,
                versionMenor: newMenor,
                motivoCambio: motivoCambio || null,
            }
        });

        await logAudit({
            userId: userId || autorId,
            userName: userName || autorNombre,
            action: 'CREATE',
            entity: 'DOCUMENT_VERSION',
            entityId: version.id,
            newValue: { ...version, documentCode: doc.codigoDocumental },
        });

        return NextResponse.json(version);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear versión', details: e.message }, { status: 500 });
    }
}
