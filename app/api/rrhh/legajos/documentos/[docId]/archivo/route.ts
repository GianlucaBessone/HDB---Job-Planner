import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { storageConfigurado, urlPrefirmada } from '@/lib/objectStorage';

export const dynamic = 'force-dynamic';

/** GET /api/rrhh/legajos/documentos/[docId]/archivo — abre el adjunto con una URL prefirmada de corta duración. */
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const { docId } = await params;
    const doc = await prisma.documentoPersonal.findUnique({ where: { id: docId }, select: { operatorId: true, archivoKey: true, archivoNombre: true, archivoTipo: true } });
    // RRHH o la propia persona (sus documentos)
    if (!acceso.puede('rrhh.legajo_ver') && !acceso.puede('rrhh.legajo_gestionar') && doc?.operatorId !== acceso.userId) {
        return NextResponse.json({ error: 'No tenés permiso para esta acción' }, { status: 403 });
    }
    if (!doc?.archivoKey || !storageConfigurado()) return NextResponse.json({ error: 'El archivo no está disponible' }, { status: 404 });
    return NextResponse.redirect(urlPrefirmada('GET', doc.archivoKey, { descargaComo: doc.archivoNombre || undefined, tipo: doc.archivoTipo || undefined }), 302);
}
