/**
 * Menú del sistema: vistas, secciones y roles por defecto.
 *
 * El menú se organiza por dominios de trabajo (lo que la gente maneja:
 * proyectos, personas, clientes, stock, calidad), no por cláusulas ISO.
 * Ver docs/AUDITORIA_FUNCIONAL.md, sección 13.
 *
 * El diseño del menú (sección, nombre, descripción, ícono, ubicación) se
 * define acá y no es configurable. Lo único que se ajusta desde
 * Configuración → Vistas son los roles que ven cada vista.
 *
 * El menú lateral, el inicio y el buscador leen esta configuración:
 * no hay roles escritos a mano en ningún otro lugar.
 */

import { PermisoEspecial, claveVista, efectoEspecial, puedeFuncion, getFuncion } from './permisos';

// ── Types ──────────────────────────────────────────────────────────

/**
 * Dónde aparece la vista:
 *  - 'ambos':   menú lateral e inicio.
 *  - 'sidebar': solo menú lateral.
 *  - 'home':    solo inicio.
 *  - 'oculta':  ni menú ni inicio; se abre desde el encabezado o un enlace
 *               (sigue sujeta a roles y permisos, y aparece en el buscador).
 */
export type ViewAccessLocation = 'sidebar' | 'home' | 'ambos' | 'oculta';

export interface ViewConfig {
    key: string;
    label: string;
    description: string;
    roles: string[];
    access: ViewAccessLocation;
    section: string;
    iconName: string;
    color: string;
}

export interface SectionConfig {
    key: string;
    label: string;
    iconName: string;
    order: number;
}

// ── Secciones (por dominio de trabajo) ─────────────────────────────

export const DEFAULT_SECTIONS: SectionConfig[] = [
    { key: 'mi_trabajo',  label: 'Mi trabajo',       iconName: 'ClipboardList',   order: 1 },
    { key: 'proyectos',   label: 'Proyectos',        iconName: 'LayoutGrid',      order: 2 },
    { key: 'personas',    label: 'Personas',         iconName: 'Users',           order: 3 },
    { key: 'comercial',   label: 'Comercial',        iconName: 'ShoppingCart',    order: 4 },
    { key: 'logistica',   label: 'Logística',        iconName: 'Package',         order: 5 },
    { key: 'finanzas',    label: 'Finanzas',         iconName: 'Wallet',          order: 6 },
    { key: 'calidad',     label: 'Calidad',          iconName: 'FileCheck',       order: 7 },
    { key: 'indicadores', label: 'Indicadores',      iconName: 'LayoutDashboard', order: 8 },
    { key: 'ajustes',     label: 'Ajustes',          iconName: 'Settings',        order: 9 },
    { key: 'ayuda',       label: 'Ayuda y avisos',   iconName: 'LifeBuoy',        order: 10 },
];

// ── Vistas ─────────────────────────────────────────────────────────

const R_TODOS = ['operador', 'supervisor', 'admin', 'qa', 'vendedor'];
const R_PERSONAL = ['operador', 'supervisor', 'admin', 'qa'];
const R_GESTION = ['supervisor', 'admin', 'qa'];

