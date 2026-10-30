import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { TICKET_ADJUNTO_MAX_BYTES, TICKET_ADJUNTOS_MAX } from '@/lib/tickets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'];

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
        }

        if (files.length > TICKET_ADJUNTOS_MAX) {
            return NextResponse.json(
                { error: `Máximo ${TICKET_ADJUNTOS_MAX} archivos por ticket.` },
                { status: 400 }
            );
        }

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'tickets');
        await fs.mkdir(uploadsDir, { recursive: true });

        const guardados: Array<{ nombre: string; url: string; size: number }> = [];

        for (const file of files) {
            if (!file.name || file.size === 0) continue;

            if (file.size > TICKET_ADJUNTO_MAX_BYTES) {
                return NextResponse.json(
                    { error: `El archivo ${file.name} supera los ${(TICKET_ADJUNTO_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.` },
                    { status: 400 }
                );
            }

            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const mimeValido = ALLOWED_MIME_TYPES.includes(file.type);
            const extensionValida = ALLOWED_EXTENSIONS.includes(extension);

            if (!mimeValido && !extensionValida) {
                return NextResponse.json(
                    { error: 'Solo se permiten imágenes (PNG, JPG, WEBP, GIF) o PDF.' },
                    { status: 400 }
                );
            }

            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}`;
            const bytes = await file.arrayBuffer();

            await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));

            guardados.push({
                nombre: file.name,
                url: `/uploads/tickets/${filename}`,
                size: file.size,
            });
        }

        return NextResponse.json({ archivos: guardados });
    } catch (error) {
        console.error('[TICKETS_UPLOAD]', error);
        return NextResponse.json({ error: 'Error al subir los archivos.' }, { status: 500 });
    }
}
