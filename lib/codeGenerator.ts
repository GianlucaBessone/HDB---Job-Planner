import { prisma } from '@/lib/prisma';

/**
 * Generates a sequential code like PR-2026-0001 or OS-2026-0001.
 * Sequence restarts every year and is guaranteed unique.
 */
async function generateCode(prefix: 'PR' | 'OS'): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-`;
    const standardRegex = new RegExp(`^${prefix}-${year}-(\\d+)$`);

    let allCodes: (string | null)[] = [];
    if (prefix === 'PR') {
        const records = await prisma.project.findMany({
            where: { codigoProyecto: { startsWith: pattern } },
            select: { codigoProyecto: true },
        });
        allCodes = records.map(r => r.codigoProyecto);
    } else {
        const records = await prisma.ordenServicio.findMany({
            where: { codigoOS: { startsWith: pattern } },
            select: { codigoOS: true },
        });
        allCodes = records.map(r => r.codigoOS);
    }

    const existingSet = new Set(allCodes.filter((c): c is string => Boolean(c)));
    let maxNumber = 0;

    allCodes.forEach(code => {
        if (!code) return;
        const match = code.match(standardRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        }
    });

    let nextNumber = maxNumber + 1;
    let candidate = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;

    while (existingSet.has(candidate)) {
        nextNumber++;
        candidate = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
    }

    return candidate;
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
 * Generates a sequential code like OKR-001, KPI-001, GRF-001, DS-001.
 * Global sequence (no year reset). Padding = 3 digits.
 * Guaranteed unique and safely parses non-standard prefixed codes.
 */
async function generateSimpleCode(
    prefix: 'OKR' | 'KPI' | 'GRF' | 'DS',
): Promise<string> {
    let allCodes: (string | null)[] = [];

    if (prefix === 'OKR') {
        const records = await prisma.okr.findMany({ select: { codigoOkr: true } });
        allCodes = records.map(r => r.codigoOkr);
    } else if (prefix === 'KPI') {
        const records = await prisma.kpi.findMany({ select: { codigoKpi: true } });
        allCodes = records.map(r => r.codigoKpi);
    } else if (prefix === 'GRF') {
        const records = await prisma.graficoConfig.findMany({ select: { codigoGrafico: true } });
        allCodes = records.map(r => r.codigoGrafico);
    } else if (prefix === 'DS') {
        const records = await prisma.dataset.findMany({ select: { codigoDataset: true } });
        allCodes = records.map(r => r.codigoDataset);
    }

    const existingSet = new Set(allCodes.filter((c): c is string => Boolean(c)));
    const standardRegex = new RegExp(`^${prefix}-(\\d+)$`);
    let maxNumber = 0;

    allCodes.forEach(code => {
        if (!code) return;
        const match = code.match(standardRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        }
    });

    let nextNumber = maxNumber + 1;
    let candidate = `${prefix}-${String(nextNumber).padStart(3, '0')}`;

    while (existingSet.has(candidate)) {
        nextNumber++;
        candidate = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
    }

    return candidate;
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