export const DEFAULT_VIEWS: ViewConfig[] = [
    // ─ Mi trabajo: lo que cada persona usa para su propio día ─
    { key: '/fichado',       label: 'Fichar jornada',    description: 'Iniciar y cerrar la jornada con GPS o QR',  roles: ['operador', 'supervisor'], access: 'ambos', section: 'mi_trabajo', iconName: 'MapPin',        color: 'bg-emerald-500' },
    { key: '/timesheets',    label: 'Registro de horas', description: 'Horas trabajadas por proyecto',             roles: R_PERSONAL,                 access: 'ambos', section: 'mi_trabajo', iconName: 'Clock',         color: 'bg-blue-600' },
    { key: '/my-projects',   label: 'Mis proyectos',     description: 'Donde sos responsable o estás en el equipo', roles: R_PERSONAL,                 access: 'ambos', section: 'mi_trabajo', iconName: 'ClipboardList', color: 'bg-indigo-500' },
    { key: '/tareas',        label: 'Tareas',            description: 'Tareas, recordatorios y seguimientos',      roles: R_PERSONAL,                 access: 'ambos', section: 'mi_trabajo', iconName: 'ListTodo',      color: 'bg-purple-600' },
    { key: '/mis-epp',       label: 'Mis EPP',           description: 'Elementos de protección y firmas',          roles: R_PERSONAL,                 access: 'ambos', section: 'mi_trabajo', iconName: 'ShieldCheck',   color: 'bg-emerald-600' },
    { key: '/mis-viajes',    label: 'Mis viajes',        description: 'Gastos y viáticos de tus viajes',           roles: R_TODOS,                    access: 'ambos', section: 'mi_trabajo', iconName: 'Luggage',       color: 'bg-sky-600' },
    { key: '/capacitacion',  label: 'Mi formación',      description: 'Capacitaciones y certificados',             roles: R_PERSONAL,                 access: 'ambos', section: 'mi_trabajo', iconName: 'BookOpen',      color: 'bg-sky-600' },

    // ─ Proyectos: obras y servicios de punta a punta ─
    { key: '/projects',          label: 'Proyectos',            description: 'Lista, cronograma y seguimiento',              roles: R_GESTION,  access: 'ambos', section: 'proyectos', iconName: 'LayoutGrid',    color: 'bg-indigo-500' },
    // La ficha se abre desde Proyectos y desde Mis proyectos: la ve también el responsable o el equipo de la obra
    { key: '/projects/ficha',    label: 'Ficha del proyecto',   description: 'Resumen, checklist, bitácora, materiales y órdenes', roles: R_PERSONAL, access: 'oculta', section: 'proyectos', iconName: 'LayoutGrid', color: 'bg-indigo-500' },
    { key: '/planning',          label: 'Agenda del equipo',    description: 'Quién trabaja dónde cada día',                 roles: R_GESTION,  access: 'ambos', section: 'proyectos', iconName: 'Calendar',      color: 'bg-violet-600' },
    { key: '/ordenes-servicio',  label: 'Órdenes de servicio',  description: 'Trabajo certificado, firma y cobro',           roles: R_GESTION,  access: 'ambos', section: 'proyectos', iconName: 'FileSignature', color: 'bg-blue-600' },
    { key: '/ordenes-trabajo',   label: 'Órdenes de trabajo',   description: 'Órdenes por ciclos con firma en el portal',    roles: R_TODOS,    access: 'ambos', section: 'proyectos', iconName: 'FileText',      color: 'bg-blue-700' },
    { key: '/informes-tecnicos', label: 'Informes técnicos',    description: 'Relevamientos y diagnósticos',                 roles: R_PERSONAL, access: 'ambos', section: 'proyectos', iconName: 'FileText',      color: 'bg-indigo-600' },
    { key: '/delays',            label: 'Demoras del cliente',  description: 'Tiempo perdido por causas del cliente',        roles: R_PERSONAL, access: 'ambos', section: 'proyectos', iconName: 'Timer',         color: 'bg-amber-500' },

    // ─ Personas: usuarios, asistencia, RRHH y viajes ─
    { key: '/operators',          label: 'Usuarios y accesos',  description: 'Personas, roles y permisos',            roles: R_GESTION,                   access: 'ambos', section: 'personas', iconName: 'Users',       color: 'bg-slate-700' },
    { key: '/monitoreo-fichadas', label: 'Asistencia y horas',  description: 'Fichadas en curso, aprobaciones y control horario', roles: R_GESTION, access: 'ambos',  section: 'personas', iconName: 'ShieldAlert', color: 'bg-rose-600' },
    // Se abre desde Asistencia y horas y desde los pendientes de Inicio.
    { key: '/aprobaciones',       label: 'Fichadas a aprobar',  description: 'Fichadas con alertas para validar',     roles: R_GESTION,                   access: 'oculta', section: 'personas', iconName: 'ShieldCheck', color: 'bg-teal-600' },
    { key: '/rrhh',               label: 'Recursos humanos',    description: 'Selección de personal y EPP',           roles: ['admin', 'supervisor', 'qa'], access: 'ambos', section: 'personas', iconName: 'Briefcase',   color: 'bg-indigo-600' },
    { key: '/viajes',             label: 'Viajes y viáticos',   description: 'Planificación y rendición de viajes',   roles: ['admin', 'supervisor', 'qa'], access: 'ambos', section: 'personas', iconName: 'Plane',       color: 'bg-sky-700' },

    // ─ Comercial: clientes, ofertas, mostrador y precios ─
    { key: '/clients',               label: 'Clientes',                  description: 'Datos de clientes y listas de precios',                   roles: ['supervisor', 'admin', 'qa', 'vendedor'],             access: 'ambos', section: 'comercial', iconName: 'Landmark',      color: 'bg-indigo-500' },
    { key: '/presupuestos-servicio', label: 'Presupuestos de servicio',  description: 'Mano de obra y materiales; el aceptado pasa a proyecto',   roles: ['admin', 'supervisor', 'qa'],                         access: 'ambos', section: 'comercial', iconName: 'Calculator',    color: 'bg-blue-600' },
    { key: '/ventas/cotizaciones',   label: 'Cotizaciones',              description: 'Presupuestos rápidos de productos',                        roles: ['admin', 'supervisor', 'vendedor', 'qa'],             access: 'ambos', section: 'comercial', iconName: 'FileSignature', color: 'bg-violet-600' },
    { key: '/pliegos',               label: 'Pliegos',                   description: 'Pliegos de clientes analizados con IA',                    roles: R_PERSONAL,                                            access: 'ambos', section: 'comercial', iconName: 'FileSearch',    color: 'bg-violet-600' },
    { key: '/ventas/pdv',            label: 'Punto de venta',            description: 'Venta de mostrador y remitos',                              roles: ['admin', 'supervisor', 'vendedor'],                   access: 'ambos', section: 'comercial', iconName: 'CreditCard',    color: 'bg-emerald-600' },
    { key: '/ventas/gestion',        label: 'Productos y precios',       description: 'Catálogo, listas de precios e importación',                roles: ['admin', 'supervisor', 'vendedor', 'qa'],             access: 'ambos', section: 'comercial', iconName: 'Boxes',         color: 'bg-emerald-600' },

    // ─ Logística: stock, materiales para obras y herramientas ─
    { key: '/ventas/almacen',        label: 'Stock y almacenes',      description: 'Existencias, movimientos, ajustes y conteos',  roles: ['admin', 'supervisor', 'vendedor', 'qa'], access: 'ambos',  section: 'logistica', iconName: 'Warehouse',     color: 'bg-indigo-600' },
    { key: '/provision-materiales',  label: 'Materiales para obras',  description: 'Pedido, entrega, uso y devolución por proyecto', roles: ['vendedor', 'supervisor', 'admin', 'qa'], access: 'ambos',  section: 'logistica', iconName: 'Package',       color: 'bg-orange-500' },
    { key: '/herramientas',          label: 'Herramientas y carros',  description: 'Retiro, devolución y verificación',            roles: R_PERSONAL,                                access: 'ambos',  section: 'logistica', iconName: 'Wrench',        color: 'bg-slate-600' },

    // ─ Finanzas: lo que entra y lo que sale ─
    { key: '/ventas/cuentas-corrientes', label: 'Cuentas corrientes', description: 'Saldos, cobranzas y estados de cuenta', roles: ['admin', 'supervisor', 'vendedor', 'qa'], access: 'ambos', section: 'finanzas', iconName: 'Receipt', color: 'bg-cyan-600' },
    { key: '/administracion/gastos',     label: 'Gastos y facturas',  description: 'Facturas de proveedores y gastos',      roles: ['admin', 'supervisor', 'qa'],             access: 'ambos', section: 'finanzas', iconName: 'Wallet',  color: 'bg-green-600' },

    // ─ Calidad: sistema de gestión ISO 9001 ─
    { key: '/calidad',             label: 'Calidad y documentos',   description: 'Documentos, NC, CAPA, riesgos y competencias', roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'calidad', iconName: 'FileCheck', color: 'bg-emerald-600' },
    { key: '/gestion-sugerencias', label: 'Sugerencias y mejoras',  description: 'Ideas y propuestas de mejora del personal',   roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'calidad', iconName: 'Lightbulb', color: 'bg-yellow-500' },
    { key: '/auditoria',           label: 'Auditoría de cambios',   description: 'Quién cambió qué y cuándo',                   roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'calidad', iconName: 'History',   color: 'bg-slate-900' },
    { key: '/verificacion-firmas', label: 'Verificación de firmas', description: 'Integridad de los documentos firmados',       roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'calidad', iconName: 'FileBadge', color: 'bg-blue-600' },

    // ─ Indicadores: cómo va el negocio ─
    { key: '/dashboard', label: 'Tablero general',          description: 'Proyectos, órdenes, servicios y personas', roles: R_GESTION,                    access: 'ambos', section: 'indicadores', iconName: 'LayoutDashboard', color: 'bg-cyan-600' },
    { key: '/okr-kpi',   label: 'Objetivos e indicadores',  description: 'OKR, KPI y planes de acción',              roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'indicadores', iconName: 'Target',          color: 'bg-emerald-600' },

    // ─ Ajustes: lo transversal y lo técnico ─
    { key: '/configuracion',     label: 'Configuración',         description: 'Roles por vista y dónde se configura cada módulo', roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'ajustes', iconName: 'Settings', color: 'bg-slate-400' },
    { key: '/datasets',          label: 'Motor de datasets',     description: 'Consultas que alimentan los indicadores',        roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'ajustes', iconName: 'Database', color: 'bg-indigo-600' },
    { key: '/diccionario-datos', label: 'Diccionario de datos',  description: 'Tablas y campos de la base',                     roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'ajustes', iconName: 'Table',    color: 'bg-slate-600' },
    { key: '/auditoria-ia',      label: 'Consumo de IA',         description: 'Llamadas, errores y costo de la IA',             roles: ['admin', 'qa', 'supervisor'], access: 'ambos', section: 'ajustes', iconName: 'Sparkles', color: 'bg-fuchsia-600' },

    // ─ Ayuda y avisos: se abren desde el encabezado, no ocupan el menú ─
    { key: '/notifications', label: 'Notificaciones',      description: 'Novedades y alertas',                roles: R_TODOS, access: 'oculta', section: 'ayuda', iconName: 'Bell',     color: 'bg-rose-500' },
    { key: '/tickets',       label: 'Tickets de soporte',  description: 'Fallas y pedidos sobre el sistema',  roles: R_TODOS, access: 'oculta', section: 'ayuda', iconName: 'LifeBuoy', color: 'bg-rose-600' },
    { key: '/centro-ayuda',  label: 'Centro de ayuda',     description: 'Guías de uso del sistema',           roles: R_TODOS, access: 'oculta', section: 'ayuda', iconName: 'BookOpen', color: 'bg-blue-500' },
];

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Combina lo guardado en Configuración → Vistas con las vistas del código.
 *
 * Solo se toman de lo guardado los ROLES de cada vista. Nombre, descripción,
 * sección, ícono, color y ubicación salen siempre del código: así un cambio
 * de diseño del menú llega a todos sin depender de datos viejos.
 * Las vistas guardadas que ya no existen se descartan; las nuevas se agregan.
 */
