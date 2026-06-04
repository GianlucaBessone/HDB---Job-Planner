/**
 * View Preferences — Recents, Favorites, and Home/Sidebar prefs.
 * All stored per-user in localStorage.
 */

const MAX_RECENTS = 8;

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
