/**
 * Quién puede hacer qué con una tarea. Mismo criterio que la pantalla de Tareas.
 *  - total:   quien tiene "tareas.ver_todas", el creador o un involucrado responsable.
 *  - estado:  un involucrado colaborador, que solo cambia el estado.
 *  - lectura: un involucrado observador: ve la tarea y comenta.
 *  - ninguno: el resto.
 */
import type { AccesoSesion } from '@/lib/permisosServer';

export type NivelTarea = 'total' | 'estado' | 'lectura' | 'ninguno';

export interface TareaConInvolucrados {
    creadorId: string;
    involucrados: { operatorId: string; rol: string }[];
}

export function nivelSobreTarea(acceso: AccesoSesion, tarea: TareaConInvolucrados): NivelTarea {
    if (acceso.puede('tareas.ver_todas') || tarea.creadorId === acceso.userId) return 'total';
    const inv = tarea.involucrados.find(i => i.operatorId === acceso.userId);
    if (!inv) return 'ninguno';
    if (inv.rol === 'responsable') return 'total';
    if (inv.rol === 'colaborador') return 'estado';
    return 'lectura';
}

/** Ve la tarea, sus comentarios y recordatorios. */
export function participaEnTarea(acceso: AccesoSesion, tarea: TareaConInvolucrados): boolean {
    return nivelSobreTarea(acceso, tarea) !== 'ninguno';
}