export function getViewConfig(savedConfigs: Array<Partial<ViewConfig>> | null | undefined): ViewConfig[] {
    const rolesGuardados = new Map<string, string[]>();
    for (const v of savedConfigs || []) {
        if (v && typeof v.key === 'string' && Array.isArray(v.roles)) rolesGuardados.set(v.key, v.roles);
    }
    return DEFAULT_VIEWS.map(def => {
        const roles = VISTAS_DESACTIVADAS.includes(def.key) ? [] : (rolesGuardados.get(def.key) ?? def.roles);
        return { ...def, roles: [...roles] };
    });
}

/** Vistas dadas de baja: no se habilitan por rol ni por permiso especial. */
export const VISTAS_DESACTIVADAS: string[] = [];

/**
 * Acceso a una vista sin mirar dónde se muestra: permiso especial del usuario
 * si lo hay; si no, los roles configurados para la vista.
 */
function viewGranted(cfg: ViewConfig, role: string, permisos?: PermisoEspecial[] | null): boolean {
    if (VISTAS_DESACTIVADAS.includes(cfg.key)) return false;
    const especial = efectoEspecial(claveVista(cfg.key), permisos);
    if (especial) return especial === 'permitir';
    return cfg.roles.includes(role);
}

/**
 * Check if a view is allowed for a given role and location.
 * If no config is loaded yet (null), returns true to fallback to defaults.
 * `permisos` son los permisos especiales del usuario (lib/permisos.ts): ganan sobre el rol.
 */
