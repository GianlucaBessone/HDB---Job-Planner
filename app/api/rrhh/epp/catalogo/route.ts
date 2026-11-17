import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEppItem, getEppCatalog } from '@/lib/rrhh/eppServer';
import { leerBody, responder, sesionEpp } from '@/lib/rrhh/eppSesion';

export const dynamic = 'force-dynamic';

const crearSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre del elemento es requerido').max(200),
    codigo: z.string().trim().max(60).optional(),
    descripcion: z.string().max(2000).optional(),
    categoria: z.string().trim().min(1, 'La categoría es requerida').max(100),
    esGlobal: z.boolean(),
    diasValidez: z.coerce.number().int().min(1).max(3650),
    stockActual: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
    stockMinimo: z.coerce.number().int().min(0),
    talle: z.string().max(60).optional(),
    marca: z.string().max(120).optional(),
    normaCertificacion: z.string().max(200).optional(),
});

/** Catálogo completo. Lo usan la vista de EPP y el modal de entrega. */
export async function GET(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_ver', 'rrhh.epp_entregar']);
    if (sesion instanceof NextResponse) return sesion;
    return responder(await getEppCatalog(), 500);
}

/** Alta de un elemento de EPP. */
export async function POST(req: Request) {
    const sesion = await sesionEpp(req, ['rrhh.epp_gestionar']);
    if (sesion instanceof NextResponse) return sesion;
    const body = await leerBody(req, crearSchema);
    if (body instanceof NextResponse) return body;
    return responder(await createEppItem(sesion.usuario, body.data));
}
