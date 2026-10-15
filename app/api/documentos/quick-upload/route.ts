import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            fileName,
            fileType,
            fileSize,
            fileContent,
            subAccessId,
            titulo,
            tipoDocumento = 'PG',
            area = 'GLB',
            observaciones,
            codigoDocumental,
            revisadorId,
            revisadorNombre,
            aprobadorId,
            aprobadorNombre,
            userId,
            userName
        } = body;

        if (!fileName || !fileContent) {
            return NextResponse.json({ error: 'El archivo y su contenido son obligatorios.' }, { status: 400 });
        }

        const docTitle = (titulo || fileName.replace(/\.[^/.]+$/, '')).trim();

        // Always resolve Hernán Bassignana as approver
        const hernan = await prisma.operator.findFirst({
            where: {
                nombreCompleto: { contains: 'Bassignana', mode: 'insensitive' }
            }
        });

        const finalAprobadorId = hernan?.id || aprobadorId || null;
        const finalAprobadorNombre = hernan?.nombreCompleto || aprobadorNombre || 'Hernán Bassignana';

        let finalRevisadorNombre = revisadorNombre || null;
        if (revisadorId && !finalRevisadorNombre) {
            const revOp = await prisma.operator.findUnique({
                where: { id: revisadorId },
                select: { nombreCompleto: true }
            });
            finalRevisadorNombre = revOp?.nombreCompleto || null;
        }

        // Determine or generate code
        let generatedCode = codigoDocumental?.trim();
        if (!generatedCode) {
            const prefix = `${tipoDocumento.toUpperCase()}-${area.toUpperCase()}-`;
            const docs = await prisma.controlledDocument.findMany({
                where: { codigoDocumental: { startsWith: prefix } },
                select: { codigoDocumental: true }
            });
            let maxNumber = 0;
            for (const d of docs) {
                const parts = d.codigoDocumental.split('-');
                if (parts.length >= 3) {
                    const numPart = parts[parts.length - 1];
                    const num = parseInt(numPart, 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
            const nextNumber = maxNumber + 1;
            generatedCode = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        }

        // Verify uniqueness
        let existing = await prisma.controlledDocument.findUnique({
            where: { codigoDocumental: generatedCode }
        });
        if (existing) {
            generatedCode = `${generatedCode}-${Date.now().toString().slice(-4)}`;
        }

        // Fetch user's position
        let userPosition = '';
        if (userId) {
            const operator = await prisma.operator.findUnique({
                where: { id: userId },
                select: { posicion: true }
            });
            userPosition = operator?.posicion || '';
        }

        const initialStatus = (revisadorId || finalAprobadorId) ? 'en_revision' : 'vigente';

        const workflowState = {
            creatorStatus: 'approved',
            creatorSignature: null,
            creatorSignatureDate: new Date().toISOString(),
            creatorPosition: userPosition,
            editorName: userName || 'Usuario',
            editorPosition: userPosition,
            revisadorStatus: revisadorId ? 'pending' : 'none',
            revisadorComment: null,
            aprobadorStatus: finalAprobadorId ? 'pending' : 'none',
            aprobadorComment: null,
            history: [
                {
                    user: userName || 'Usuario',
                    posicion: userPosition,
                    action: 'created',
                    date: new Date().toISOString(),
                    comment: `Subida directa de archivo "${fileName}" en biblioteca documental`
                }
            ]
        };

        const doc = await prisma.controlledDocument.create({
            data: {
                codigoDocumental: generatedCode,
                titulo: docTitle,
                tipoDocumento,
                area,
                estado: initialStatus,
                subAccessId: subAccessId || null,
                versionMayor: 1,
                versionMenor: 0,
                descripcion: JSON.stringify({
                    isDigital: false,
                    objetivo: `Documento cargado como archivo adjunto: ${fileName}`,
                    desarrollo: ''
                }),
                responsableId: userId || null,
                responsableNombre: userName || null,
                revisadorId: revisadorId || null,
                revisadorNombre: finalRevisadorNombre,
                aprobadorId: finalAprobadorId,
                aprobadorNombre: finalAprobadorNombre,
                nivelCriticidad: 'media',
                requiereConfirmacionLectura: false,
                requiereCapacitacion: false,
                tags: [],
                operatorIds: [],
                observaciones: observaciones?.trim() || `Archivo original: ${fileName}`,
                createdBy: userId || null,
                createdByName: userName || null,
                workflowState: workflowState as any,
            }
        });

        // Create version v1.0
        const version = await prisma.documentVersion.create({
            data: {
                documentId: doc.id,
                versionMayor: 1,
                versionMenor: 0,
                versionLabel: '1.0',
                estado: initialStatus,
                autorId: userId || null,
                autorNombre: userName || null,
                aprobadorId: finalAprobadorId,
                aprobadorNombre: finalAprobadorNombre,
                motivoCambio: 'Carga inicial de archivo',
                documentSnapshot: {
                    titulo: docTitle,
                    codigoDocumental: generatedCode,
                    tipoDocumento,
                    area,
                    estado: initialStatus,
                    fechaEmision: new Date()
                }
            }
        });

        // Attach file
        const file = await prisma.documentFile.create({
            data: {
                versionId: version.id,
                nombreArchivo: fileName,
                tipoArchivo: fileType || 'application/octet-stream',
                tamanioBytes: fileSize || 0,
                url: fileContent,
                esPrincipal: true,
                hashArchivo: `SHA-256-QUICK-${Date.now()}`
            }
        });

        // Update hash in doc
        await prisma.controlledDocument.update({
            where: { id: doc.id },
            data: { hashDocumental: file.hashArchivo }
        });

        return NextResponse.json({
            success: true,
            document: doc,
            version,
            file
        });
    } catch (e: any) {
        console.error('Error al subir archivo:', e);
        return NextResponse.json({ error: 'Error al procesar la subida del archivo', details: e.message }, { status: 500 });
    }
}
