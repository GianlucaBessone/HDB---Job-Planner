import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VIAJE_COMPROBANTE_MAX_BYTES, VIAJE_COMPROBANTES_MAX } from '@/lib/viajes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Tipo real según la firma del archivo.
const TIPOS = [
    { mime: 'image/jpeg', firma: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/png', firma: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { mime: 'image/webp', firma: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
    { mime: 'application/pdf', firma: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];

// Los comprobantes que nunca se vincularon a un gasto se borran pasado este tiempo.
const HUERFANOS_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

        const formData = await req.formData();
        const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
        if (files.length === 0) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
        if (files.length > VIAJE_COMPROBANTES_MAX) {
            return NextResponse.json({ error: `Máximo ${VIAJE_COMPROBANTES_MAX} comprobantes por gasto.` }, { status: 400 });
        }

        const validados: { nombre: string; mime: string; datos: Buffer }[] = [];
        for (const file of files) {
            if (file.size > VIAJE_COMPROBANTE_MAX_BYTES) {
                return NextResponse.json({ error: `${file.name} supera los ${VIAJE_COMPROBANTE_MAX_BYTES / (1024 * 1024)} MB.` }, { status: 400 });
            }
            const datos = Buffer.from(await file.arrayBuffer());
            const tipo = TIPOS.find(t => t.firma(datos));
            if (!tipo) {
                return NextResponse.json({ error: `${file.name}: solo se aceptan fotos (JPG, PNG, WEBP) o PDF.` }, { status: 400 });
            }
            validados.push({ nombre: (file.name || 'comprobante').slice(0, 200), mime: tipo.mime, datos });
        }

        await prisma.viajeComprobante.deleteMany({
            where: { gastoId: null, createdAt: { lt: new Date(Date.now() - HUERFANOS_MS) } },
        });

        const archivos = [];
        for (const v of validados) {
            const creado = await prisma.viajeComprobante.create({
                data: { subidoPorId: userId, nombre: v.nombre, mime: v.mime, size: v.datos.length, datos: v.datos },
                select: { id: true, nombre: true, mime: true, size: true },
            });
            archivos.push(creado);
        }

        return NextResponse.json({ archivos }, { status: 201 });
    } catch (error) {
        console.error('[VIAJES_COMPROBANTE_UPLOAD]', error);
        return NextResponse.json({ error: 'Error al subir el comprobante.' }, { status: 500 });
    }
}
