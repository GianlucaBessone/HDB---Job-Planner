import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { DEFAULT_ACCESS_STRUCTURE } from '@/lib/constants/documentAccessStructure';

export const dynamic = 'force-dynamic';

async function ensureDefaultAccessStructure() {
    const count = await prisma.documentAccessModule.count();
    if (count === 0) {
        for (const modData of DEFAULT_ACCESS_STRUCTURE) {
            const { subAccesses, ...moduleInfo } = modData;
            const createdModule = await prisma.documentAccessModule.create({
                data: {
                    ...moduleInfo,
                }
            });

            for (const sub of subAccesses) {
                await prisma.documentSubAccess.create({
                    data: {
                        moduleId: createdModule.id,
                        codigo: sub.codigo,
                        nombre: sub.nombre,
                        descripcion: sub.descripcion,
                        icon: sub.icon,
                        orden: sub.orden,
                        esPersonalizado: false,
                    }
                });
            }
        }
    }
}

export async function GET() {
    try {
        await ensureDefaultAccessStructure();

        const modules = await prisma.documentAccessModule.findMany({
            orderBy: { orden: 'asc' },
            include: {
                subAccesses: {
                    orderBy: { orden: 'asc' },
                    include: {
                        _count: {
                            select: { documentos: true }
                        },
                        documentos: {
                            select: {
                                id: true,
                                codigoDocumental: true,
                                titulo: true,
                                tipoDocumento: true,
                                area: true,
                                estado: true,
                                nivelCriticidad: true,
                                versionMayor: true,
                                versionMenor: true,
                                updatedAt: true,
                                versions: {
                                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                                    take: 1,
                                    include: {
                                        files: {
                                            select: {
                                                id: true,
                                                nombreArchivo: true,
                                                tipoArchivo: true,
                                                tamanioBytes: true,
                                                esPrincipal: true
                                            }
                                        }
                                    }
                                }
                            },
                            orderBy: { updatedAt: 'desc' }
                        }
                    }
                }
            }
        });

        // Compute stats
        const totalDocuments = await prisma.controlledDocument.count();
        const unassignedDocuments = await prisma.controlledDocument.count({
            where: { subAccessId: null }
        });

        return NextResponse.json({
            modules,
            totalDocuments,
            unassignedDocuments
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener accesos documentales', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { moduleId, codigo, nombre, descripcion, icon, orden, userId, userName } = body;

        if (!moduleId || !nombre?.trim()) {
            return NextResponse.json({ error: 'El módulo y el nombre del sub-acceso son obligatorios.' }, { status: 400 });
        }

        const parentModule = await prisma.documentAccessModule.findUnique({
            where: { id: moduleId },
            include: { subAccesses: true }
        });

        if (!parentModule) {
            return NextResponse.json({ error: 'Módulo no encontrado.' }, { status: 404 });
        }

        // Auto-generate code if not provided
        let finalCode = codigo?.trim();
        if (!finalCode) {
            const nextSubNumber = parentModule.subAccesses.length + 1;
            finalCode = `${parentModule.codigo}.${nextSubNumber}`;
        }

        const nextOrder = orden ?? (parentModule.subAccesses.length + 1);

        const newSubAccess = await prisma.documentSubAccess.create({
            data: {
                moduleId,
                codigo: finalCode,
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                icon: icon || 'FileText',
                orden: nextOrder,
                esPersonalizado: true,
            },
            include: {
                module: true,
                _count: { select: { documentos: true } }
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'CREATE',
            entity: 'DOCUMENT_SUB_ACCESS',
            entityId: newSubAccess.id,
            newValue: newSubAccess
        });

        return NextResponse.json(newSubAccess);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear sub-acceso', details: e.message }, { status: 500 });
    }
}
