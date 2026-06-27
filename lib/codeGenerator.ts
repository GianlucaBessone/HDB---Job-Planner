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

// ── OKR / KPI / Gráfico Code Generators ───────────────────────────────

/**
 * Generates a sequential code like OKR-001, KPI-001, GRF-001.
 * Global sequence (no year reset). Padding = 3 digits.
 */
async function generateSimpleCode(
    prefix: 'OKR' | 'KPI' | 'GRF' | 'DS',
): Promise<string> {
    let lastNumber = 0;

    if (prefix === 'OKR') {
        const last = await prisma.okr.findFirst({
            where: { codigoOkr: { startsWith: `${prefix}-` } },
            orderBy: { codigoOkr: 'desc' },
            select: { codigoOkr: true },
        });
        if (last?.codigoOkr) {
            const parts = last.codigoOkr.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    } else if (prefix === 'KPI') {
        const last = await prisma.kpi.findFirst({
            where: { codigoKpi: { startsWith: `${prefix}-` } },
            orderBy: { codigoKpi: 'desc' },
            select: { codigoKpi: true },
        });
        if (last?.codigoKpi) {
            const parts = last.codigoKpi.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    } else if (prefix === 'GRF') {
        const last = await prisma.graficoConfig.findFirst({
            where: { codigoGrafico: { startsWith: `${prefix}-` } },
            orderBy: { codigoGrafico: 'desc' },
            select: { codigoGrafico: true },
        });
        if (last?.codigoGrafico) {
            const parts = last.codigoGrafico.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    } else if (prefix === 'DS') {
        const last = await prisma.dataset.findFirst({
            where: { codigoDataset: { startsWith: `${prefix}-` } },
            orderBy: { codigoDataset: 'desc' },
            select: { codigoDataset: true },
        });
        if (last?.codigoDataset) {
            const parts = last.codigoDataset.split('-');
            lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
        }
    }

    const nextNumber = String(lastNumber + 1).padStart(3, '0');
    return `${prefix}-${nextNumber}`;
}

export async function generateCodigoOkr(): Promise<string> {
    return generateSimpleCode('OKR');
}

export async function generateCodigoKpi(): Promise<string> {
    return generateSimpleCode('KPI');
}

export async function generateCodigoGrafico(): Promise<string> {
    return generateSimpleCode('GRF');
}

export async function generateCodigoDataset(): Promise<string> {
    return generateSimpleCode('DS');
}

