import { create } from 'zustand';
import { FuncionId, PermisoEspecial, efectoEspecial, claveVista, normalizarRol, puedeFuncion } from '@/lib/permisos';
import { DEFAULT_VIEWS, ViewConfig, canOpenView } from '@/lib/viewAccess';

/**
 * Accesos del usuario en sesión: su rol, la configuración de vistas y sus
 * permisos especiales (lib/permisos.ts). Lo carga el layout; las pantallas
 * lo leen con useAcceso().
 */
interface AccessState {
    userId: string | null;
    role: string;
    permisos: PermisoEspecial[];
    views: ViewConfig[] | null;
    /** true cuando ya se intentó leer los permisos del servidor (haya salido bien o no). */
    cargado: boolean;
    setViews: (views: ViewConfig[]) => void;
    cargar: (user: { id?: string; role?: string } | null) => Promise<void>;
}

const cacheKey = (userId: string) => `accesos:${userId}`;

function leerCache(userId: string): PermisoEspecial[] {
    try {
        const raw = localStorage.getItem(cacheKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export const useAccessStore = create<AccessState>((set, get) => ({
    userId: null,
    role: '',
    permisos: [],
    views: null,
    cargado: false,

    setViews: (views) => set({ views }),

    cargar: async (user) => {
        const userId = user?.id || null;
        const role = normalizarRol(user?.role);
        if (!userId) {
            set({ userId: null, role: '', permisos: [], cargado: false });
            return;
        }
        // Al cambiar de usuario se arranca con lo último que se supo de él (sirve sin conexión).
        if (get().userId !== userId) {
            set({ userId, role, permisos: leerCache(userId), cargado: false });
        } else if (get().role !== role) {
            set({ role });
        }
        try {
            const res = await fetch('/api/accesos/yo', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (get().userId === userId && Array.isArray(data?.permisos)) {
                    set({ permisos: data.permisos });
                    try { localStorage.setItem(cacheKey(userId), JSON.stringify(data.permisos)); } catch { /* noop */ }
                }
            }
        } catch {
            // Sin conexión: quedan los permisos en caché.
        } finally {
            if (get().userId === userId) set({ cargado: true });
        }
    },
}));

/** Accesos del usuario en sesión, listos para usar en una pantalla. */
export function useAcceso() {
    const role = useAccessStore(s => s.role);
    const permisos = useAccessStore(s => s.permisos);
    const views = useAccessStore(s => s.views);
    const cargado = useAccessStore(s => s.cargado);

    return {
        cargado,
        role,
        permisos,
        /** Puede usar una función del catálogo (lib/permisos.ts). */
        puede: (funcion: FuncionId) => puedeFuncion(funcion, role, permisos),
        /** Puede abrir una vista del menú. */
        puedeVer: (viewKey: string) => canOpenView(viewKey, role, views ?? DEFAULT_VIEWS, permisos),
        /** La vista le fue denegada puntualmente a este usuario. */
        vistaDenegada: (viewKey: string) => efectoEspecial(claveVista(viewKey), permisos) === 'denegar',
    };
}
