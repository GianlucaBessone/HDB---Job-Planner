import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorLegajo, type DatosDocumento } from '@/lib/legajo';
import { TIPOS_DOCUMENTO } from '@/lib/legajoTipos';

/** Validaciones comunes de las rutas del legajo. */

const texto = (max: number) => z.string().trim().max(max).nullable().optional();
const fecha = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null));

export const datosLegajoSchema = z
    .object({
        legajo: texto(30),
        dni: texto(20),
        cuil: texto(20),
        fechaIngreso: fecha,
        fechaEgreso: fecha,
        fechaNacimiento: fecha,
        telefono: texto(40),
        email: z.string().trim().email('Email inválido').max(120).nullable().optional().or(z.literal('').transform(() => null)),
        domicilio: texto(200),
        localidad: texto(100),
        obraSocial: texto(100),
        grupoSanguineo: texto(10),
        contactoEmergenciaNombre: texto(120),
        contactoEmergenciaTelefono: texto(40),
        contactoEmergenciaRelacion: texto(60),
        observaciones: texto(4000),
    })
    .refine((d) => !d.fechaIngreso || !d.fechaEgreso || d.fechaEgreso >= d.fechaIngreso, { message: 'El egreso no puede ser anterior al ingreso' });

const documentoBase = z.object({
    tipo: z.enum(TIPOS_DOCUMENTO),
    nombre: z.string().trim().min(1, 'Poné un nombre al documento').max(120),
    numero: texto(60),
    fechaEmision: fecha,
    fechaVencimiento: fecha,
    observaciones: texto(2000),
});
export const documentoSchema = documentoBase.refine((d) => !d.fechaEmision || !d.fechaVencimiento || d.fechaVencimiento >= d.fechaEmision, { message: 'El vencimiento no puede ser anterior a la emisión' });

/** Lee un formulario multipart con `datos` (JSON) y `archivo` opcional. */
export async function leerFormularioDocumento(req: Request, parcial: boolean) {
    const form = await req.formData().catch(() => null);
    if (!form) return { error: 'Formulario inválido' } as const;
    let json: unknown;
    try {
        json = JSON.parse(String(form.get('datos') ?? '{}'));
    } catch {
        return { error: 'Datos inválidos' } as const;
    }
    const schema = parcial ? documentoBase.partial() : documentoSchema;
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Datos inválidos' } as const;
    const a = form.get('archivo');
    const archivo = a instanceof File && a.size > 0 ? a : null;
    return { datos: parsed.data as DatosDocumento, archivo, quitarArchivo: form.get('quitarArchivo') === '1' } as const;
}

export function respuestaError(error: unknown, contexto: string) {
    if (error instanceof ErrorLegajo) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`Error en legajo (${contexto}):`, error);
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 });
}

/** Respuestas con datos personales: que no queden en cachés intermedias. */
export const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
