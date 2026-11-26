import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { crearDocumento } from '@/lib/legajo';
import { leerFormularioDocumento, respuestaError } from '@/lib/legajoApi';

export const dynamic = 'force-dynamic';

/** POST /api/rrhh/legajos/[id]/documentos — multipart: `datos` (JSON) y `archivo` opcional (PDF o imagen). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const f = await leerFormularioDocumento(req, false);
    if ('error' in f) return NextResponse.json({ error: f.error }, { status: 400 });
    try {
        const doc = await crearDocumento(id, f.datos, f.archivo, acceso.nombre);
        await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: 'CREATE', entity: 'DocumentoPersonal', entityId: doc.id, metadata: { operatorId: id, tipo: f.datos.tipo, nombre: doc.nombre, adjunto: !!f.archivo } });
        return NextResponse.json({ documento: doc }, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'crear documento');
    }
}
