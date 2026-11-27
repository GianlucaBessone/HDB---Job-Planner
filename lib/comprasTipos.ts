import { estadoComun, type EstadoVista } from '@/lib/estados';
/**
 * Tipos y etiquetas de compras y recepción, sin dependencias de servidor (los usan las pantallas).
 */

export const ESTADOS_ORDEN_COMPRA = ['borrador', 'enviada', 'parcial', 'recibida', 'cancelada'] as const;
export type EstadoOrdenCompra = (typeof ESTADOS_ORDEN_COMPRA)[number];

export const ESTADO_OC_INFO: Record<EstadoOrdenCompra, EstadoVista> = {
    borrador: estadoComun('borrador', { genero: 'f' }),
    enviada: estadoComun('en_curso', { genero: 'f', etiqueta: 'Enviada' }),
    parcial: estadoComun('en_curso', { genero: 'f', etiqueta: 'Recibida en parte' }),
    recibida: estadoComun('cerrado', { genero: 'f', etiqueta: 'Recibida' }),
    cancelada: estadoComun('cancelado', { genero: 'f' }),
};

/** Estados en los que todavía se espera mercadería. */
export const ESTADOS_ABIERTOS: EstadoOrdenCompra[] = ['borrador', 'enviada', 'parcial'];

export interface OrdenCompraResumen {
    id: string;
    numero: string;
    estado: EstadoOrdenCompra;
    proveedor: { id: string; razonSocial: string };
    almacen: { id: string; nombre: string };
    fechaEmision: string;
    fechaEsperada: string | null;
    items: number;
    total: number;
    /** Porcentaje de unidades recibidas (0–100). */
    recibido: number;
    factura: { id: string; numero: string } | null;
}

export interface OrdenCompraItemDetalle {
    id: string;
    productoId: string;
    sku: string;
    descripcion: string;
    unidad: string | null;
    cantidad: number;
    costoUnitario: number;
    cantidadRecibida: number;
}

export interface RecepcionDetalle {
    id: string;
    numero: string;
    fecha: string;
    remito: string | null;
    observaciones: string | null;
    anulada: boolean;
    usuarioNombre: string | null;
    items: { itemId: string; cantidad: number }[];
}

export interface OrdenCompraDetalle extends Omit<OrdenCompraResumen, 'items'> {
    observaciones: string | null;
    fechaEnvio: string | null;
    fechaRecepcion: string | null;
    creadoPorNombre: string | null;
    items: OrdenCompraItemDetalle[];
    recepciones: RecepcionDetalle[];
    factura: { id: string; numero: string; fechaEmision: string; total: number } | null;
}

/** Número legible de una factura de proveedor (letra, punto de venta y número). */
export function numeroFactura(f: { tipoComprobante?: string | null; letraComprobante?: string | null; puntoVenta?: string | null; numeroComprobante?: string | null }) {
    const nro = [f.puntoVenta, f.numeroComprobante].filter(Boolean).join('-');
    return [f.tipoComprobante, f.letraComprobante, nro].filter(Boolean).join(' ') || 'Sin número';
}
