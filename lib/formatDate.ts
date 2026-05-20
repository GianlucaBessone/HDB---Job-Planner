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

/**
 * Device-independent date formatting for inline use (replaces toLocaleDateString).
 * Always outputs dd/MM/yyyy regardless of browser/OS locale.
 */
export function formatDateInline(date: string | Date | null | undefined): string {
    if (!date) return '';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(date);
    }
}

/**
 * Device-independent datetime formatting for inline use (replaces toLocaleString).
 * Always outputs dd/MM/yyyy HH:mm regardless of browser/OS locale.
 */
export function formatDateTimeInline(date: string | Date | null | undefined): string {
    if (!date) return '';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
        return String(date);
    }
}
