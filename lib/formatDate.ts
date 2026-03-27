import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    try {
        let d: Date;
        if (typeof date === 'string') {
            const dateStr = date.split('T')[0];
            // Use T12:00:00 to avoid timezone shifts showing the "previous" day
            d = new Date(`${dateStr}T12:00:00`);
        } else {
            d = date as Date;
        }
        return format(d, 'dd/MM/yyyy', { locale: es });
    } catch {
        return String(date);
    }
}

export function formatTime(date: string | Date | null | undefined): string {
    if (!date) return '';
    try {
        const d = typeof date === 'string' ? (date.includes('T') ? parseISO(date) : new Date(`2000-01-01T${date}`)) : date;
        return format(d, 'HH:mm', { locale: es });
    } catch {
        return String(date);
    }
}

export function formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '';
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return format(d, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
        return String(date);
    }
}
