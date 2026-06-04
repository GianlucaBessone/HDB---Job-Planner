/**
 * Centralised View-Access configuration.
 *
 * Every view, its roles, section, icon name, card colour, and
 * where it can appear (sidebar / home / ambos) is defined here.
 *
 * The sidebar and home page read this config dynamically —
 * no roles are hardcoded anywhere else.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface ViewConfig {
    key: string;
    label: string;
    description: string;
    roles: string[];
    access: 'sidebar' | 'home' | 'ambos';
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

// ── Sections (ISO 9001-aligned) ────────────────────────────────────
//  Operaciones         → Cláusula 8 – Operación
//  Gestión y Seguimiento → Cláusulas 5 & 6 – Liderazgo & Planificación
//  Logística y Materiales → Cláusula 7 – Apoyo / Recursos
//  Calidad y Mejora Continua → Cláusulas 9 & 10 – Evaluación del desempeño & Mejora
//  Administración      → Cláusula 4 & 7.1 – Contexto & Recursos

export const DEFAULT_SECTIONS: SectionConfig[] = [
    { key: 'operaciones',    label: 'Operaciones',               iconName: 'Wrench',          order: 1 },
    { key: 'gestion',        label: 'Gestión y Seguimiento',     iconName: 'LayoutGrid',      order: 2 },
    { key: 'logistica',      label: 'Logística y Materiales',    iconName: 'Package',         order: 3 },
    { key: 'calidad',        label: 'Calidad y Mejora Continua', iconName: 'FileCheck',       order: 4 },
    { key: 'administracion', label: 'Administración',            iconName: 'Settings',        order: 5 },
];

// ── Default Views ──────────────────────────────────────────────────

export const DEFAULT_VIEWS: ViewConfig[] = [
    // ─ Operaciones ─
    { key: '/fichado',       label: 'Fichado (GPS/QR)',       description: 'Iniciar/Finalizar jornada',       roles: ['operador', 'supervisor'],                   access: 'ambos', section: 'operaciones', iconName: 'MapPin',        color: 'bg-emerald-500' },
    { key: '/timesheets',    label: 'Registro de Tiempos',    description: 'Horas trabajadas',                roles: ['operador', 'supervisor', 'admin', 'qa'],    access: 'ambos', section: 'operaciones', iconName: 'Clock',         color: 'bg-blue-600' },
    { key: '/my-projects',   label: 'Mis Proyectos (Resp.)',  description: 'Proyectos a tu cargo',            roles: ['operador', 'supervisor', 'admin', 'qa'],    access: 'ambos', section: 'operaciones', iconName: 'ClipboardList', color: 'bg-indigo-500' },
    { key: '/delays',        label: 'Demoras del Cliente',    description: 'Registro de inconvenientes',      roles: ['operador', 'supervisor', 'admin', 'qa'],    access: 'ambos', section: 'operaciones', iconName: 'Timer',         color: 'bg-amber-500' },

    // ─ Gestión y Seguimiento ─
    { key: '/dashboard',          label: 'Panel de Análisis',        description: 'Métricas globales',           roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'LayoutDashboard', color: 'bg-cyan-600' },
    { key: '/planning',           label: 'Planificación',            description: 'Agenda y cronograma',         roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'Calendar',        color: 'bg-violet-600' },
    { key: '/projects',           label: 'Gestión de Proyectos',     description: 'Proyectos activos',           roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'LayoutGrid',      color: 'bg-indigo-500' },
    { key: '/ordenes-servicio',   label: 'Órdenes de Servicio',      description: 'Gestión y firmas',            roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'FileSignature',   color: 'bg-blue-600' },
    { key: '/aprobaciones',       label: 'Aprobaciones',             description: 'Validar fichadas de riesgo',  roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'ShieldCheck',     color: 'bg-teal-600' },
    { key: '/monitoreo-fichadas', label: 'Monitoreo de Fichadas',    description: 'Control en tiempo real',      roles: ['supervisor', 'admin', 'qa'],             access: 'ambos', section: 'gestion', iconName: 'ShieldAlert',     color: 'bg-rose-600' },

    // ─ Logística y Materiales ─
    { key: '/inventario',           label: 'Inventario de Materiales',  description: 'Stock y movimientos',                roles: ['admin', 'qa', 'vendedor'],                      access: 'ambos', section: 'logistica', iconName: 'PackageSearch', color: 'bg-amber-600' },
    { key: '/provision-materiales', label: 'Provisión de Materiales',   description: 'Gestión de suministros',             roles: ['vendedor', 'supervisor', 'admin', 'qa'],         access: 'ambos', section: 'logistica', iconName: 'Package',       color: 'bg-orange-500' },
    { key: '/herramientas',         label: 'Herramientas y Carros',     description: 'Retiro, devolución y verificación',  roles: ['operador', 'supervisor', 'admin', 'qa'],         access: 'ambos', section: 'logistica', iconName: 'Wrench',        color: 'bg-slate-600' },

    // ─ Calidad y Mejora Continua ─
    { key: '/calidad',              label: 'Calidad y Documentación',  description: 'Gestión documental ISO',       roles: ['admin', 'qa', 'supervisor'],              access: 'ambos', section: 'calidad', iconName: 'FileCheck',  color: 'bg-emerald-600' },
    { key: '/capacitacion',         label: 'Formación Integral',       description: 'Capacitación y competencias',  roles: ['operador', 'supervisor', 'admin', 'qa'],  access: 'ambos', section: 'calidad', iconName: 'BookOpen',   color: 'bg-sky-600' },
    { key: '/gestion-sugerencias',  label: 'Gestión de Sugerencias',   description: 'Ideas y mejora continua',      roles: ['admin', 'qa', 'supervisor'],              access: 'ambos', section: 'calidad', iconName: 'Lightbulb',  color: 'bg-yellow-500' },
    { key: '/auditoria-ia',         label: 'Auditoría de IA',          description: 'Validación inteligente',       roles: ['admin', 'qa', 'supervisor'],              access: 'ambos', section: 'calidad', iconName: 'Sparkles',   color: 'bg-fuchsia-600' },

    // ─ Administración ─
    { key: '/operators',      label: 'Gestión de Usuarios',  description: 'Operadores y permisos',      roles: ['supervisor', 'admin', 'qa'],                          access: 'ambos', section: 'administracion', iconName: 'Users',    color: 'bg-slate-700' },
    { key: '/clients',        label: 'Gestión de Clientes',  description: 'Base de datos de clientes',  roles: ['supervisor', 'admin', 'qa', 'vendedor'],              access: 'ambos', section: 'administracion', iconName: 'Landmark', color: 'bg-indigo-500' },
    { key: '/auditoria',      label: 'Auditoría',            description: 'Trazabilidad total',         roles: ['admin', 'qa', 'supervisor'],                          access: 'ambos', section: 'administracion', iconName: 'History',  color: 'bg-slate-900' },
    { key: '/configuracion',  label: 'Configuración',        description: 'Ajustes de sistema',         roles: ['admin', 'qa', 'supervisor'],                          access: 'ambos', section: 'administracion', iconName: 'Settings', color: 'bg-slate-400' },
    { key: '/notifications',  label: 'Notificaciones',       description: 'Novedades y alertas',        roles: ['operador', 'supervisor', 'admin', 'qa', 'vendedor'],  access: 'ambos', section: 'administracion', iconName: 'Bell',     color: 'bg-rose-500' },
];

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Merge saved configs with defaults, ensuring new views are included
 * and enriching saved entries with any missing fields from defaults.
 */