export function isViewAllowed(
    key: string,
    role: string,
    location: 'sidebar' | 'home',
    configs: ViewConfig[] | null,
    permisos?: PermisoEspecial[] | null
): boolean {
    const effectiveConfigs = (!configs || configs.length === 0) ? DEFAULT_VIEWS : configs;

    const cfg = effectiveConfigs.find(v => v.key === key);
    if (!cfg) return true; // Not configured = allow

    if (!viewGranted(cfg, role, permisos)) return false;
    if (cfg.access === 'oculta') return false;
    if (location === 'sidebar' && cfg.access === 'home') return false;
    if (location === 'home' && cfg.access === 'sidebar') return false;

    return true;
}

/**
 * Si el usuario puede abrir una vista, se muestre en el menú, en inicio o en ambos.
 * Para que una página valide su propio acceso.
 */
export function canOpenView(
    key: string,
    role: string,
    configs: ViewConfig[] | null,
    permisos?: PermisoEspecial[] | null
): boolean {
    const effectiveConfigs = (!configs || configs.length === 0) ? DEFAULT_VIEWS : configs;
    const cfg = effectiveConfigs.find(v => v.key === key);
    if (!cfg) return true;
    return viewGranted(cfg, role, permisos);
}

/** Vista del menú a la que pertenece una ruta (la de clave más larga que la contiene). */
export function findViewForPath(pathname: string | null, configs: ViewConfig[]): ViewConfig | undefined {
    if (!pathname) return undefined;
    let match: ViewConfig | undefined;
    for (const v of configs) {
        if (pathname === v.key || pathname.startsWith(v.key + '/')) {
            if (!match || v.key.length > match.key.length) match = v;
        }
    }
    return match;
}

