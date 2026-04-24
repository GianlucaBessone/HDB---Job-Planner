/**
 * Tool Control Logic — Estado de verificación calculado server-side
 * Nunca hardcodeado en frontend, siempre calculado aquí.
 */

export type EstadoControl = 'NUNCA_CONTROLADA' | 'EN_VIGENCIA' | 'POR_VENCER' | 'VENCIDO' | null;

interface ToolControlInput {
    controlActivo: boolean;
    ultimoControlFecha: Date | string | null;
    periodoControl: number; // días
}

/**
 * Calcula el estado de control de una herramienta
 */
export function calcularEstadoControl(tool: ToolControlInput): EstadoControl {
    if (!tool.controlActivo) return null;
    if (!tool.ultimoControlFecha) return 'NUNCA_CONTROLADA';

    const ultimoControl = new Date(tool.ultimoControlFecha);
    const proximoControl = new Date(ultimoControl);
    proximoControl.setDate(proximoControl.getDate() + tool.periodoControl);

    const hoy = new Date();
    const diffMs = proximoControl.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return 'VENCIDO';
    if (diasRestantes <= 5) return 'POR_VENCER';
    return 'EN_VIGENCIA';
}

/**
 * Calcula la fecha de próximo control
 */
export function calcularProximoControl(ultimoControl: Date | string, periodoControl: number): Date {
    const fecha = new Date(ultimoControl);
    fecha.setDate(fecha.getDate() + periodoControl);
    return fecha;
}

/**
 * Enriquece un tool con campos calculados para el frontend
 */
export function enriquecerTool<T extends ToolControlInput>(tool: T): T & {
    estadoControl: EstadoControl;
    proximoControlFecha: string | null;
    diasRestantes: number | null;
} {
    const estadoControl = calcularEstadoControl(tool);

    let proximoControlFecha: string | null = null;
    let diasRestantes: number | null = null;

    if (tool.controlActivo && tool.ultimoControlFecha) {
        const proximo = calcularProximoControl(tool.ultimoControlFecha, tool.periodoControl);
        proximoControlFecha = proximo.toISOString();
        const diffMs = proximo.getTime() - new Date().getTime();
        diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
        ...tool,
        estadoControl,
        proximoControlFecha,
        diasRestantes,
    };
}

/**
 * Labels legibles para estados
 */
export const ESTADO_CONTROL_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
    NUNCA_CONTROLADA: { label: 'Nunca Controlada', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-800' },
    EN_VIGENCIA: { label: 'En Vigencia', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
    POR_VENCER: { label: 'Por Vencer', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
    VENCIDO: { label: 'Vencido', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' },
};
