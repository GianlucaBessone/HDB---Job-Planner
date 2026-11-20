import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { wizardSchema, crearProyectoWizard } from '@/lib/proyectos/wizard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/wizard — crea un proyecto desde el asistente (manual o desde un
 * presupuesto aceptado) en una sola transacción. POST /api/projects sigue igual.
 */
export async function POST(req: NextRequest) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, wizardSchema);
    if (body instanceof NextResponse) return body;
    try {
        const project = await crearProyectoWizard(body.data, s.usuario, { puedeConvertir: s.acceso.puede('presupuestos.convertir') });
        return NextResponse.json({ project, message: `Proyecto ${project.codigoProyecto} creado` }, { status: 201 });
    } catch (e) {
        return responderError(e, 'projects/wizard POST');
    }
}
