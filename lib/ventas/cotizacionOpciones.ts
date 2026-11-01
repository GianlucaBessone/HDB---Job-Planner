// Opciones comerciales de las cotizaciones. Se guardan como texto en la
// cotización, así que agregar o renombrar una opción no rompe las existentes.

export const CONDICIONES_PAGO = [
    'Contado',
    'Transferencia bancaria',
    'Contado / Transferencia',
    'Tarjeta de débito',
    'Tarjeta de crédito',
    'Cheque',
    'Cuenta corriente 15 días',
    'Cuenta corriente 30 días',
    'Cuenta corriente 60 días',
    '50% anticipo y 50% contra entrega',
] as const;

export const PLAZOS_ENTREGA = [
    'Inmediata (según stock)',
    '24 a 48 horas',
    '5 días hábiles',
    '7 a 10 días hábiles',
    '15 días hábiles',
    '30 días',
    'A convenir',
] as const;

export const VALIDEZ_DIAS = [3, 7, 15, 30, 60] as const;

export const CONDICION_PAGO_DEFAULT = 'Contado / Transferencia';
export const PLAZO_ENTREGA_DEFAULT = 'Inmediata (según stock)';

export const MOTIVOS_ANULACION = [
    'Desestimada por el cliente',
    'Presupuesto vencido',
    'Precios desactualizados',
    'No aceptó las condiciones de pago',
    'Proyecto cancelado o postergado',
    'Eligió otra propuesta',
] as const;

/** Devuelve las opciones conservando un valor guardado que ya no está en la lista. */
export function opcionesConValor(opciones: readonly string[], valor: string | null | undefined): string[] {
    const v = valor?.trim();
    return v && !opciones.includes(v) ? [v, ...opciones] : [...opciones];
}