export function getViewConfig(savedConfigs: ViewConfig[]): ViewConfig[] {
    if (!savedConfigs || savedConfigs.length === 0) return DEFAULT_VIEWS.map(v => ({ ...v }));

    const defaultMap = new Map(DEFAULT_VIEWS.map(v => [v.key, v]));
    const savedKeys = new Set(savedConfigs.map(v => v.key));

    // Enrich saved entries with missing fields from defaults, and filter out legacy phantom views
    const merged = savedConfigs
        .filter(v => defaultMap.has(v.key))
        .map(v => {
            const def = defaultMap.get(v.key)!;
            return {
                ...v,
                description: v.description || def.description || '',
                section:     v.section     || def.section     || 'administracion',
                iconName:    v.iconName    || def.iconName    || 'ClipboardList',
                color:       v.color       || def.color       || 'bg-slate-500',
            };
        });

    // Append any new default views that aren't saved yet
    for (const dv of DEFAULT_VIEWS) {
        if (!savedKeys.has(dv.key)) {
            merged.push({ ...dv });
        }
    }
    return merged;
}

/**
 * Check if a view is allowed for a given role and location.
 * If no config is loaded yet (null), returns true to fallback to defaults.
 */
export function isViewAllowed(
    key: string,
    role: string,
    location: 'sidebar' | 'home',
    configs: ViewConfig[] | null
): boolean {
    const effectiveConfigs = (!configs || configs.length === 0) ? DEFAULT_VIEWS : configs;

    const cfg = effectiveConfigs.find(v => v.key === key);
    if (!cfg) return true; // Not configured = allow

    if (!cfg.roles.includes(role)) return false;
    if (location === 'sidebar' && cfg.access === 'home') return false;
    if (location === 'home' && cfg.access === 'sidebar') return false;

    return true;
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
    location: 'sidebar' | 'home'
): { section: SectionConfig; views: ViewConfig[] }[] {
    const groups: Map<string, ViewConfig[]> = new Map();

    for (const v of views) {
        if (!isViewAllowed(v.key, role, location, views)) continue;
        if (!groups.has(v.section)) groups.set(v.section, []);
        groups.get(v.section)!.push(v);
    }

    return DEFAULT_SECTIONS
        .filter(s => groups.has(s.key))
        .map(s => ({ section: s, views: groups.get(s.key)! }));
}
