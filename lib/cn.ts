import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Los tamaños tipográficos propios (tailwind.config.ts) tienen que declararse
// para que twMerge no los confunda con colores de texto.
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['display', 'title', 'heading', 'body', 'caption', 'eyebrow'] }],
            shadow: [{ shadow: ['xs', 'focus'] }],
        },
    },
});

/** Une clases condicionales y resuelve conflictos de Tailwind (la última gana). */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
