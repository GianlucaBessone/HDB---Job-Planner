/**
 * View Preferences — Recents, Favorites, and Home/Sidebar prefs.
 * All stored per-user in localStorage.
 */

const MAX_RECENTS = 8;

// ── Usuario ────────────────────────────────────────────────────────

const CLAVES_POR_USUARIO = ['hdb_favorites_', 'hdb_home_prefs_', 'hdb_sidebar_fav_'];

/**
 * Clave de usuario para guardar preferencias: el id del operador.
 *
 * Antes se usaba `legajo`, un campo que el usuario no tiene, así que todo quedaba
 * bajo "default": los recientes no se registraban y los favoritos de todas las
 * personas de un mismo dispositivo se mezclaban. La primera vez que se usa el id,
 * se copian las preferencias guardadas bajo "default" para no perderlas.
 */
export function prefsUserId(user: { id?: string | null } | null | undefined): string {
    const id = user?.id;
    if (!id) return 'default';
    migrarPreferenciasLegado(id);
    return id;
}

function migrarPreferenciasLegado(id: string) {
    try {
        const marca = `hdb_prefs_migradas_${id}`;
        if (localStorage.getItem(marca)) return;
        for (const base of CLAVES_POR_USUARIO) {
            const legado = localStorage.getItem(`${base}default`);
            if (legado !== null && localStorage.getItem(`${base}${id}`) === null) {
                localStorage.setItem(`${base}${id}`, legado);
            }
        }
        localStorage.setItem(marca, '1');
    } catch { /* sin almacenamiento: se usan los valores por defecto */ }
}

// ── Recents ────────────────────────────────────────────────────────

interface RecentEntry {
    key: string;
    timestamp: number;
}

export function trackRecentView(viewKey: string, userId: string) {
    if (!viewKey || viewKey === '/') return; // Don't track home
    const storageKey = `hdb_recents_${userId}`;
    try {
        const stored = localStorage.getItem(storageKey);
        let recents: RecentEntry[] = stored ? JSON.parse(stored) : [];
        recents = recents.filter(r => r.key !== viewKey);
        recents.unshift({ key: viewKey, timestamp: Date.now() });
        recents = recents.slice(0, MAX_RECENTS);
        localStorage.setItem(storageKey, JSON.stringify(recents));
    } catch { /* ignore */ }
}

export function getRecentViews(userId: string): string[] {
    const storageKey = `hdb_recents_${userId}`;
    try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return [];
        const recents: RecentEntry[] = JSON.parse(stored);
        return recents.map(r => r.key);
    } catch {
        return [];
    }
}

// ── Favorites ──────────────────────────────────────────────────────

export function getFavorites(userId: string): string[] {
    try {
        const stored = localStorage.getItem(`hdb_favorites_${userId}`);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

export function setFavorites(userId: string, favorites: string[]) {
    localStorage.setItem(`hdb_favorites_${userId}`, JSON.stringify(favorites));
}

// ── Home Preferences ───────────────────────────────────────────────

export interface HomePrefs {
    showRecents: boolean;
    showFavorites: boolean;
}

export function getHomePrefs(userId: string): HomePrefs {
    try {
        const stored = localStorage.getItem(`hdb_home_prefs_${userId}`);
        return stored ? JSON.parse(stored) : { showRecents: true, showFavorites: true };
    } catch { return { showRecents: true, showFavorites: true }; }
}

export function setHomePrefs(userId: string, prefs: HomePrefs) {
    localStorage.setItem(`hdb_home_prefs_${userId}`, JSON.stringify(prefs));
}

// ── Sidebar Favorites Toggle ───────────────────────────────────────

export function getSidebarFavorites(userId: string): boolean {
    try {
        const stored = localStorage.getItem(`hdb_sidebar_fav_${userId}`);
        return stored ? JSON.parse(stored) : true;
    } catch { return true; }
}

export function setSidebarFavorites(userId: string, enabled: boolean) {
    localStorage.setItem(`hdb_sidebar_fav_${userId}`, JSON.stringify(enabled));
}

// ── Column Configuration (order + visibility) ─────────────────────

export interface ColumnConfigItem {
    key: string;
    visible: boolean;
}

export function getColumnConfig(userId: string, moduleKey: string): ColumnConfigItem[] | null {
    try {
        const stored = localStorage.getItem(`hdb_columns_${moduleKey}_${userId}`);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch { return null; }
}

export function setColumnConfig(userId: string, moduleKey: string, config: ColumnConfigItem[]) {
    localStorage.setItem(`hdb_columns_${moduleKey}_${userId}`, JSON.stringify(config));
}

// ── Column Widths (resize persistence) ────────────────────────────

export function getColumnWidths(userId: string, moduleKey: string): Record<string, number> | null {
    try {
        const stored = localStorage.getItem(`hdb_colwidths_${moduleKey}_${userId}`);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch { return null; }
}

export function setColumnWidths(userId: string, moduleKey: string, widths: Record<string, number>) {
    localStorage.setItem(`hdb_colwidths_${moduleKey}_${userId}`, JSON.stringify(widths));
}
