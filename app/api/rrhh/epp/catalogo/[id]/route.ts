import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateEppItem } from '@/lib/rrhh/eppServer';
import { idSchema, leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const editarSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre del elemento es requerido').max(200).optional(),
    codigo: z.string().trim().max(60).optional(),
    descripcion: z.string().max(2000).optional(),
    categoria: z.string().trim().min(1).max(100).optional(),
    esGlobal: z.boolean().optional(),
    diasValidez: z.coerce.number().int().min(1).max(3650).optional(),
    stockMinimo: z.coerce.number().int().min(0).optional(),
    talle: z.string().max(60).optional(),
    marca: z.string().max(120).optional(),
    normaCertificacion: z.string().max(200).optional(),
    activo: z.boolean().optional(),
    ajusteStock: z.object({
        nuevoStock: z.coerce.number().int().min(0, 'La cantidad de stock no puede ser un número negativo'),
        motivo: z.string().trim().min(1, 'Debe ingresar un motivo obligatorio para auditar el ajuste de stock').max(500),
    }).optional(),
});

/** Edición de un elemento y ajuste manual de stock (queda a nombre del usuario de la sesión). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return responder({ success: false, error: 'Elemento inválido' });
    const body = await leerBody(req, editarSchema);
    if (body instanceof NextResponse) return body;
    return responder(await updateEppItem(sesion.usuario, id.data, body.data));
}
