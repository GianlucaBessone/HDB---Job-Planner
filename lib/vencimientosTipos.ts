/** Tipos y etiquetas del calendario de vencimientos (sin Prisma: los usa también la pantalla). */

export type TipoVencimiento = 'epp' | 'competencia' | 'documento' | 'presupuesto_servicio' | 'cotizacion';

export interface Vencimiento {
    id: string;
    tipo: TipoVencimiento;
    /** YYYY-MM-DD */
    fecha: string;
    vencido: boolean;
    titulo: string;
    detalle: string;
    url: string;
}

export const ETIQUETA_VENCIMIENTO: Record<TipoVencimiento, string> = {
    epp: 'EPP',
    competencia: 'Competencias',
    documento: 'Documentos',
    presupuesto_servicio: 'Presupuestos de servicio',
    cotizacion: 'Presupuestos de productos',
};
