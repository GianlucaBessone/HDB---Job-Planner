import { Prisma, type PrismaClient } from '@prisma/client';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

/**
 * Etiquetas de proyecto que trae el sistema de entrada, cada una con su checklist
 * de lib/checklistTemplates.ts.
 *
 * Antes las recreaba GET /api/config/tags cada vez que faltaba alguna, borrando todas
 * las etiquetas. Ahora ese GET es solo lectura y la siembra es explícita
 * (scripts/seed-etiquetas-base.ts): crea las que faltan y no borra ni modifica nada.
 */
export const ETIQUETAS_BASE = [
    'Seguridad eléctrica',
    'Trabajo en altura',
    'Protocolo sanitario',
    'Instalación dispenser',
    'Mantenimiento refrigeración',
] as const;

/** Etiquetas base que no existen en la base (comparación exacta por nombre). */
export async function etiquetasBaseFaltantes(db: PrismaClient): Promise<string[]> {
    const existentes = await db.projectTag.findMany({
        where: { name: { in: [...ETIQUETAS_BASE] } },
        select: { name: true },
    });
    const nombres = new Set(existentes.map(t => t.name));
    return ETIQUETAS_BASE.filter(nombre => !nombres.has(nombre));
}

/**
 * Crea las etiquetas base que faltan, con su checklist. No borra ni modifica las
 * etiquetas existentes (base o creadas por usuarios), ni sus checklists ni sus
 * plantillas vinculadas. Si una etiqueta base se renombró, se vuelve a crear con
 * el nombre original.
 */
export async function sembrarEtiquetasBase(db: PrismaClient): Promise<{ creadas: string[] }> {
    const creadas: string[] = [];
    for (const nombre of await etiquetasBaseFaltantes(db)) {
        const items = CHECKLIST_TEMPLATES[nombre] || [];
        try {
            await db.projectTag.create({
                data: {
                    name: nombre,
                    active: true,
                    impactsMetrics: true,
                    checklists: {
                        create: items.map((description, order) => ({ description, active: true, order })),
                    },
                },
            });
            creadas.push(nombre);
        } catch (e) {
            // Otra ejecución la creó entre la consulta y el alta: ya existe, no hay nada que hacer.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
            throw e;
        }
    }
    return { creadas };
}
