import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { borrarDocumento, editarDocumento } from '@/lib/legajo';
import { leerFormularioDocumento, respuestaError } from '@/lib/legajoApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ docId: string }> };

/** PATCH /api/rrhh/legajos/documentos/[docId] — multipart: `datos`, `archivo` (reemplaza) o `quitarArchivo=1`. */
export async function PATCH(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { docId } = await params;
    const f = await leerFormularioDocumento(req, true);
    if ('error' in f) return NextResponse.json({ error: f.error }, { status: 400 });
    const d = f.datos;
    if (d.fechaEmision && d.fechaVencimiento && d.fechaVencimiento < d.fechaEmision) {
        return NextResponse.json({ error: 'El vencimiento no puede ser anterior a la emisión' }, { status: 400 });
    }
    try {
        const doc = await editarDocumento(docId, d, f.archivo, f.quitarArchivo);
        await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: 'UPDATE', entity: 'DocumentoPersonal', entityId: docId, metadata: { operatorId: doc.operatorId, campos: Object.keys(d), archivo: f.archivo ? 'reemplazado' : f.quitarArchivo ? 'quitado' : 'sin cambios' } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'editar documento');
    }
}

/** DELETE /api/rrhh/legajos/documentos/[docId] — borra el documento y su archivo. */
export async function DELETE(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const { docId } = await params;
    try {
        const doc = await borrarDocumento(docId);
        await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: 'DELETE', entity: 'DocumentoPersonal', entityId: docId, metadata: { operatorId: doc.operatorId, tipo: doc.tipo, nombre: doc.nombre } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'borrar documento');
    }
}
