import { z } from 'zod';

/** Condiciones frente al IVA sugeridas en el alta de proveedores de ventas. */
export const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
  'No Responsable',
] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const proveedorVentasSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria'),
  nombreFantasia: optionalText,
  codigo: optionalText.transform((v) => (v ? v.toUpperCase() : null)),
  // Se guarda con el formato habitual (30-12345678-9), igual que los datos existentes.
  cuit: optionalText
    .refine((v) => v === null || v.replace(/\D/g, '').length === 11, 'El CUIT debe tener 11 dígitos')
    .transform((v) => (v ? formatCuit(v) : null)),
  condicionIva: optionalText,
  telefono: optionalText,
  email: optionalText.refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    'El email no es válido'
  ),
  direccion: optionalText,
  localidad: optionalText,
  provincia: optionalText,
  activo: z.boolean().optional(),
});

export type ProveedorVentasInput = z.infer<typeof proveedorVentasSchema>;

/** Formatea un CUIT de 11 dígitos como 30-12345678-9. */
export function formatCuit(cuit?: string | null): string {
  if (!cuit) return '';
  const d = cuit.replace(/\D/g, '');
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Nombre a mostrar en selectores y listados. */
export function proveedorLabel(p: { razonSocial: string; nombreFantasia?: string | null; cuit?: string | null }): string {
  const fantasia = p.nombreFantasia && p.nombreFantasia !== p.razonSocial ? ` (${p.nombreFantasia})` : '';
  const cuit = p.cuit ? ` — CUIT ${formatCuit(p.cuit)}` : '';
  return `${p.razonSocial}${fantasia}${cuit}`;
}
