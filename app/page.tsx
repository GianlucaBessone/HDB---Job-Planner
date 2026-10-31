"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock as ClockIcon,
  GripVertical,
  Pencil,
  Search,
  Star,

} from "lucide-react";
import Link from "next/link";
import {
  ViewConfig,
  isViewAllowed,
  DEFAULT_VIEWS,
  groupViewsBySection,
  getViewConfig,
} from "@/lib/viewAccess";
import { renderIcon } from "@/lib/iconRegistry";
import {
  getRecentViews,
  getFavorites,
  setFavorites as saveFavorites,
  getHomePrefs,
  setHomePrefs,
  HomePrefs,
} from "@/lib/viewPreferences";
import TechAssistantChat from "@/components/TechAssistantChat";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operador: "Operador",
  qa: "Calidad",
  vendedor: "Vendedor",
};

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function HomePage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState<string>("default");

  const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cachedViewConfig");
      if (cached) {
        try {
          return getViewConfig(JSON.parse(cached));
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavoritesLocal] = useState<string[]>([]);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<HomePrefs>({
    showRecents: true,
    showFavorites: true,
  });
  const [dragOverFavorites, setDragOverFavorites] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setUserData(user);
        setUserRole(user.role?.toLowerCase() || "operador");
        setUserName(user.nombreCompleto || "Usuario");
        const uid = user.legajo || "default";
        setUserId(uid);
        setFavoritesLocal(getFavorites(uid));
        setRecentKeys(getRecentViews(uid));
        setPrefs(getHomePrefs(uid));
      } catch (e) {
        // Ignore
      }
    }

    fetch("/api/config/views")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setViewConfig(data);
          localStorage.setItem("cachedViewConfig", JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, [router]);

  const role = userRole?.trim().toLowerCase() || "operador";
  const effectiveViews =
    viewConfig && viewConfig.length > 0 ? viewConfig : DEFAULT_VIEWS;
  const show = (key: string) =>
    isViewAllowed(key, role, "home", effectiveViews);

  const getView = (key: string) => effectiveViews.find((v) => v.key === key);

  const addFavorite = useCallback(
    (key: string) => {
      setFavoritesLocal((prev) => {
        if (prev.includes(key)) return prev;
        const next = [...prev, key];
        saveFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

  const removeFavorite = useCallback(
    (key: string) => {
      setFavoritesLocal((prev) => {
        const next = prev.filter((k) => k !== key);
        saveFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

  const toggleFavorite = useCallback(
    (key: string) => (favorites.includes(key) ? removeFavorite(key) : addFavorite(key)),
    [favorites, addFavorite, removeFavorite],
  );

  const togglePref = useCallback(
    (key: keyof HomePrefs) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        setHomePrefs(userId, next);
        return next;
      });
    },
    [userId],
  );

  // Drag & drop hacia Favoritos (modo personalizar)
  const handleDragStart = (e: React.DragEvent, viewKey: string) => {
    e.dataTransfer.setData("text/plain", viewKey);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDropFavorites = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFavorites(false);
    const key = e.dataTransfer.getData("text/plain");
    if (key) addFavorite(key);
  };

  const grouped = useMemo(
    () => groupViewsBySection(effectiveViews, role, "home"),
    [effectiveViews, role],
  );

  const filteredGroups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        views: g.views.filter(
          (v) =>
            normalize(v.label).includes(q) ||
            normalize(v.description).includes(q) ||
            normalize(g.section.label).includes(q),
        ),
      }))
      .filter((g) => g.views.length > 0);
  }, [grouped, query]);

  if (!userRole) {
    return <LoadingState />;
  }

  const recentViews = recentKeys
    .map((key) => getView(key))
    .filter((v): v is ViewConfig => !!v && show(v.key))
    .slice(0, 8);

  const favoriteViews = favorites
    .map((key) => getView(key))
    .filter((v): v is ViewConfig => !!v && show(v.key));

  const isSearching = query.trim().length > 0;
  const gridClass =
    "grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5";

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Encabezado */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-slate-500 dark:text-slate-400 first-letter:uppercase">
            {now?.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-display text-slate-900 dark:text-slate-50 truncate mt-0.5">
            {now ? greeting(now) : "Hola"}, {userName.split(" ")[0]}
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            {ROLE_LABEL[role] || role} · {grouped.reduce((n, g) => n + g.views.length, 0)} módulos disponibles
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar un módulo"
              aria-label="Buscar un módulo"
              className="input !pl-9"
            />
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn("btn shrink-0", editMode ? "btn-primary" : "btn-secondary")}
            aria-pressed={editMode}
          >
            {editMode ? <Check /> : <Pencil />}
            <span className="hidden sm:inline">{editMode ? "Listo" : "Personalizar"}</span>
          </button>
        </div>
      </header>

      {/* Personalización */}
      {editMode && (
        <section className="surface p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 animate-in fade-in duration-150" aria-label="Personalizar inicio">
          <p className="text-[13px] text-slate-600 dark:text-slate-300 flex-1">
            Marcá la estrella de un módulo, o arrastralo a Favoritos, para tenerlo a mano.
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={prefs.showRecents} onChange={() => togglePref("showRecents")} className="w-4 h-4 rounded" />
              Mostrar recientes
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={prefs.showFavorites} onChange={() => togglePref("showFavorites")} className="w-4 h-4 rounded" />
              Mostrar favoritos
            </label>
          </div>
        </section>
      )}

      {/* Recientes: accesos de un clic */}
      {!isSearching && prefs.showRecents && recentViews.length > 0 && (
        <section aria-labelledby="home-recientes">
          <h2 id="home-recientes" className="eyebrow flex items-center gap-1.5 mb-2.5">
            <ClockIcon className="w-3.5 h-3.5" aria-hidden="true" /> Recientes
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentViews.map((v) => (
              <Link
                key={`recent-${v.key}`}
                href={v.key}
                className="inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg border border-border bg-card text-[13px] font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="text-slate-500 dark:text-slate-400">{renderIcon(v.iconName, "w-4 h-4")}</span>
                {v.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Favoritos */}
      {!isSearching && prefs.showFavorites && (favoriteViews.length > 0 || editMode) && (
        <section aria-labelledby="home-favoritos">
          <h2 id="home-favoritos" className="eyebrow flex items-center gap-1.5 mb-2.5">
            <Star className="w-3.5 h-3.5" aria-hidden="true" /> Favoritos
            {favoriteViews.length > 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">({favoriteViews.length})</span>}
          </h2>
          <div
            onDragOver={editMode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOverFavorites(true); } : undefined}
            onDragLeave={editMode ? () => setDragOverFavorites(false) : undefined}
            onDrop={editMode ? handleDropFavorites : undefined}
            className={cn(
              editMode && "rounded-2xl border-2 border-dashed p-2.5 transition-colors",
              editMode && (dragOverFavorites ? "border-brand-400 bg-brand-50/60 dark:bg-brand-950/40" : "border-slate-200 dark:border-slate-700"),
            )}
          >
            {favoriteViews.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
                Arrastrá módulos acá o marcá su estrella.
              </p>
            ) : (
              <div className={gridClass}>
                {favoriteViews.map((v) => (
                  <ModuleTile
                    key={`fav-${v.key}`}
                    view={v}
                    editMode={editMode}
                    isFavorite
                    onToggleFavorite={removeFavorite}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Módulos por sección */}
      {filteredGroups.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<Search />}
            title="No hay módulos que coincidan"
            description={`No encontramos módulos para "${query}". Probá con otra palabra o usá el buscador global (Ctrl K) para buscar acciones.`}
            action={<button className="btn btn-secondary btn-sm" onClick={() => setQuery("")}>Limpiar búsqueda</button>}
          />
        </div>
      ) : (
        filteredGroups.map(({ section, views: sectionViews }) => (
          <section key={section.key} aria-labelledby={`home-sec-${section.key}`}>
            <h2 id={`home-sec-${section.key}`} className="eyebrow mb-2.5">
              {section.label}
            </h2>
            <div className={gridClass}>
              {sectionViews.map((v) => (
                <ModuleTile
                  key={v.key}
                  view={v}
                  editMode={editMode}
                  onDragStart={handleDragStart}
                  isFavorite={favorites.includes(v.key)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {userData && <TechAssistantChat user={userData} />}
    </div>
  );
}

// ── Mosaico de módulo ─────────────────────────────────────────────

function ModuleTile({
  view,
  editMode,
  onDragStart,
  isFavorite = false,
  onToggleFavorite,
}: {
  view: ViewConfig;
  editMode: boolean;
  onDragStart?: (e: React.DragEvent, key: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (key: string) => void;
}) {
  const body = (
    <>
      {editMode && (
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 hidden sm:block" aria-hidden="true" />
      )}
      <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700 dark:group-hover:bg-brand-950 dark:group-hover:text-brand-200">
        {renderIcon(view.iconName, "w-[18px] h-[18px]")}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
          {view.label}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {view.description}
        </span>
      </span>
    </>
  );

  const tileClass =
    "group relative flex items-center gap-3 h-[60px] pl-3 pr-2 rounded-xl border border-border bg-card hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-[border-color,box-shadow] duration-150";

  if (editMode) {
    return (
      <div
        draggable={!!onDragStart}
        onDragStart={(e) => onDragStart && onDragStart(e, view.key)}
        className={cn(tileClass, "cursor-grab active:cursor-grabbing")}
      >
        {body}
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(view.key)}
            className={cn(
              "btn btn-ghost btn-icon btn-sm btn-icon-inline shrink-0",
              isFavorite && "text-warning-600 hover:text-warning-700 dark:text-warning-400",
            )}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Quitar ${view.label} de favoritos` : `Agregar ${view.label} a favoritos`}
          >
            <Star className={cn(isFavorite && "fill-current")} />
          </button>
        )}
      </div>
    );
  }

  return (
    <Link href={view.key} className={tileClass}>
      {body}
    </Link>
  );
}
