import { showToast } from '@/components/Toast';

/**
 * Acciones masivas (P33): aplica una acción a varios elementos con la misma API que la acción individual, de a uno
 * (así valen los mismos permisos, validaciones y auditoría) y sigue aunque alguno falle.
 */
export interface ResultadoLote {
    ok: number;
    fallidas: number;
    /** Primer motivo de error que devolvió la API. */
    error: string | null;
}

export async function enLote(ids: string[], accion: (id: string) => Promise<Response>): Promise<ResultadoLote> {
    let ok = 0;
    let error: string | null = null;
    for (const id of ids) {
        try {
            const res = await accion(id);
            if (res.ok) ok++;
            else if (!error) error = (await res.json().catch(() => null))?.error || 'No se pudo aplicar';
        } catch {
            if (!error) error = 'Error de conexión';
        }
    }
    return { ok, fallidas: ids.length - ok, error };
}

/**
 * Avisa el resultado: "3 tareas completadas" y, si hubo, "1 sin cambiar: motivo". `hecho` va en singular y plural
 * cuando cambia ("completada"/"completadas"); un texto solo vale para los dos.
 */
export function avisarLote(r: ResultadoLote, unidad: [singular: string, plural: string], hecho: string | [singular: string, plural: string]) {
    const [singular, plural] = unidad;
    const [hechoUno, hechoVarios] = typeof hecho === 'string' ? [hecho, hecho] : hecho;
    if (r.ok > 0) showToast(`${r.ok} ${r.ok === 1 ? `${singular} ${hechoUno}` : `${plural} ${hechoVarios}`}`, 'success');
    if (r.fallidas > 0) showToast(`${r.fallidas} sin cambiar: ${r.error}`, 'error');
}
