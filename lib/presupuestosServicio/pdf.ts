import { renderToStream } from '@react-pdf/renderer';
import { createElement } from 'react';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { includeVersion } from '@/lib/presupuestosServicio/servicio';
import { hoyArgentina, type OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';
import { PresupuestoPdfDocument } from '@/components/presupuestosServicio/PresupuestoPdfDocument';

/**
 * PDF de una revisión del presupuesto de servicio. Lo usan la pantalla interna y el portal del cliente, así el
 * cliente ve exactamente el mismo documento que se le envió.
 */

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

type Presupuesto = { numero: string; titulo: string; clienteNombre: string; versionActual: number; fechaVencimiento: string | null; cliente: { direccion: string | null; telefono: string | null; email: string | null } | null };
type Version = NonNullable<Awaited<ReturnType<typeof cargarVersion>>>;

export function cargarVersion(presupuestoId: string, version: number) {
    return prisma.presupuestoServicioVersion.findUnique({
        where: { presupuestoId_version: { presupuestoId, version } },
        include: includeVersion,
    });
}

export async function renderPdfPresupuesto(p: Presupuesto, v: Version, opciones: OpcionesDocumento): Promise<Buffer> {
    let logoBase64: string | null = null;
    try {
        const logo = path.join(process.cwd(), 'public', 'logo-hdb.jpg');
        if (fs.existsSync(logo)) logoBase64 = `data:image/jpeg;base64,${fs.readFileSync(logo).toString('base64')}`;
    } catch {
        /* sin logo */
    }

    const fechaEmision = v.enviadaEn ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(v.enviadaEn) : hoyArgentina();
    const element = createElement(PresupuestoPdfDocument, {
        numero: p.numero,
        titulo: p.titulo,
        cliente: {
            nombre: p.clienteNombre,
            direccion: p.cliente?.direccion,
            telefono: p.cliente?.telefono,
            email: p.cliente?.email,
        },
        version: {
            ...v,
            tareas: v.tareas.map((t) => ({ ...t, manoObra: t.manoObra })),
        },
        opciones,
        fechaEmision,
        fechaVencimiento: v.version === p.versionActual ? p.fechaVencimiento : null,
        logoBase64,
        borrador: v.estado === 'borrador',
    });
    const buffer = await streamToBuffer(await renderToStream(element as any));
    return buffer;
}
