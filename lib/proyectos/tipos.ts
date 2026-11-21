/**
 * Tipo de proyecto (auditoría, P27 / SE5). Hace explícita la intención que antes quedaba implícita en los
 * interruptores (OS, provisión, fichaje, fijo, métricas). El tipo propone esos valores al crear o al cambiar
 * de tipo; después se pueden ajustar uno por uno.
 */
export const TIPOS_PROYECTO = ['obra', 'servicio', 'contrato', 'interno'] as const;
export type TipoProyecto = (typeof TIPOS_PROYECTO)[number];

export interface InterruptoresProyecto {
    generarOS: boolean;
    aprovisionamiento: boolean;
    fichajeHabilitado: boolean;
    proyectoFijo: boolean;
    noEnMetricas: boolean;
}

export const TIPO_PROYECTO_INFO: Record<TipoProyecto, { label: string; descripcion: string; valores: InterruptoresProyecto }> = {
    obra: {
        label: 'Obra',
        descripcion: 'Trabajo con alcance, fechas y horas estimadas (montaje, instalación).',
        valores: { generarOS: false, aprovisionamiento: true, fichajeHabilitado: false, proyectoFijo: false, noEnMetricas: false },
    },
    servicio: {
        label: 'Servicio puntual',
        descripcion: 'Trabajo ocasional para un cliente que se cobra con una orden de servicio.',
        valores: { generarOS: true, aprovisionamiento: true, fichajeHabilitado: false, proyectoFijo: false, noEnMetricas: false },
    },
    contrato: {
        label: 'Contrato de mantenimiento',
        descripcion: 'Proyecto fijo de un cliente: las tareas van por órdenes de trabajo y se factura por mes.',
        valores: { generarOS: false, aprovisionamiento: true, fichajeHabilitado: true, proyectoFijo: true, noEnMetricas: true },
    },
    interno: {
        label: 'Interno',
        descripcion: 'Trabajo de HDB sin cliente (taller, capacitación, pruebas). No suma a las métricas.',
        valores: { generarOS: false, aprovisionamiento: false, fichajeHabilitado: false, proyectoFijo: false, noEnMetricas: true },
    },
};

export function esTipoProyecto(v: unknown): v is TipoProyecto {
    return typeof v === 'string' && (TIPOS_PROYECTO as readonly string[]).includes(v);
}

/** Tipo que corresponde a un proyecto existente según sus interruptores (misma regla que la migración). */
export function tipoPorInterruptores(p: Partial<InterruptoresProyecto>): TipoProyecto {
    if (p.proyectoFijo) return 'contrato';
    if (p.generarOS) return 'servicio';
    return 'obra';
}
