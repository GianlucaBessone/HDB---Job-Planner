/**
 * Vencimiento de tareas. Una tarea solo puede estar vencida mientras está
 * abierta: una completada, cerrada, cancelada o anulada ya no vence aunque su
 * fecha haya pasado.
 */
export const ESTADOS_ABIERTOS = ['pendiente', 'en_progreso'] as const;

export function estaAbierta(estado: string): boolean {
    return (ESTADOS_ABIERTOS as readonly string[]).includes(estado);
}

export function estaVencida(tarea: { estado: string; fechaVencimiento?: string | Date | null }, ahora = new Date()): boolean {
    if (!tarea.fechaVencimiento || !estaAbierta(tarea.estado)) return false;
    return new Date(tarea.fechaVencimiento).getTime() < ahora.getTime();
}

/** ISO (UTC) → valor de un `<input type="datetime-local">` en la hora del dispositivo. */
export function aDatetimeLocal(iso?: string | Date | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor de un `datetime-local` (hora del dispositivo) → ISO con zona, o '' si está vacío. */
export function desdeDatetimeLocal(valor: string): string {
    if (!valor) return '';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Atajos de vencimiento: fin del día elegido (23:59, hora local). */
export type AtajoVencimiento = 'hoy' | 'manana' | 'viernes' | 'semana';

export function fechaAtajo(atajo: AtajoVencimiento, ahora = new Date()): Date {
    const d = new Date(ahora);
    d.setHours(23, 59, 0, 0);
    if (atajo === 'manana') d.setDate(d.getDate() + 1);
    if (atajo === 'semana') d.setDate(d.getDate() + 7);
    if (atajo === 'viernes') {
        // Próximo viernes; si hoy es viernes, hoy.
        const dias = (5 - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + dias);
    }
    return d;
}

export const ATAJOS_VENCIMIENTO: { id: AtajoVencimiento; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'manana', label: 'Mañana' },
    { id: 'viernes', label: 'Viernes' },
    { id: 'semana', label: 'En 1 semana' },
];
