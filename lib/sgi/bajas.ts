/**
 * Bajas de registros del SGI (NC, CAPA, riesgos, oportunidades, objetivos).
 *
 * ISO 9001 pide conservar la información documentada: un registro con trabajo hecho
 * no se borra, se anula (queda con su estado de anulación y en Auditoría).
 * Solo se borra un registro recién creado, para corregir un error de carga:
 * menos de 24 horas, todavía en su estado inicial y sin nada vinculado.
 */
export const HORAS_PARA_BORRAR = 24;

export function puedeBorrarseSgi(registro: { createdAt: Date; estado: string }, estadoInicial: string, vinculados: number): boolean {
    const horas = (Date.now() - new Date(registro.createdAt).getTime()) / 3_600_000;
    return horas < HORAS_PARA_BORRAR && registro.estado === estadoInicial && vinculados === 0;
}

/** Suma los contadores de relaciones de un `_count` de Prisma. */
export function totalVinculados(count: Record<string, number> | undefined): number {
    return Object.values(count || {}).reduce((a, n) => a + n, 0);
}

export const MENSAJE_ANULADO = 'Tiene historial o ya no es reciente: quedó anulado y se conserva';
