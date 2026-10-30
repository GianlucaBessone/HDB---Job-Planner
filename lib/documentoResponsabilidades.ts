// Responsabilidades de un documento digital: tabla de rol + responsabilidad.
// Los documentos viejos (y la IA) las traen como texto libre; acá se normalizan.

export interface Responsabilidad {
    rol: string;
    responsabilidad: string;
}

/** Convierte texto libre ("Rol: tarea", encabezados con viñetas, etc.) en filas de tabla. */
export function parseResponsabilidades(text: any): Responsabilidad[] {
    if (Array.isArray(text)) return text;
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n');
    const result: Responsabilidad[] = [];

    // Texto corto de una sola línea
    if (lines.length === 1 && lines[0].length < 150 && !lines[0].includes(':')) {
        return [{ rol: 'General', responsabilidad: lines[0].trim() }];
    }

    let currentRol = 'General';
    let currentResp: string[] = [];

    const saveCurrent = () => {
        if (currentResp.length > 0) {
            result.push({ rol: currentRol, responsabilidad: currentResp.join('\n').trim() });
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const isHeaderWithColon = line.endsWith(':') && line.length < 60;
        const isHeaderWithoutColon = line.length < 60 && !line.startsWith('-') && !line.match(/^\d+\./) && i + 1 < lines.length && lines[i + 1].trim().startsWith('-');
        const inlineColonMatch = line.match(/^([^:]+):\s*(.+)$/);

        if (isHeaderWithColon || isHeaderWithoutColon) {
            saveCurrent();
            currentRol = line.replace(/:$/, '').trim();
            currentResp = [];
        } else if (inlineColonMatch && inlineColonMatch[1].length < 40 && !inlineColonMatch[1].startsWith('-')) {
            saveCurrent();
            currentRol = inlineColonMatch[1].trim();
            currentResp = [inlineColonMatch[2].trim()];
        } else {
            currentResp.push(line);
        }
    }

    saveCurrent();

    if (result.length === 0 && text.trim()) {
        return [{ rol: 'General', responsabilidad: text.trim() }];
    }

    return result;
}

/** Texto plano para vistas de lectura y prompts de IA, venga como tabla o como texto. */
export function responsabilidadesATexto(value: any): string {
    if (Array.isArray(value)) {
        return value
            .filter(r => r && (r.rol || r.responsabilidad))
            .map(r => `${r.rol || 'General'}: ${r.responsabilidad || ''}`.trim())
            .join('\n');
    }
    return typeof value === 'string' ? value : '';
}
