import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get('tipo');
        const area = searchParams.get('area');
        const estado = searchParams.get('estado');
        const criticidad = searchParams.get('criticidad');
        const search = searchParams.get('search');
        const vencidos = searchParams.get('vencidos');

        const where: any = {};

        if (tipo) where.tipoDocumento = tipo;
        if (area) where.area = area;
        if (estado) where.estado = estado;
        if (criticidad) where.nivelCriticidad = criticidad;

        if (search) {
            where.OR = [
                { titulo: { contains: search, mode: 'insensitive' } },
                { codigoDocumental: { contains: search, mode: 'insensitive' } },
                { responsableNombre: { contains: search, mode: 'insensitive' } },
                { observaciones: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Filtrar documentos con próxima revisión vencida
        if (vencidos === 'true') {
            where.proximaRevision = { lte: new Date() };
            where.estado = { not: 'obsoleto' };
        }

        const docs = await prisma.controlledDocument.findMany({
            where,
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1,
                    include: {
                        files: { where: { esPrincipal: true }, take: 1 }
                    }
                },
                _count: {
                    select: {
                        versions: true,
                        readConfirmations: true,
                        alerts: { where: { leido: false } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Enrich with computed status indicators
        const enriched = docs.map(doc => {
            let indicadorVencimiento: 'vigente' | 'proximo' | 'vencido' | 'sin_fecha' = 'sin_fecha';
            if (doc.proximaRevision) {
                const now = new Date();
                const diff = doc.proximaRevision.getTime() - now.getTime();
                const daysDiff = diff / (1000 * 60 * 60 * 24);
                if (daysDiff < 0) indicadorVencimiento = 'vencido';
                else if (daysDiff <= 30) indicadorVencimiento = 'proximo';
                else indicadorVencimiento = 'vigente';
            }
            if (doc.estado === 'obsoleto') indicadorVencimiento = 'vencido';

            return {
                ...doc,
                indicadorVencimiento,
                versionActual: `${doc.versionMayor}.${doc.versionMenor}`,
            };
        });

        return NextResponse.json(enriched);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener documentos', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            titulo, tipoDocumento, area,
            responsableId, responsableNombre, aprobadorId, aprobadorNombre,
            revisadorId, revisadorNombre, descripcion,
            requiereConfirmacionLectura, requiereCapacitacion, nivelCriticidad,
            documentoReemplazadoId, motivoCambio,
            tags, observaciones, proximaRevision, validezMeses,
            userId, userName, creatorSignature
        } = data;

        if (!titulo?.trim()) {
            return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
        }
        if (!tipoDocumento?.trim() || !area?.trim()) {
            return NextResponse.json({ error: 'Tipo de documento y área son obligatorios' }, { status: 400 });
        }

        const prefix = `${tipoDocumento.toUpperCase()}-${area.toUpperCase()}-`;
        
        const getNextCode = async () => {
            const docs = await prisma.controlledDocument.findMany({
                where: { codigoDocumental: { startsWith: prefix } },
                select: { codigoDocumental: true }
            });
            let maxNumber = 0;
            for (const doc of docs) {
                const parts = doc.codigoDocumental.split('-');
                if (parts.length >= 3) {
                    const numPart = parts[parts.length - 1];
                    const num = parseInt(numPart, 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
            return maxNumber + 1;
        };

        let nextNumber = await getNextCode();
        if (nextNumber > 999) {
            return NextResponse.json({ error: 'No es posible generar un nuevo identificador. Se alcanzó el máximo permitido para la serie documental.' }, { status: 400 });
        }
        
        let generatedCode = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        
        // Verificar por si hubo race condition simple
        let existing = await prisma.controlledDocument.findUnique({
            where: { codigoDocumental: generatedCode }
        });
        
        if (existing) {
            nextNumber = await getNextCode();
            if (nextNumber > 999) {
                return NextResponse.json({ error: 'No es posible generar un nuevo identificador. Se alcanzó el máximo permitido para la serie documental.' }, { status: 400 });
            }
            generatedCode = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
            
            existing = await prisma.controlledDocument.findUnique({
                where: { codigoDocumental: generatedCode }
            });
            
            if (existing) {
                return NextResponse.json({ error: 'Hubo un conflicto al generar el código documental, por favor intente nuevamente.' }, { status: 409 });
            }
        }

        // Fetch user's position for signature block
        const operator = await prisma.operator.findUnique({
            where: { id: userId },
            select: { posicion: true }
        });
        const userPosition = operator?.posicion || '';

        // If there are reviewers/approvers, it must go to en_revision. 
        // If there are none AND the creator signed, it goes straight to vigente.
        let estadoInicial = 'borrador';
        if (revisadorId || aprobadorId) {
            estadoInicial = 'en_revision';
        } else if (creatorSignature) {
            estadoInicial = 'vigente';
        }

        const workflowState = {
            creatorStatus: creatorSignature ? 'approved' : 'pending',
            creatorSignature: creatorSignature || null,
            creatorSignatureDate: new Date().toISOString(),
            creatorPosition: userPosition,
            editorName: userName || null,
            editorPosition: userPosition,
            revisadorStatus: revisadorId ? 'pending' : 'none',
            revisadorComment: null,
            revisadorSignature: null,
            revisadorSignatureDate: null,
            aprobadorStatus: aprobadorId ? 'pending' : 'none',
            aprobadorComment: null,
            aprobadorSignature: null,
            aprobadorSignatureDate: null,
            history: [
                {
                    user: userName || 'Creador',
                    posicion: userPosition,
                    action: 'created',
                    date: new Date().toISOString(),
                    comment: 'Creación inicial del documento',
                    signature: creatorSignature || null
                }
            ]
        };

        const doc = await prisma.controlledDocument.create({
            data: {
                codigoDocumental: generatedCode,
                titulo: titulo.trim(),
                tipoDocumento,
                area,
                estado: estadoInicial,
                versionMayor: 1,
                versionMenor: 0,
                descripcion: descripcion || null,
                responsableId: responsableId || null,
                responsableNombre: responsableNombre || null,
                revisadorId: revisadorId || null,
                revisadorNombre: revisadorNombre || null,
                aprobadorId: aprobadorId || null,
                aprobadorNombre: aprobadorNombre || null,
                requiereConfirmacionLectura: requiereConfirmacionLectura || false,
                requiereCapacitacion: requiereCapacitacion || false,
                nivelCriticidad: nivelCriticidad || 'media',
                validezMeses: validezMeses ? parseInt(validezMeses) : null,
                documentoReemplazadoId: documentoReemplazadoId || null,
                motivoCambio: motivoCambio || null,
                tags: tags || [],
                observaciones: observaciones || null,
                proximaRevision: proximaRevision ? new Date(proximaRevision) : null,
                createdBy: userId || null,
                createdByName: userName || null,
                workflowState: workflowState as any,
            }
        });

        // Create initial version v1.0
        await prisma.documentVersion.create({
            data: {
                documentId: doc.id,
                versionMayor: 1,
                versionMenor: 0,
                versionLabel: '1.0',
                estado: estadoInicial,
                autorId: userId || null,
                autorNombre: userName || null,
                motivoCambio: 'Creación inicial del documento',
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'CREATE',
            entity: 'CONTROLLED_DOCUMENT',
            entityId: doc.id,
            newValue: doc,
        });

        // Push Notifications for Reviewers and Approvers
        if (estadoInicial === 'en_revision') {
            const notifiedUserIds: string[] = [];
            if (revisadorId) notifiedUserIds.push(revisadorId);
            if (aprobadorId && aprobadorId !== revisadorId) notifiedUserIds.push(aprobadorId);

            if (notifiedUserIds.length > 0) {
                const { sendPushNotification } = await import('@/lib/onesignal');
                await sendPushNotification({
                    userIds: notifiedUserIds,
                    title: "Revisión Documental Requerida",
                    message: `Se ha creado el documento "${doc.codigoDocumental}" y requiere tu firma/revisión.`,
                    data: { route: `/calidad/documentos/${doc.id}` }
                }).catch(e => console.error("Error sending push notification to reviewers:", e));
            }
        }

        return NextResponse.json(doc);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear documento', details: e.message }, { status: 500 });
    }
}
