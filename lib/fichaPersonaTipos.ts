/**
 * Tipos de la ficha única de la persona (sin dependencias de servidor; los usa la pantalla).
 */

export type SeccionFicha = 'legajo' | 'accesos' | 'epp' | 'formacion' | 'horas' | 'viajes';

export interface FichaPersona {
    persona: {
        id: string;
        nombreCompleto: string;
        posicion: string | null;
        role: string;
        activo: boolean;
        enVacaciones: boolean;
        categoriaManoObra: string | null;
        fechaIngreso: string | null;
        legajo: string | null;
    };
    /** Es la ficha de quien la mira ("Mi ficha"): solo lectura. */
    propia: boolean;
    /** Secciones que quien mira puede ver, en orden. */
    secciones: SeccionFicha[];
    /** Puede editar el legajo (si no, se ve en solo lectura). */
    editaLegajo: boolean;
    accesos?: {
        permisosEspeciales: number;
        puedeEditarUsuario: boolean;
        puedeAdministrarAccesos: boolean;
    };
    epp?: {
        vigentes: { id: string; nombre: string; talle: string | null; entregado: string; vence: string; estado: 'vigente' | 'por_vencer' | 'vencido' }[];
        actasPorFirmar: number;
    };
    formacion?: {
        competencias: { id: string; nombre: string; estado: string; vence: string | null }[];
        capacitaciones: { id: string; titulo: string; estado: string; fin: string | null; puntaje: number | null }[];
    };
    horas?: {
        desde: string;
        hasta: string;
        total: number;
        dias: number;
        porAprobar: number;
        porProyecto: { proyecto: string; horas: number }[];
    };
    viajes?: { id: string; codigo: string; destino: string; motivo: string; inicio: string; fin: string; estado: string; responsable: boolean }[];
    resumen: {
        documentosVencidos: number;
        documentosPorVencer: number;
        eppVencido: number;
        eppPorVencer: number;
        competenciasPorVencer: number;
        horas30: number | null;
        viajesActivos: number;
    };
}

export const ETIQUETA_SECCION: Record<SeccionFicha | 'resumen', string> = {
    resumen: 'Resumen',
    legajo: 'Legajo',
    accesos: 'Accesos',
    epp: 'EPP',
    formacion: 'Formación',
    horas: 'Horas',
    viajes: 'Viajes',
};
