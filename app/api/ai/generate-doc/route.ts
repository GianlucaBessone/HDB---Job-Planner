import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';
import { IsoDocGenOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { proceso, sector, alcance, responsables, userId, userName, userRole, saveAsDraft } = body;
        const descripcion = body.descripcion || body.detallesAdicionales || '';

        // 1. Validaciones de Entrada
        if (!proceso || !sector || !alcance || !descripcion) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: proceso, sector, alcance y descripción.' }, { status: 400 });
        }

        // 2. Control de Permisos
        const allowedRoles = ['admin', 'qa', 'supervisor'];
        if (userRole && !allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes. Rol no autorizado para generar documentación controlada.' }, { status: 403 });
        }

        // Fetch user roles / positions dynamically from the system config (Operator database table)
        const activeOperators = await prisma.operator.findMany({
            select: { posicion: true },
            where: {
                activo: true,
                posicion: { not: null }
            }
        });
        const systemPositions = Array.from(new Set(activeOperators.map(o => o.posicion).filter(Boolean)));
        const rolesSistemaStr = systemPositions.length > 0
            ? systemPositions.join(', ')
            : 'Técnico/Operador, Supervisor, Administración, Quality Assurance Manager, CEO';

        // Fetch all existing controlled documents in the system for cross-referencing and queue evaluations
        const existingDocs = await prisma.controlledDocument.findMany({
            select: {
                id: true,
                codigoDocumental: true,
                titulo: true
            }
        });
        const documentosExistentesStr = existingDocs.length > 0
            ? existingDocs.map(d => `[ID: ${d.id}, Código: ${d.codigoDocumental}, Título: ${d.titulo}]`).join('\n')
            : 'No hay otros documentos en el sistema.';

        // 3. Generación mediante la Capa Centralizada de IA
        const aiResponse = await generateContent<IsoDocGenOutput>(
            'ISO_DOC_GEN',
            { 
                proceso, 
                sector, 
                alcance, 
                responsables: responsables || 'No definido', 
                descripcion,
                documentosExistentes: documentosExistentesStr,
                rolesSistema: rolesSistemaStr
            },
            {
                userId,
                userName,
                userRole,
                entity: 'ControlledDocument',
                temperature: 0.3
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al generar el documento ISO' }, { status: 500 });
        }

        const generatedDoc = aiResponse.data;

        // Ensure definitions format is clean and mapped to term / definition
        const finalDefiniciones = (generatedDoc.definiciones || []).map((d: any) => ({
            term: d.term || d.termino || '',
            definition: d.definition || d.definicion || ''
        })).filter(d => d.term && d.definition);

        // Ensure references format is clean
        const finalReferencias = (generatedDoc.referencias || []).map((r: any) => ({
            docId: r.docId || null,
            codigo: r.codigo || 'EXTERNO',
            titulo: r.titulo || ''
        })).filter(r => r.titulo);

        const mappedDoc = {
            codigoDocumental: generatedDoc.codigoDocumental || 'PR-OPE-001',
            titulo: generatedDoc.titulo || 'Procedimiento Sugerido',
            descripcion: generatedDoc.descripcion || '',
            objetivo: generatedDoc.objetivo || '',
            alcance: generatedDoc.alcance || '',
            desarrollo: generatedDoc.desarrollo || '',
            responsabilidades: generatedDoc.responsabilidades || '',
            definiciones: finalDefiniciones,
            referencias: finalReferencias
        };

        // 4. Guardar como borrador si el usuario lo solicita
        let savedDbDoc = null;
        if (saveAsDraft && userId) {
            // Verificar si ya existe un documento con ese código
            const existing = await prisma.controlledDocument.findUnique({
                where: { codigoDocumental: mappedDoc.codigoDocumental }
            });

            if (!existing) {
                // Fetch creator's position
                const operator = await prisma.operator.findUnique({
                    where: { id: userId },
                    select: { posicion: true }
                });
                const userPosition = operator?.posicion || 'Creador IA';

                // Initial workflow state
                const workflowState = {
                    creatorStatus: 'pending',
                    creatorPosition: userPosition,
                    editorName: userName || 'Asistente IA',
                    editorPosition: userPosition,
                    revisadorStatus: 'none',
                    aprobadorStatus: 'none',
                    history: [
                        {
                            user: userName || 'Asistente IA',
                            posicion: userPosition,
                            action: 'ai_draft_generated',
                            date: new Date().toISOString(),
                            comment: 'Borrador generado automáticamente mediante Inteligencia Artificial Google Gemini.',
                            signature: null
                        }
                    ]
                };

                // Create the controlled document draft in DB
                savedDbDoc = await prisma.controlledDocument.create({
                    data: {
                        codigoDocumental: mappedDoc.codigoDocumental.trim().toUpperCase(),
                        titulo: mappedDoc.titulo.trim(),
                        tipoDocumento: 'Procedimiento',
                        area: sector,
                        estado: 'borrador',
                        versionMayor: 1,
                        versionMenor: 0,
                        descripcion: mappedDoc.descripcion || null,
                        observaciones: 'Borrador inicial sugerido por IA.',
                        tags: [proceso, sector],
                        createdBy: userId,
                        createdByName: userName,
                        workflowState: workflowState as any,
                        versions: {
                            create: {
                                versionMayor: 1,
                                versionMenor: 0,
                                versionLabel: '1.0',
                                estado: 'borrador',
                                autorId: userId,
                                autorNombre: userName,
                                motivoCambio: 'Creación de borrador inicial por IA.',
                                notas: `Estructura generada:\n\n### Objetivo\n${mappedDoc.objetivo}\n\n### Alcance\n${mappedDoc.alcance}\n\n### Desarrollo\n${mappedDoc.desarrollo}\n\n### Responsabilidades\n${mappedDoc.responsabilidades}`
                            }
                        }
                    },
                    include: {
                        versions: true
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            document: mappedDoc,
            dbDraft: savedDbDoc,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][IsoDocGen] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