/**
 * Get the section config for a given section key.
 */
export function getSection(sectionKey: string): SectionConfig | undefined {
    return DEFAULT_SECTIONS.find(s => s.key === sectionKey);
}

/**
 * Group views by their section key, returning them in section order.
 */
export function groupViewsBySection(
    views: ViewConfig[],
    role: string,
    location: 'sidebar' | 'home',
    permisos?: PermisoEspecial[] | null
): { section: SectionConfig; views: ViewConfig[] }[] {
    const groups: Map<string, ViewConfig[]> = new Map();

    for (const v of views) {
        if (!isViewAllowed(v.key, role, location, views, permisos)) continue;
        if (!groups.has(v.section)) groups.set(v.section, []);
        groups.get(v.section)!.push(v);
    }

    return DEFAULT_SECTIONS
        .filter(s => groups.has(s.key))
        .map(s => ({ section: s, views: groups.get(s.key)! }));
}

// ── Funciones dentro de una vista ──────────────────────────────────
// Accesos que no son una vista del menú sino una función de otra vista.

/** Control horario (botón en Registro de Tiempos → /timesheets/control-horario). */
export const CONTROL_HORARIO_ROLES: readonly string[] = getFuncion('timesheets.control_horario')?.roles ?? [];

export function canUseControlHorario(
    role: string | null | undefined,
    permisos?: PermisoEspecial[] | null
): boolean {
    return puedeFuncion('timesheets.control_horario', role, permisos);
}
