import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorCompra } from '@/lib/compras';

/** Validaciones y respuesta de error comunes de las rutas de compras. */

const fechaOpcional = z
    .union([z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
        if (v === undefined) return undefined;
        if (v === null || v === '') return null;
        const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
        if (isNaN(d.getTime())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida' });
            return z.NEVER;
        }
        return d;
    });

export const itemOrdenSchema = z.object({
    productoId: z.string().min(1),
    cantidad: z.coerce.number().positive('La cantidad tiene que ser mayor a cero').max(1_000_000),
    costoUnitario: z.coerce.number().min(0).max(1_000_000_000).default(0),
});

export const ordenSchema = z.object({
    proveedorId: z.string().min(1, 'Elegí el proveedor'),
    almacenId: z.string().min(1, 'Elegí el almacén'),
    fechaEsperada: fechaOpcional,
    observaciones: z.string().max(2000).nullable().optional(),
    items: z.array(itemOrdenSchema).min(1, 'Agregá al menos un producto').max(300),
});

export const recepcionSchema = z.object({
    items: z.array(z.object({ itemId: z.string().min(1), cantidad: z.coerce.number().min(0).max(1_000_000) })).min(1).max(300),
    remito: z.string().max(60).nullable().optional(),
    observaciones: z.string().max(2000).nullable().optional(),
    fecha: fechaOpcional,
    actualizarCostos: z.boolean().optional(),
});

export function primerError(e: z.ZodError) {
    return e.issues[0]?.message || 'Datos inválidos';
}

export function respuestaError(error: unknown, contexto: string) {
    if (error instanceof ErrorCompra) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`Error en compras (${contexto}):`, error);
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 });
}
