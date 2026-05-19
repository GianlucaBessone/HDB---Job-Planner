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
            codigoDocumental, titulo, tipoDocumento, area,
            responsableId, responsableNombre, aprobadorId, aprobadorNombre,
            revisadorId, revisadorNombre, descripcion,
            requiereConfirmacionLectura, requiereCapacitacion, nivelCriticidad,
            documentoReemplazadoId, motivoCambio,
            tags, observaciones, proximaRevision, validezMeses,
            userId, userName, creatorSignature
        } = data;

        if (!codigoDocumental?.trim() || !titulo?.trim()) {
            return NextResponse.json({ error: 'Código y título son obligatorios' }, { status: 400 });
        }
        if (!tipoDocumento?.trim() || !area?.trim()) {
            return NextResponse.json({ error: 'Tipo de documento y área son obligatorios' }, { status: 400 });
        }

        // Check unique code
        const existing = await prisma.controlledDocument.findUnique({
            where: { codigoDocumental: codigoDocumental.trim().toUpperCase() }
        });
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un documento con ese código documental' }, { status: 409 });
        }

        const estadoInicial = (revisadorId || aprobadorId) ? 'en_revision' : 'borrador';

        const workflowState = {
            creatorSignature: creatorSignature || null,
            creatorSignatureDate: new Date().toISOString(),
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
                    action: 'created',
                    date: new Date().toISOString(),
                    comment: 'Creación inicial del documento',
                    signature: creatorSignature || null
                }
            ]
        };

        const doc = await prisma.controlledDocument.create({
            data: {
                codigoDocumental: codigoDocumental.trim().toUpperCase(),
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

        return NextResponse.json(doc);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear documento', details: e.message }, { status: 500 });
    }
}
