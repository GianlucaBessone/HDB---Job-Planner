import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface PlanningBlock {
    projectId: string;
    projectName: string;
    startTime: string;
    endTime?: string;
    note?: string;
    operatorIds: string[];
    operatorNames: string[];
    isNoteOnly?: boolean;
}

export interface PlanningDay {
    date: string; // YYYY-MM-DD
    blocks: PlanningBlock[];
}

export function formatWhatsAppMessage(planning: PlanningDay): string {
    if (!planning || !planning.blocks || planning.blocks.length === 0) {
        return "No hay planificación para hoy.";
    }

    const dateObj = new Date(planning.date + 'T12:00:00'); // Use mid-day to avoid TZ issues
    const dayName = format(dateObj, 'EEEE', { locale: es });
    const dayFormatted = format(dateObj, 'dd/MM/yyyy');

    // Capitalize first letter of day name
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    let message = `Cronograma ${capitalizedDay} ${dayFormatted}\n\n`;

    planning.blocks.forEach((block, index) => {
        if (block.isNoteOnly) {
            // Special formatting for notes
            message += `*--- NOTA ---*\n`;
            if (block.note) {
                message += `${block.note}\n`;
            }
        } else {
            // Project Name in bold
            message += `*${block.projectName}*\n`;

            // Time
            if (block.startTime && block.endTime) {
                message += `${block.startTime} a ${block.endTime}hs\n`;
            } else if (block.startTime) {
                message += `${block.startTime}hs\n`;
            }

            // Note in italics
            if (block.note) {
                message += `\n_${block.note}_\n`;
            }

            message += `\n`;

            // Operators
            block.operatorNames.forEach(name => {
                message += `${name}\n`;
            });
        }

        // Add empty line between blocks, but not after the last one
        if (index < planning.blocks.length - 1) {
            message += `\n------------------\n\n`;
        }
    });

    return message.trim();
}
