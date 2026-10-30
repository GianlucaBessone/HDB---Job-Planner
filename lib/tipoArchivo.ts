// Detecta el tipo real de un archivo subido por su contenido (firma), no por lo que
// declara el navegador. Un archivo solo se acepta si contenido y extensión coinciden.

interface TipoArchivo {
    mime: string;
    extensiones: string[];
    firma: (b: Buffer) => boolean;
    /** Se puede mostrar en el navegador; si no, se fuerza la descarga. */
    inline: boolean;
}

const empieza = (b: Buffer, bytes: number[]) => bytes.every((v, i) => b[i] === v);
const ZIP = (b: Buffer) => empieza(b, [0x50, 0x4b, 0x03, 0x04]);
const OLE = (b: Buffer) => empieza(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

// Texto plano: sin bytes nulos ni caracteres de control raros en el primer bloque.
const TEXTO = (b: Buffer) => {
    const fin = Math.min(b.length, 8192);
    for (let i = 0; i < fin; i++) {
        const byte = b[i];
        if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) return false;
    }
    return true;
};

export const TIPOS_ARCHIVO: Record<string, TipoArchivo> = {
    png: { mime: 'image/png', extensiones: ['png'], firma: b => empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), inline: true },
    jpeg: { mime: 'image/jpeg', extensiones: ['jpg', 'jpeg'], firma: b => empieza(b, [0xff, 0xd8, 0xff]), inline: true },
    gif: { mime: 'image/gif', extensiones: ['gif'], firma: b => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')), inline: true },
    webp: { mime: 'image/webp', extensiones: ['webp'], firma: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP', inline: true },
    pdf: { mime: 'application/pdf', extensiones: ['pdf'], firma: b => b.subarray(0, 5).toString('latin1') === '%PDF-', inline: true },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensiones: ['docx'], firma: ZIP, inline: false },
    xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensiones: ['xlsx'], firma: ZIP, inline: false },
    doc: { mime: 'application/msword', extensiones: ['doc'], firma: OLE, inline: false },
    xls: { mime: 'application/vnd.ms-excel', extensiones: ['xls'], firma: OLE, inline: false },
    txt: { mime: 'text/plain', extensiones: ['txt'], firma: TEXTO, inline: false },
};

/**
 * Devuelve el tipo si el contenido corresponde a la extensión del nombre y está
 * entre los permitidos; si no, null. El mime que declara el navegador no se usa:
 * para Office suele venir vacío o genérico.
 */
export function detectarTipoArchivo(datos: Buffer, nombre: string, permitidos: string[]): TipoArchivo | null {
    const extension = (nombre.split('.').pop() || '').toLowerCase();
    for (const clave of permitidos) {
        const tipo = TIPOS_ARCHIVO[clave];
        if (tipo && tipo.extensiones.includes(extension) && tipo.firma(datos)) return tipo;
    }
    return null;
}

export function esMimeInline(mime: string): boolean {
    return Object.values(TIPOS_ARCHIVO).some(t => t.mime === mime && t.inline);
}
