'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Home, ChevronDown, ChevronUp, Pencil, X, Star, Clock as ClockIcon, GripVertical, Trash2, Briefcase, Activity, AlertTriangle, ShieldAlert, Calendar } from 'lucide-react';
import Link from 'next/link';
import {
    ViewConfig, isViewAllowed, DEFAULT_VIEWS, DEFAULT_SECTIONS,
    groupViewsBySection, getViewConfig
} from '@/lib/viewAccess';
import { renderIcon } from '@/lib/iconRegistry';
import {
    getRecentViews, getFavorites, setFavorites as saveFavorites,
    getHomePrefs, setHomePrefs, HomePrefs
} from '@/lib/viewPreferences';
import TechAssistantChat from '@/components/TechAssistantChat';

export default function HomePage() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [userData, setUserData] = useState<any>(null);
    const [userId, setUserId] = useState<string>('default');

    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('cachedViewConfig');
            if (cached) {
                try { return getViewConfig(JSON.parse(cached)); } catch { return null; }
            }
        }
        return null;
    });

    
    const [editMode, setEditMode] = useState(false);
    const [favorites, setFavoritesLocal] = useState<string[]>([]);
    const [recentKeys, setRecentKeys] = useState<string[]>([]);
    const [prefs, setPrefs] = useState<HomePrefs>({ showRecents: true, showFavorites: true });
    const [recentsExpanded, setRecentsExpanded] = useState(false);
    const [dragOverFavorites, setDragOverFavorites] = useState(false);

    
    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                setUserData(user);
                setUserRole(user.role?.toLowerCase() || 'operador');
                setUserName(user.nombreCompleto || 'Usuario');
                const uid = user.legajo || 'default';
                setUserId(uid);
                setFavoritesLocal(getFavorites(uid));
                setRecentKeys(getRecentViews(uid));
                setPrefs(getHomePrefs(uid));
            } catch (e) {
                // Ignore
            }
        }

        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setViewConfig(data);
                    localStorage.setItem('cachedViewConfig', JSON.stringify(data));
                }
            })
            .catch(() => {});
    }, [router]);

    const role = userRole?.trim().toLowerCase() || 'operador';
    const effectiveViews = viewConfig && viewConfig.length > 0 ? viewConfig : DEFAULT_VIEWS;
    const show = (key: string) => isViewAllowed(key, role, 'home', effectiveViews);

    // Get view by key
    const getView = (key: string) => effectiveViews.find(v => v.key === key);

    // Favorites management
    const addFavorite = useCallback((key: string) => {
        setFavoritesLocal(prev => {
            if (prev.includes(key)) return prev;
            const next = [...prev, key];
            saveFavorites(userId, next);
            return next;
        });
    }, [userId]);

    const removeFavorite = useCallback((key: string) => {
        setFavoritesLocal(prev => {
            const next = prev.filter(k => k !== key);
            saveFavorites(userId, next);
            return next;
        });
    }, [userId]);

    const togglePref = useCallback((key: keyof HomePrefs) => {
        setPrefs(prev => {
            const next = { ...prev, [key]: !prev[key] };
            setHomePrefs(userId, next);
            return next;
        });
    }, [userId]);

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, viewKey: string) => {
        e.dataTransfer.setData('text/plain', viewKey);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOverFavorites = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverFavorites(true);
    };

    const handleDragLeaveFavorites = () => {
        setDragOverFavorites(false);
    };

    const handleDropFavorites = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverFavorites(false);
        const key = e.dataTransfer.getData('text/plain');
        if (key) addFavorite(key);
    };

    const gridClass = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 transition-all duration-300";

    if (!userRole) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    // Build section groups
    const grouped = groupViewsBySection(effectiveViews, role, 'home');

    // Recents
    const recentViews = recentKeys
        .map(key => getView(key))
        .filter((v): v is ViewConfig => !!v && show(v.key));

    // Favorites
    const favoriteViews = favorites
        .map(key => getView(key))
        .filter((v): v is ViewConfig => !!v && show(v.key));

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header with controls */}
            <div className="flex flex-row justify-between items-center gap-2 md:gap-4 w-full">
                <div className="space-y-0.5 min-w-0">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-1.5 sm:gap-2 md:gap-3 truncate">
                        <Home className="w-5 h-5 sm:w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
                        <span className="truncate">Hola, {userName.split(' ')[0]}</span>
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase tracking-widest font-black leading-none">{role}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Edit mode toggle */}
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`p-2 rounded-xl transition-all duration-300 active:scale-95 ${
                            editMode
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 hover:text-primary border border-slate-200 dark:border-slate-800'
                        }`}
                        title="Personalizar inicio"
                    >
                        {editMode ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Executive KPIs Zone (Dashboard Ejecutivo Evolutivo) */}
            {role !== 'operador' && !editMode && (
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ExecutiveKpi title="Proyectos Activos" value="-" icon={<Briefcase className="w-4 h-4" />} color="bg-indigo-600" />
                    <ExecutiveKpi title="Órdenes Abiertas" value="-" icon={<Activity className="w-4 h-4" />} color="bg-blue-500" />
                    <ExecutiveKpi title="SLA Próximos" value="-" icon={<AlertTriangle className="w-4 h-4" />} color="bg-amber-500" />
                    <ExecutiveKpi title="SLA Vencidos" value="-" icon={<AlertTriangle className="w-4 h-4" />} color="bg-rose-500" />
                    <ExecutiveKpi title="NC Abiertas" value="-" icon={<ShieldAlert className="w-4 h-4" />} color="bg-slate-700" className="hidden xl:flex" />
                    <ExecutiveKpi title="Auditorías Prog." value="-" icon={<Calendar className="w-4 h-4" />} color="bg-emerald-500" className="hidden xl:flex" />
                </div>
            )}

            {/* Edit mode controls */}
            {editMode && (
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-black text-primary uppercase tracking-widest">Personalizar Inicio</p>
                    <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={prefs.showRecents}
                                onChange={() => togglePref('showRecents')}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                <ClockIcon className="w-3.5 h-3.5" /> Recientes
                            </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={prefs.showFavorites}
                                onChange={() => togglePref('showFavorites')}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5" /> Favoritos
                            </span>
                        </label>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        Arrastrá las tarjetas a la sección de Favoritos para agregarlas.
                    </p>
                </div>
            )}

            {/* Recents section — collapsible */}
            {prefs.showRecents && recentViews.length > 0 && (
                <div className="space-y-2">
                    <button
                        onClick={() => setRecentsExpanded(!recentsExpanded)}
                        className="flex items-center gap-2 text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 hover:text-primary transition-colors group w-full text-left"
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span>Recientes</span>
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-md">{recentViews.length}</span>
                        {recentsExpanded
                            ? <ChevronUp className="w-4 h-4 ml-auto" />
                            : <ChevronDown className="w-4 h-4 ml-auto" />
                        }
                    </button>
                    {recentsExpanded && (
                        <div className={`${gridClass} animate-in fade-in slide-in-from-top-2 duration-300`}>
                            {recentViews.map(v => (
                                <ActionCard
                                    key={`recent-${v.key}`}
                                    view={v}
                                    editMode={editMode}
                                    onDragStart={handleDragStart}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Favorites section */}
            {prefs.showFavorites && (
                <div className="space-y-2">
                    {(favoriteViews.length > 0 || editMode) && (
                        <>
                            <div className="flex items-center gap-2 px-1">
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                <span className="text-sm font-black text-amber-500 uppercase tracking-widest">Favoritos</span>
                                {favoriteViews.length > 0 && (
                                    <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md">{favoriteViews.length}</span>
                                )}
                            </div>

                            {editMode && (
                                <div
                                    onDragOver={handleDragOverFavorites}
                                    onDragLeave={handleDragLeaveFavorites}
                                    onDrop={handleDropFavorites}
                                    className={`min-h-[80px] rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                                        dragOverFavorites
                                            ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-500/5 scale-[1.01]'
                                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                                    } ${favoriteViews.length > 0 ? 'p-3' : 'p-6'}`}
                                >
                                    {favoriteViews.length === 0 ? (
                                        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium text-center">
                                            Arrastrá tarjetas aquí para agregarlas a favoritos
                                        </p>
                                    ) : (
                                        <div className={`${gridClass} w-full`}>
                                            {favoriteViews.map(v => (
                                                <div key={`fav-${v.key}`} className="relative group/fav">
                                                    <ActionCard
                                                        view={v}
                                                        editMode={false}
                                                        onDragStart={handleDragStart}
                                                    />
                                                    <button
                                                        onClick={() => removeFavorite(v.key)}
                                                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover/fav:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!editMode && favoriteViews.length > 0 && (
                                <div className={gridClass}>
                                    {favoriteViews.map(v => (
                                        <ActionCard
                                            key={`fav-${v.key}`}
                                            view={v}
                                            editMode={false}
                                            onDragStart={handleDragStart}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Section groups — dynamically from config */}
            {grouped.map(({ section, views: sectionViews }) => (
                <div key={section.key} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 animate-in fade-in duration-300">
                        {section.label}
                    </h3>
                    <div className={gridClass}>
                        {sectionViews.map(v => (
                            <ActionCard
                                key={v.key}
                                view={v}
                                editMode={editMode}
                                onDragStart={handleDragStart}
                            />
                        ))}
                    </div>
                </div>
            ))}
            
            {userData && (
                <TechAssistantChat user={userData} />
            )}
        </div>
    );
}

// ── ActionCard ─────────────────────────────────────────────────────

function ActionCard({ view, editMode, onDragStart }: {
    view: ViewConfig;
    editMode: boolean;
    onDragStart: (e: React.DragEvent, key: string) => void;
}) {
    let containerClass = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-[1px] hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 flex flex-row items-center h-[72px] p-3 rounded-xl gap-3 outline-primary focus-visible:ring-2 focus-visible:ring-primary/20 overflow-hidden group";
    let iconWrapperClass = `${view.color} text-white shadow-sm shrink-0 p-2 rounded-lg flex items-center justify-center`;
    let titleClass = "font-bold text-[13px] text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors";
    let descClass = "font-medium text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide line-clamp-2 mt-0.5 leading-tight";
    let textContainerClass = "flex-1 min-w-0";

    if (editMode) {
        containerClass += " cursor-grab active:cursor-grabbing ring-2 ring-transparent hover:ring-primary/30";
    }

    const card = (
        <div className={containerClass}>
            {editMode && (
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
            )}
            <div className={iconWrapperClass}>
                {renderIcon(view.iconName, 'w-5 h-5')}
            </div>
            <div className={textContainerClass}>
                <h4 className={titleClass}>{view.label}</h4>
                <p className={descClass}>{view.description}</p>
            </div>
        </div>
    );

    if (editMode) {
        return (
            <div
                draggable
                onDragStart={(e) => onDragStart(e, view.key)}
                className="relative block focus:outline-none"
            >
                {card}
            </div>
        );
    }

    return (
        <Link href={view.key} className="relative block focus:outline-none">
            {card}
        </Link>
    );
}

function ExecutiveKpi({ title, value, icon, color, className = '' }: { title: string, value: string, icon: any, color: string, className?: string }) {
    return (
        <div className={`bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between h-[64px] gap-3 ${className}`}>
            <div className="flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest line-clamp-1">{title}</p>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter truncate leading-none mt-0.5">{value}</h4>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color} text-white shadow-sm opacity-90`}>
                {icon}
            </div>
        </div>
    );
}
