/**
 * Vocabulario común de estados (P34). Cada módulo guarda sus propios valores (`ABIERTA`, `en_progreso`, `enviado`…)
 * y no se renombran en la base; lo que se unifica es cómo se ven: cada estado pertenece a una **fase** común, que
 * fija el color y, salvo que el módulo necesite una palabra más precisa, también el nombre.
 *
 * | Fase        | Color   | Significa                                        |
 * |-------------|---------|--------------------------------------------------|
 * | borrador    | neutro  | Se está preparando; nadie más lo ve todavía      |
 * | pendiente   | neutro  | Listo para empezar, sin empezar                  |
 * | en_curso    | info    | En marcha                                        |
 * | pausado     | aviso   | Detenido a propósito                             |
 * | en_revision | aviso   | Espera a otra persona: firma, aprobación, cliente |
 * | aprobado    | éxito   | Aceptado por quien tenía que decidir             |
 * | cerrado     | éxito   | Terminado                                        |
 * | vencido     | aviso   | Pasó su fecha sin resolverse                     |
 * | rechazado   | error   | Quien decidía dijo que no                        |
 * | error       | error   | Falló un proceso                                 |
 * | cancelado   | neutro  | Se dejó sin efecto (cancelado, anulado)          |
 */

export type FaseEstado =
    | 'borrador' | 'pendiente' | 'en_curso' | 'pausado' | 'en_revision'
    | 'aprobado' | 'cerrado' | 'vencido' | 'rechazado' | 'error' | 'cancelado';

export type ToneEstado = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface EstadoVista {
    label: string;
    tone: ToneEstado;
    fase: FaseEstado;
}

/** Nombre en masculino y femenino, y color de cada fase. */
export const FASES: Record<FaseEstado, { m: string; f: string; tone: ToneEstado }> = {
    borrador: { m: 'Borrador', f: 'Borrador', tone: 'neutral' },
    pendiente: { m: 'Pendiente', f: 'Pendiente', tone: 'neutral' },
    en_curso: { m: 'En curso', f: 'En curso', tone: 'info' },
    pausado: { m: 'Pausado', f: 'Pausada', tone: 'warning' },
    en_revision: { m: 'En revisión', f: 'En revisión', tone: 'warning' },
    aprobado: { m: 'Aprobado', f: 'Aprobada', tone: 'success' },
    cerrado: { m: 'Cerrado', f: 'Cerrada', tone: 'success' },
    vencido: { m: 'Vencido', f: 'Vencida', tone: 'warning' },
    rechazado: { m: 'Rechazado', f: 'Rechazada', tone: 'danger' },
    error: { m: 'Error', f: 'Error', tone: 'danger' },
    cancelado: { m: 'Cancelado', f: 'Cancelada', tone: 'neutral' },
};

/**
 * Estado visible a partir de su fase. `genero` concuerda el nombre común con la entidad ("Pausada" para una orden);
 * `etiqueta` lo reemplaza cuando el módulo necesita una palabra más precisa ("Pendiente de firma", "Por rendir").
 */
export function estadoComun(fase: FaseEstado, opciones: { genero?: 'm' | 'f'; etiqueta?: string } = {}): EstadoVista {
    const f = FASES[fase];
    return { fase, tone: f.tone, label: opciones.etiqueta ?? f[opciones.genero ?? 'm'] };
}

/** Busca un estado en el mapa del módulo; si no está, lo muestra tal cual en neutro. */
export function estadoDe<K extends string>(mapa: Record<K, EstadoVista>, valor: string | null | undefined): EstadoVista {
    return (valor && (mapa as Record<string, EstadoVista>)[valor]) || { label: valor || '—', tone: 'neutral', fase: 'pendiente' };
}

/** Órdenes de trabajo. */
export const ESTADO_OT_INFO = {
    ABIERTA: estadoComun('en_curso', { genero: 'f', etiqueta: 'Abierta' }),
    PAUSADA: estadoComun('pausado', { genero: 'f' }),
    PENDIENTE_FIRMA: estadoComun('en_revision', { genero: 'f', etiqueta: 'Pendiente de firma' }),
    CERRADA: estadoComun('cerrado', { genero: 'f' }),
} satisfies Record<string, EstadoVista>;
