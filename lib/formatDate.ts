import { format } from 'date-fns';

export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
        if (typeof dateString === 'string' && dateString.length === 10 && dateString.includes('-')) {
            const [y, m, d] = dateString.split('-');
            return `${d}/${m}/${y}`;
        }
        return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
        return String(dateString);
    }
}

export function formatDateTime(dateString: string | Date | null | undefined): string {
    if (!dateString) return '';
    try {
        return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
        return String(dateString);
    }
}
