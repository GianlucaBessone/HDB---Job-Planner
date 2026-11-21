/**
 * Hora de los recordatorios de tareas.
 *
 * Los recordatorios se piensan en hora de Argentina. La fecha se guarda como
 * instante (UTC) y el horario de cron-job.org se arma con la hora local de
 * Argentina, que es la zona que se le indica al trabajo.
 */
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const ZONA_RECORDATORIOS = 'America/Argentina/Buenos_Aires';

const SIN_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * Convierte la fecha que manda la pantalla en un instante. Una fecha con zona
 * (ISO con `Z` u offset) se respeta; una sin zona (p. ej. el valor de un
 * `datetime-local`) se interpreta como hora de Argentina.
 */
export function parsearFechaRecordatorio(valor: string): Date | null {
    const fecha = SIN_ZONA.test(valor) ? fromZonedTime(valor, ZONA_RECORDATORIOS) : new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Horario del trabajo en cron-job.org:
 *  - "unico":   una vez, en esa fecha y hora (vence 2 minutos después)
 *  - "diario":  todos los días a esa hora
 *  - "semanal": todas las semanas, ese día y esa hora
 */
export function horarioCronJob(tipo: string, fecha: Date) {
    const local = toZonedTime(fecha, ZONA_RECORDATORIOS);
    const base = {
        timezone: ZONA_RECORDATORIOS,
        hours: [local.getHours()],
        minutes: [local.getMinutes()],
    };
    switch (tipo) {
        case 'diario':
            return { ...base, expiresAt: 0, mdays: [-1], months: [-1], wdays: [-1] };
        case 'semanal':
            return { ...base, expiresAt: 0, mdays: [-1], months: [-1], wdays: [local.getDay()] };
        case 'unico':
        default:
            return {
                ...base,
                expiresAt: Math.floor(fecha.getTime() / 1000) + 120,
                mdays: [local.getDate()],
                months: [local.getMonth() + 1],
                wdays: [-1],
            };
    }
}
