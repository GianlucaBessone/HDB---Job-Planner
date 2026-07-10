import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { TechnicalReportPdf } from '@/components/TechnicalReportPdf';
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
    template: true,
    project: { select: { nombre: true, codigoProyecto: true } },
    client: { select: { nombre: true } },
    responsable: { select: { nombreCompleto: true } },
    personnel: { include: { operator: { select: { nombreCompleto: true } } } },
    signature: true
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const report = await prisma.technicalReport.findUnique({
            where: { id: params.id },
            include
        });

        if (!report) {
            return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        }

        const origin = new URL(req.url).origin;
        const logoUrl = `${origin}/logo-hdb.jpg`;

        let qrCodeUrl = undefined;
        if (report.signature?.SignatureID) {
            const verifyUrl = `${origin}/public/informe/${report.signature.SignatureID}`;
            qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
        }

        const element = createElement(TechnicalReportPdf, { report, logoUrl, qrCodeUrl });
        const stream = await renderToStream(element as any);
        const buffer = await streamToBuffer(stream);

        const filename = `${report.reportNumber}_${report.template?.name?.replace(/\s+/g, '_')}.pdf`;

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e) {
        console.error('GET Technical Report PDF error:', e);
        return NextResponse.json(
            { error: 'Error al generar el PDF', details: String(e) },
            { status: 500 }
        );
    }
}
