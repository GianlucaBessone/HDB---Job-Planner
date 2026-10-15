import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const isInline = searchParams.get('inline') === 'true';

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

        // Robust base64 extraction
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
        const disposition = isInline ? 'inline' : 'attachment';

        return new Response(buffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.nombreArchivo)}"`,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': isInline ? 'public, max-age=3600' : 'no-cache'
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al descargar archivo', details: e.message }, { status: 500 });
    }
}
