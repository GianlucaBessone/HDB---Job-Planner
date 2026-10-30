import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertOfficeToPdf, isOfficeDocument } from '@/lib/officeToPdf';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1,
                    include: {
                        files: {
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!doc || doc.versions.length === 0 || doc.versions[0].files.length === 0) {
            return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        }

        const file = doc.versions[0].files.find(f => f.esPrincipal) || doc.versions[0].files[0];
        let base64Data = file.url || '';
        let mimeType = file.tipoArchivo || 'application/octet-stream';

        if (base64Data.startsWith('data:')) {
            const commaIndex = base64Data.indexOf(',');
            if (commaIndex !== -1) {
                const header = base64Data.slice(0, commaIndex);
                base64Data = base64Data.slice(commaIndex + 1);
                const mimeMatch = header.match(/^data:([^;]+)/);
                if (mimeMatch) {
                    mimeType = mimeMatch[1];
                }
            }
        }

        const buffer = Buffer.from(base64Data, 'base64');
        let responseBuffer: Buffer = buffer;
        let responseMimeType = mimeType;
        let responseFileName = file.nombreArchivo;

        // If it's an Office document (PowerPoint, Word, Excel), convert to PDF for online viewing
        if (isOfficeDocument(file.nombreArchivo)) {
            try {
                const converted = await convertOfficeToPdf(buffer, file.nombreArchivo, file.id);
                if (converted && converted.pdfBuffer) {
                    responseBuffer = Buffer.from(converted.pdfBuffer);
                    responseMimeType = 'application/pdf';
                    responseFileName = file.nombreArchivo.replace(/\.[^/.]+$/, '.pdf');
                }
            } catch (convErr) {
                console.error('Office to PDF conversion error:', convErr);
            }
        }

        return new Response(new Uint8Array(responseBuffer), {
            headers: {
                'Content-Type': responseMimeType,
                'Content-Disposition': `inline; filename="${encodeURIComponent(responseFileName)}"`,
                'Content-Length': responseBuffer.length.toString(),
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e: any) {
        console.error('Error visualizando archivo:', e);
        return NextResponse.json({ error: 'Error al visualizar archivo', details: e.message }, { status: 500 });
    }
}
