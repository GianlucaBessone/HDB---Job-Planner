import { prisma } from '@/lib/dataLayer';

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
