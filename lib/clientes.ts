import { z } from 'zod';
import { CONDICIONES_IVA, formatCuit } from '@/lib/ventas/proveedorVentas';

export { CONDICIONES_IVA, formatCuit };

const textoOpcional = z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * Datos del cliente que se editan desde Clientes y su ficha. La API valida con
 * este esquema: no pasan a la base campos que no estén acá (relaciones, ids).
 */
export const clienteSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    razonSocial: textoOpcional,
    // Se guarda con el formato habitual (30-12345678-9).
    cuit: textoOpcional
        .refine((v) => v === null || v.replace(/\D/g, '').length === 11, 'El CUIT debe tener 11 dígitos')
        .transform((v) => (v ? formatCuit(v) : null)),
    condicionIva: textoOpcional,
    email: textoOpcional.refine(
        (v) => v === null || z.string().email().safeParse(v).success,
        'El email no es válido'
    ),
    telefono: textoOpcional,
    direccion: textoOpcional,
    activo: z.boolean().optional(),
    listaPrecioId: textoOpcional,
});

/** Para editar: todos los campos opcionales, solo se actualiza lo que viene. */
export const clienteParcialSchema = clienteSchema.partial();

export type ClienteInput = z.infer<typeof clienteSchema>;

/** Identificación fiscal para precargar en ventas y cotizaciones. */
export function identificacionFiscal(c: { razonSocial?: string | null; nombre: string; cuit?: string | null }) {
    return {
        nombre: c.razonSocial || c.nombre,
        identificacion: c.cuit || '',
    };
}
