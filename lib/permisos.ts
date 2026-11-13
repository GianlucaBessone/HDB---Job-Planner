/**
 * Control de accesos: catálogo de funciones y resolución de permisos.
 *
 * El rol define los accesos por defecto. Sobre eso, cada usuario puede tener
 * permisos especiales que amplían ("permitir") o recortan ("denegar") lo que
 * le da el rol. Un permiso especial siempre gana sobre el rol.
 *
 * Hay dos tipos de acceso:
 *  - Vistas:    pantallas del menú. Sus roles por defecto están en lib/viewAccess.ts
 *               y se ajustan desde Configuración. Clave: "vista:/ventas/pdv".
 *  - Funciones: acciones dentro de una vista. Se declaran acá.
 *               Clave: "funcion:ventas.anular_venta".
 *
 * Este archivo no depende de la base ni de React: lo usan el cliente y el servidor.
 * Para leer los permisos de la sesión en una API, ver lib/permisosServer.ts.
 */

// ── Tipos ──────────────────────────────────────────────────────────

export type EfectoPermiso = 'permitir' | 'denegar';

export interface PermisoEspecial {
    clave: string;
    efecto: EfectoPermiso;
}

export interface FuncionConfig {
    id: string;
    label: string;
    description: string;
    grupo: string;
    /** Roles que tienen la función por defecto. */
    roles: string[];
}

// ── Catálogo de funciones ──────────────────────────────────────────

export const FUNCIONES = [
    // ─ Usuarios ─
    { id: 'usuarios.gestionar', label: 'Gestionar usuarios', description: 'Crear, editar y eliminar usuarios', grupo: 'Usuarios', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'usuarios.accesos', label: 'Administrar accesos', description: 'Otorgar y quitar permisos especiales a otros usuarios', grupo: 'Usuarios', roles: ['admin'] },

    // ─ Registro de tiempos ─
    { id: 'timesheets.control_horario', label: 'Control horario', description: 'Cruce entre registro de tiempos y fichadas, con ajustes', grupo: 'Registro de tiempos', roles: ['admin', 'supervisor'] },

    // ─ Ventas ─
    { id: 'ventas.anular_venta', label: 'Anular ventas', description: 'Anular ventas del Punto de Venta sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.modificar_precios', label: 'Modificar precios', description: 'Cambiar el precio unitario en una venta sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.anular_comprobante_cc', label: 'Anular comprobantes de cuenta corriente', description: 'Anular recibos y movimientos sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },

    // ─ Almacén y stock ─
    { id: 'inventario.consultar_stock', label: 'Consultar stock', description: 'Ver existencias por almacén', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor', 'operador'] },
    { id: 'inventario.consultar_movimientos', label: 'Consultar movimientos', description: 'Ver el historial de movimientos de stock', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'inventario.ajustar_stock', label: 'Ajustar stock', description: 'Registrar ajustes manuales de existencias', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.transferir_stock', label: 'Transferir stock', description: 'Mover existencias entre almacenes', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.conteos_crear', label: 'Crear conteos', description: 'Abrir conteos físicos de inventario', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'inventario.conteos_contar', label: 'Cargar conteos', description: 'Cargar cantidades contadas', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'operador'] },
    { id: 'inventario.conteos_confirmar', label: 'Confirmar conteos', description: 'Cerrar un conteo y aplicar sus diferencias', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.almacenes_admin', label: 'Administrar almacenes', description: 'Crear y editar almacenes y ubicaciones', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.exportar_inventario', label: 'Exportar inventario', description: 'Descargar existencias y movimientos', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'inventario.permitir_stock_negativo', label: 'Permitir stock negativo', description: 'Confirmar operaciones que dejan el stock en negativo', grupo: 'Almacén y stock', roles: ['admin'] },
] as const satisfies readonly FuncionConfig[];

export type FuncionId = (typeof FUNCIONES)[number]['id'];

const FUNCIONES_POR_ID = new Map<string, FuncionConfig>(FUNCIONES.map(f => [f.id, f]));

export function getFuncion(id: string): FuncionConfig | undefined {
    return FUNCIONES_POR_ID.get(id);
}

/** Funciones agrupadas, en el orden del catálogo. */
export function agruparFunciones(): { grupo: string; funciones: FuncionConfig[] }[] {
    const grupos: { grupo: string; funciones: FuncionConfig[] }[] = [];
    for (const f of FUNCIONES) {
        let g = grupos.find(x => x.grupo === f.grupo);
        if (!g) {
            g = { grupo: f.grupo, funciones: [] };
            grupos.push(g);
        }
        g.funciones.push(f);
    }
    return grupos;
}

// ── Claves ─────────────────────────────────────────────────────────

const PREFIJO_VISTA = 'vista:';
const PREFIJO_FUNCION = 'funcion:';

export function claveVista(viewKey: string): string {
    return PREFIJO_VISTA + viewKey;
}

export function claveFuncion(id: string): string {
    return PREFIJO_FUNCION + id;
}

export function parseClave(clave: string): { tipo: 'vista' | 'funcion'; id: string } | null {
    if (clave.startsWith(PREFIJO_VISTA)) return { tipo: 'vista', id: clave.slice(PREFIJO_VISTA.length) };
    if (clave.startsWith(PREFIJO_FUNCION)) return { tipo: 'funcion', id: clave.slice(PREFIJO_FUNCION.length) };
    return null;
}

// ── Resolución ─────────────────────────────────────────────────────

/** En datos viejos el rol de administrador aparece como "administrador". */
export function normalizarRol(role: string | null | undefined): string {
    const r = (role || '').trim().toLowerCase();
    return r === 'administrador' ? 'admin' : r;
}

/** Permiso especial del usuario para una clave, o null si rige el rol. */
export function efectoEspecial(clave: string, permisos: PermisoEspecial[] | null | undefined): EfectoPermiso | null {
    if (!permisos || permisos.length === 0) return null;
    const p = permisos.find(x => x.clave === clave);
    return p ? p.efecto : null;
}

/** Lo que da el rol por defecto para una función, sin mirar permisos especiales. */
export function rolTieneFuncion(id: FuncionId, role: string | null | undefined): boolean {
    const f = FUNCIONES_POR_ID.get(id);
    return !!f && f.roles.includes(normalizarRol(role));
}

/** Acceso efectivo a una función: permiso especial si lo hay; si no, el rol. */
export function puedeFuncion(
    id: FuncionId,
    role: string | null | undefined,
    permisos?: PermisoEspecial[] | null
): boolean {
    const especial = efectoEspecial(claveFuncion(id), permisos);
    if (especial) return especial === 'permitir';
    return rolTieneFuncion(id, role);
}
