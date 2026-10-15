import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

        return new Response(buffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `inline; filename="${encodeURIComponent(file.nombreArchivo)}"`,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e: any) {
        console.error('Error visualizando archivo:', e);
        return NextResponse.json({ error: 'Error al visualizar archivo', details: e.message }, { status: 500 });
    }
}
