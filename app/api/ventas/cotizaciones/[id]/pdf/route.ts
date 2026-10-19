import { NextResponse } from 'next/server';
import { obtenerCotizacionPorId } from '@/lib/ventas/cotizacionService';
import { renderToStream } from '@react-pdf/renderer';
import { CotizacionPdfDocument } from '@/components/ventas/cotizaciones/CotizacionPdfDocument';
import { createElement } from 'react';
import path from 'path';
import fs from 'fs';

// Helper: read a Node.js ReadableStream into a Buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        let cotizacion: any;
        try {
            cotizacion = await obtenerCotizacionPorId(params.id);
        } catch {
            return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
        }

        // Cargar logo de HDB en base64 de manera segura sin dependencias de red externa
        const localLogoPath = path.join(process.cwd(), 'public', 'logo-hdb.jpg');
        let logoBase64: string | null = null;
        try {
            if (fs.existsSync(localLogoPath)) {
                logoBase64 = `data:image/jpeg;base64,${fs.readFileSync(localLogoPath).toString('base64')}`;
            }
        } catch (err) {
            console.warn('No se pudo cargar el logo local:', err);
        }

        const element = createElement(CotizacionPdfDocument, { cotizacion, logoBase64 });
        const stream = await renderToStream(element as any);
        const buffer = await streamToBuffer(stream);

        const url = new URL(req.url);
        const isDownload = url.searchParams.get('download') === 'true';
        const filename = `Cotizacion_${cotizacion.numero || params.id}.pdf`;
        const dispositionType = isDownload ? 'attachment' : 'inline';

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(filename)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e: any) {
        console.error('GET Cotizacion PDF error:', e);
        return NextResponse.json(
            { error: 'Error al generar el PDF de cotización', details: String(e?.message || e) },
            { status: 500 }
        );
    }
}
