import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { fileName, fileType, fileSize, fileContent, userId, userName } = data;

        if (!fileContent || !fileName || !fileType) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios (fileContent, fileName, fileType)' }, { status: 400 });
        }

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1
                }
            }
        });

        if (!doc || doc.versions.length === 0) {
            return NextResponse.json({ error: 'Documento o versión no encontrada' }, { status: 404 });
        }

        const latestVersion = doc.versions[0];

        // Overwrite or delete existing files for this version to ensure only 1 principal file
        await prisma.documentFile.deleteMany({
            where: { versionId: latestVersion.id }
        });

        const newFile = await prisma.documentFile.create({
            data: {
                versionId: latestVersion.id,
                nombreArchivo: fileName,
                tipoArchivo: fileType,
                tamanioBytes: fileSize || 0,
                url: fileContent, // Base64 data
                esPrincipal: true
            }
        });

        // Also update the document with a hash placeholder
        await prisma.controlledDocument.update({
            where: { id: params.id },
            data: {
                hashDocumental: `SHA-256-PLACEHOLDER-${newFile.id}`
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'DOCUMENT_VERSION',
            entityId: latestVersion.id,
            newValue: { fileId: newFile.id, fileName }
        });

        return NextResponse.json({ success: true, file: newFile });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al subir el archivo', details: e.message }, { status: 500 });
    }
}
