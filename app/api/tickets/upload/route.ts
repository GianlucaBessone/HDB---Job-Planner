import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TICKET_ADJUNTO_MAX_BYTES, TICKET_ADJUNTOS_MAX } from '@/lib/tickets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Tipo real según la firma del archivo, con su mime y las extensiones aceptadas.
const TIPOS = [
    { mime: 'image/png', extensiones: ['png'], firma: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { mime: 'image/jpeg', extensiones: ['jpg', 'jpeg'], firma: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/gif', extensiones: ['gif'], firma: (b: Buffer) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')) },
    { mime: 'image/webp', extensiones: ['webp'], firma: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
    { mime: 'application/pdf', extensiones: ['pdf'], firma: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];

// Los adjuntos que nunca se vincularon a un ticket se borran pasado este tiempo.
const HUERFANOS_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
        }

        const formData = await req.formData();
        const files = formData.getAll('files').filter((f): f is File => f instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
        }

        if (files.length > TICKET_ADJUNTOS_MAX) {
            return NextResponse.json(
                { error: `Máximo ${TICKET_ADJUNTOS_MAX} archivos por ticket.` },
                { status: 400 }
            );
        }

        const validados: Array<{ nombre: string; mime: string; datos: Buffer }> = [];

        for (const file of files) {
            if (!file.name || file.size === 0) continue;

            if (file.size > TICKET_ADJUNTO_MAX_BYTES) {
                return NextResponse.json(
                    { error: `El archivo ${file.name} supera los ${(TICKET_ADJUNTO_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.` },
                    { status: 400 }
                );
            }

            const datos = Buffer.from(await file.arrayBuffer());
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const tipo = TIPOS.find(t => t.firma(datos));

            // El contenido, el mime declarado y la extensión tienen que coincidir.
            if (!tipo || tipo.mime !== file.type || !tipo.extensiones.includes(extension)) {
                return NextResponse.json(
                    { error: `${file.name}: solo se permiten imágenes (PNG, JPG, WEBP, GIF) o PDF.` },
                    { status: 400 }
                );
            }

            validados.push({ nombre: file.name.slice(0, 200), mime: tipo.mime, datos });
        }

        if (validados.length === 0) {
            return NextResponse.json({ error: 'Los archivos recibidos están vacíos.' }, { status: 400 });
        }

        await prisma.ticketAdjunto.deleteMany({
            where: { ticketId: null, createdAt: { lt: new Date(Date.now() - HUERFANOS_MS) } },
        });

        const archivos = [];
        for (const v of validados) {
            const creado = await prisma.ticketAdjunto.create({
                data: { subidoPorId: userId, nombre: v.nombre, mime: v.mime, size: v.datos.length, datos: v.datos },
                select: { id: true, nombre: true, size: true },
            });
            archivos.push({ ...creado, url: `/api/tickets/adjuntos/${creado.id}` });
        }

        return NextResponse.json({ archivos });
    } catch (error) {
        console.error('[TICKETS_UPLOAD]', error);
        return NextResponse.json({ error: 'Error al subir los archivos.' }, { status: 500 });
    }
}
