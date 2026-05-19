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
                            where: { esPrincipal: true },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!doc || doc.versions.length === 0 || doc.versions[0].files.length === 0) {
            return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        }

        const file = doc.versions[0].files[0];
        let base64Data = file.url;

        // If it starts with a data URI prefix, extract it
        if (base64Data.startsWith('data:')) {
            const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
            if (matches && matches.length === 3) {
                base64Data = matches[2];
            }
        }

        const buffer = Buffer.from(base64Data, 'base64');

        return new Response(buffer, {
            headers: {
                'Content-Type': file.tipoArchivo,
                'Content-Disposition': `attachment; filename="${file.nombreArchivo}"`
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al descargar archivo', details: e.message }, { status: 500 });
    }
}
