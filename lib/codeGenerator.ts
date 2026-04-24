import { prisma } from '@/lib/prisma';

/**
 * Generates a sequential code like PR-2026-0001 or OS-2026-0001.
 * Sequence restarts every year and is guaranteed unique.
 */
async function generateCode(prefix: 'PR' | 'OS'): Promise<string> {
    const year = new Date().getFullYear();

    // Find the latest code for this prefix+year
    const pattern = `${prefix}-${year}-`;

    let lastNumber = 0;

    if (prefix === 'PR') {
        const last = await prisma.project.findFirst({
            where: { codigoProyecto: { startsWith: pattern } },
            orderBy: { codigoProyecto: 'desc' },
            select: { codigoProyecto: true },
        });
        if (last?.codigoProyecto) {
            const parts = last.codigoProyecto.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    } else {
        const last = await prisma.ordenServicio.findFirst({
            where: { codigoOS: { startsWith: pattern } },
            orderBy: { codigoOS: 'desc' },
            select: { codigoOS: true },
        });
        if (last?.codigoOS) {
            const parts = last.codigoOS.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    }

    const nextNumber = String(lastNumber + 1).padStart(4, '0');
    return `${prefix}-${year}-${nextNumber}`;
}

export async function generateCodigoProyecto(): Promise<string> {
    return generateCode('PR');
}

export async function generateCodigoOS(): Promise<string> {
    return generateCode('OS');
}

/**
 * Generates a unique 8-character alphanumeric ID for tools.
 * Characters used: A-Z, 0-9 (uppercase only for readability on QR labels).
 * Validates uniqueness against the Tool table.
 */
export async function generateToolId(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excluded I,O,0,1 to avoid confusion
    const ID_LENGTH = 8;
    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let id = '';
        for (let i = 0; i < ID_LENGTH; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Check uniqueness
        const existing = await prisma.tool.findUnique({ where: { id } });
        if (!existing) return id;
    }

    throw new Error('No se pudo generar un ID único después de múltiples intentos.');
}

/**
 * Generates N unique tool IDs at once (for bulk creation).
 */
export async function generateToolIds(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
        ids.push(await generateToolId());
    }
    return ids;
}
