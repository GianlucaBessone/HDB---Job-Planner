import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

import crypto from 'crypto';

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

        // Compute genuine cryptographic SHA-256 hash from file buffer
        let fileHash = '';
        let actualSize = fileSize || 0;
        try {
            const base64Data = typeof fileContent === 'string' && fileContent.includes(',')
                ? fileContent.split(',')[1]
                : fileContent;
            const buffer = Buffer.from(base64Data, 'base64');
            fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
            if (!actualSize) actualSize = buffer.length;
        } catch (hashErr) {
            console.error('Error computing SHA-256 hash:', hashErr);
            fileHash = crypto.createHash('sha256').update(`${fileName}-${Date.now()}`).digest('hex');
        }

        // Overwrite or delete existing files for this version to ensure only 1 principal file
        await prisma.documentFile.deleteMany({
            where: { versionId: latestVersion.id }
        });

        const newFile = await prisma.documentFile.create({
            data: {
                versionId: latestVersion.id,
                nombreArchivo: fileName,
                tipoArchivo: fileType,
                tamanioBytes: actualSize,
                url: fileContent, // Base64 data
                esPrincipal: true,
                hashArchivo: fileHash
            }
        });

        // Also update the document and version with genuine cryptographic hash
        await prisma.controlledDocument.update({
            where: { id: params.id },
            data: {
                hashDocumental: fileHash
            }
        });

        await prisma.documentVersion.update({
            where: { id: latestVersion.id },
            data: {
                hashDocumental: fileHash
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
