export interface ViewConfig {
    key: string;
    label: string;
    roles: string[];
    access: 'sidebar' | 'home' | 'ambos';
}

export const DEFAULT_VIEWS: ViewConfig[] = [
    { key: '/', label: 'Inicio', roles: ['operador', 'supervisor', 'admin', 'vendedor'], access: 'sidebar' },
    { key: '/fichado', label: 'Fichado (GPS/QR)', roles: ['operador', 'supervisor'], access: 'ambos' },
    { key: '/my-projects', label: 'Mis Proyectos (Resp.)', roles: ['operador', 'supervisor', 'admin'], access: 'ambos' },
    { key: '/timesheets', label: 'Registro de Tiempos', roles: ['operador', 'supervisor', 'admin'], access: 'ambos' },
    { key: '/delays', label: 'Demoras del Cliente', roles: ['operador', 'supervisor', 'admin'], access: 'ambos' },
    { key: '/dashboard', label: 'Panel de Análisis', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/planning', label: 'Planificación', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/projects', label: 'Gestión de Proyectos', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/ordenes-servicio', label: 'Órdenes de Servicio', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/inventario', label: 'Inventario de Materiales', roles: ['admin', 'vendedor'], access: 'sidebar' },
    { key: '/provision-materiales', label: 'Provisión de Materiales', roles: ['vendedor', 'supervisor', 'admin'], access: 'ambos' },
    { key: '/operators', label: 'Gestión de Usuarios', roles: ['operador', 'supervisor', 'admin', 'vendedor'], access: 'ambos' },
    { key: '/clients', label: 'Gestión de Clientes', roles: ['supervisor', 'admin', 'vendedor'], access: 'ambos' },
    { key: '/aprobaciones', label: 'Aprobaciones', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/monitoreo-fichadas', label: 'Monitoreo de Fichadas', roles: ['supervisor', 'admin'], access: 'sidebar' },
    { key: '/auditoria', label: 'Auditoría', roles: ['admin', 'supervisor'], access: 'ambos' },
    { key: '/configuracion', label: 'Configuración', roles: ['admin', 'supervisor'], access: 'ambos' },
    { key: '/carros', label: 'Carros de Herramientas', roles: ['operador', 'supervisor', 'admin'], access: 'ambos' },
    { key: '/carros-historial', label: 'Historial de Carros', roles: ['supervisor', 'admin'], access: 'ambos' },
    { key: '/notifications', label: 'Notificaciones', roles: ['operador', 'supervisor', 'admin', 'vendedor'], access: 'home' },
];

/**
 * Merge saved configs with defaults, ensuring new views are included.
 */
export function getViewConfig(savedConfigs: ViewConfig[]): ViewConfig[] {
    if (!savedConfigs || savedConfigs.length === 0) return DEFAULT_VIEWS.map(v => ({ ...v }));

    const savedKeys = new Set(savedConfigs.map(v => v.key));
    const merged = savedConfigs.map(v => ({ ...v }));
    for (const dv of DEFAULT_VIEWS) {
        if (!savedKeys.has(dv.key)) {
            merged.push({ ...dv });
        }
    }
    return merged;
}

/**
 * Check if a view is allowed for a given role and location.
 * If no config is loaded yet (null), returns true to fallback to hardcoded behavior.
 */
export function isViewAllowed(
    key: string,
    role: string,
    location: 'sidebar' | 'home',
    configs: ViewConfig[] | null
): boolean {
    if (!configs || configs.length === 0) return true;

    const cfg = configs.find(v => v.key === key);
    if (!cfg) return true; // Not configured = allow

    if (!cfg.roles.includes(role)) return false;
    if (location === 'sidebar' && cfg.access === 'home') return false;
    if (location === 'home' && cfg.access === 'sidebar') return false;

    return true;
}
