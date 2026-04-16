import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { OSPdf } from '@/components/OSPdf';
import { createElement } from 'react';

// Helper: read a Node.js ReadableStream into a Buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

const include = {
    project: {
        select: {
            id: true,
            nombre: true,
            codigoProyecto: true,
            cliente: true,
            fechaInicio: true,
            fechaFin: true,
            client: { select: { nombre: true } },
            responsableUser: { select: { nombreCompleto: true } },
        },
    },
    materiales: true,
    operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
    firma: true,
} as const;

// GET /api/ordenes-servicio/[id]/pdf
// Accepts both the internal OS id and the public token (linkPublico)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        // Try by internal id first, fallback to linkPublico (token)
        let os = await prisma.ordenServicio.findUnique({ where: { id }, include });
        if (!os) {
            os = await prisma.ordenServicio.findUnique({ where: { linkPublico: id }, include });
        }

        if (!os) {
            return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
        }

        // Use absolute origin for the logo
        const origin = new URL(req.url).origin;
        const logoUrl = `${origin}/logo-hdb.jpg`;

        // Render PDF server-side using renderToStream (Node.js compatible)
        const element = createElement(OSPdf, { os: os as any, logoUrl });
        const stream = await renderToStream(element as any);
        const buffer = await streamToBuffer(stream);

        const osCode = os.codigoOS || `OS-${os.id.slice(-8).toUpperCase()}`;
        const filename = `${osCode}_${os.project.nombre.replace(/\s+/g, '_')}.pdf`;

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e) {
        console.error('GET OS PDF error:', e);
        return NextResponse.json(
            { error: 'Error al generar el PDF', details: String(e) },
            { status: 500 }
        );
    }
}
