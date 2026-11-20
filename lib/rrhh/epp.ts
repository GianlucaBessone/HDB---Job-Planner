// EPP: validaciones de lo que llega a las API routes de EPP y Mis EPP.
// Se importa desde cliente y servidor (sin Prisma ni APIs de Node).
import { z } from 'zod';

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const opcional = (max: number) => texto(max).optional();
const entero = (min: number, max: number) => z.coerce.number().int('Ingresá un número entero.').min(min).max(max);
const id = z.string().trim().min(1, 'Falta el identificador.').max(64);

/**
 * Firma manuscrita dibujada en pantalla. Solo se acepta una imagen en base64:
 * se muestra en la matriz pública y en la planilla de la Res. 299/11.
 */
export const firmaImagenSchema = z
    .string()
    .max(2_000_000, 'La imagen de la firma es demasiado grande.')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'La firma no es una imagen válida.');

// ── Catálogo y stock ────────────────────────────────────────────────

const camposItem = {
    nombre: texto(160).min(1, 'El nombre del elemento es requerido.'),
    codigo: opcional(60),
    descripcion: opcional(2000),
    categoria: texto(60).min(1, 'Indicá la categoría.'),
    esGlobal: z.boolean(),
    diasValidez: entero(0, 36_500).optional(),
    stockMinimo: entero(0, 1_000_000).optional(),
    talle: opcional(40),
    marca: opcional(80),
    normaCertificacion: opcional(120),
};

export const eppItemCrearSchema = z.object({
    ...camposItem,
    stockActual: entero(0, 1_000_000).optional(),
});

export const eppItemEditarSchema = z.object({
    ...camposItem,
    nombre: camposItem.nombre.optional(),
    categoria: camposItem.categoria.optional(),
    esGlobal: z.boolean().optional(),
    activo: z.boolean().optional(),
    ajusteStock: z
        .object({
            nuevoStock: entero(0, 1_000_000),
            motivo: texto(500).min(1, 'Debe ingresar un motivo obligatorio para auditar el ajuste de stock'),
        })
        .optional(),
});

export const eppIngresoStockSchema = z.object({
    cantidad: entero(1, 1_000_000),
    remitoFactura: opcional(80),
    proveedor: opcional(120),
    motivo: opcional(500),
});

// ── Entregas y solicitudes ──────────────────────────────────────────

export const eppEntregaSchema = z.object({
    operatorId: id,
    items: z
        .array(z.object({ eppItemId: id, cantidad: entero(1, 1000), talle: opcional(40) }))
        .min(1, 'Debe seleccionar al menos un elemento de EPP')
        .max(50),
    /** Quien entregó físicamente; si no viene, el usuario de la sesión. */
    entregadoPor: opcional(120),
    observaciones: opcional(2000),
    firmaPresencialBase64: firmaImagenSchema.optional(),
});

export const eppResolverSolicitudSchema = z.object({
    accion: z.enum(['APROBAR', 'RECHAZAR']),
    motivoRechazo: opcional(500),
});

export const MOTIVOS_SOLICITUD = ['DETERIORO', 'VENCIMIENTO', 'EXTRAVIO', 'NUEVA_TAREA'] as const;

export const eppSolicitudSchema = z.object({
    eppItemId: id,
    talle: opcional(40),
    motivo: z.enum(MOTIVOS_SOLICITUD),
    comentario: opcional(1000),
});

export const eppFirmaEntregaSchema = z.object({
    itemIdsConfirmed: z.array(id).min(1, 'Debe seleccionar y confirmar al menos un ítem entregado').max(50),
    deviceId: opcional(120),
    firmaManuscritaUrl: firmaImagenSchema.optional(),
});

// ── Enlaces públicos ────────────────────────────────────────────────

export const eppEnlaceSchema = z
    .object({
        tipo: z.enum(['GENERAL', 'CLIENTE']),
        clientId: id.optional(),
        titulo: opcional(160),
    })
    .refine(d => d.tipo !== 'CLIENTE' || !!d.clientId, { message: 'Debe seleccionar un cliente', path: ['clientId'] });

export type EppItemCrear = z.input<typeof eppItemCrearSchema>;
export type EppItemEditar = z.input<typeof eppItemEditarSchema>;
export type EppIngresoStock = z.input<typeof eppIngresoStockSchema>;
export type EppEntrega = z.input<typeof eppEntregaSchema>;
export type EppResolverSolicitud = z.input<typeof eppResolverSolicitudSchema>;
export type EppSolicitud = z.input<typeof eppSolicitudSchema>;
export type EppFirmaEntrega = z.input<typeof eppFirmaEntregaSchema>;
export type EppEnlace = z.input<typeof eppEnlaceSchema>;
