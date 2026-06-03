'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Clock,
    Briefcase,
    ClipboardCheck,
    TrendingUp,
    Bell,
    CalendarCheck,
    BarChart3,
    Activity,
    AlertTriangle,
    Settings,
    Home,
    Package,
    MapPin,
    User as UserIcon,
    FileSignature,
    History as HistoryIcon,
    Wrench,
    ShieldCheck,
    Bot,
    BookOpen,
    FileCheck
} from 'lucide-react';
import Link from 'next/link';
import { ViewConfig, isViewAllowed } from '@/lib/viewAccess';
import TechAssistantChat from '@/components/TechAssistantChat';

export default function HomePage() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [userData, setUserData] = useState<any>(null);

    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('cachedViewConfig');
            if (cached) {
                try { return JSON.parse(cached); } catch { return null; }
            }
        }
        return null;
    });

    const [cardScale, setCardScale] = useState<'0.5' | '1' | '2'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('hdb_card_scale');
            if (saved === '0.5' || saved === '1' || saved === '2') return saved;
        }
        return '1';
    });

    useEffect(() => {
        localStorage.setItem('hdb_card_scale', cardScale);
    }, [cardScale]);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                setUserData(user);
                setUserRole(user.role?.toLowerCase() || 'operador');
                setUserName(user.nombreCompleto || 'Usuario');
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

    const show = (href: string) => isViewAllowed(href, role, 'home', viewConfig);

    const getGridClass = (scale: '0.5' | '1' | '2') => {
        if (scale === '0.5') {
            return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 transition-all duration-300";
        } else if (scale === '2') {
            return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 transition-all duration-300";
        } else {
            return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 transition-all duration-300";
        }
    };

    if (!userRole) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const hasOperaciones = show('/fichado') || show('/timesheets') || show('/herramientas') || show('/my-projects') || show('/delays');
    const hasGestion = show('/aprobaciones') || show('/planning') || show('/projects') || show('/ordenes-servicio') || show('/provision-materiales') || show('/clients');
    const hasCalidad = show('/calidad') || show('/capacitacion') || show('/auditoria-ia') || show('/gestion-sugerencias');
    const hasAdmin = show('/dashboard') || show('/operators') || show('/auditoria') || show('/configuracion') || show('/notifications');

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-row justify-between items-center gap-2 md:gap-4 w-full">
                <div className="space-y-0.5 min-w-0">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-1.5 sm:gap-2 md:gap-3 truncate">
                        <Home className="w-5 h-5 sm:w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
                        <span className="truncate">Hola, {userName.split(' ')[0]}</span>
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase tracking-widest font-black leading-none">{role}</p>
                </div>

                {/* Selector de tamaño premium - compacto y a la misma altura en mobile */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner shrink-0 gap-0.5 self-center">
                    {(['0.5', '1', '2'] as const).map((s) => {
                        const isActive = cardScale === s;
                        return (
                            <button
                                key={s}
                                onClick={() => setCardScale(s)}
                                className={`
                                    w-8 h-6 sm:w-11 sm:h-7 flex items-center justify-center text-[10px] sm:text-xs font-black tracking-wider transition-all duration-300 active:scale-95 rounded-md sm:rounded-lg btn-icon-inline !min-h-0
                                    ${isActive
                                        ? 'bg-primary text-white shadow-sm shadow-primary/20 scale-105 border border-primary/10 -translate-y-[0.5px] sm:-translate-y-[1px] font-black'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-extrabold'
                                    }
                                `}
                            >
                                x{s}
                            </button>
                        );
                    })}
                </div>
            </div>

            {hasOperaciones && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 animate-in fade-in duration-300">Operaciones</h3>
                    <div className={getGridClass(cardScale)}>
                        {show('/fichado') && <ActionCard
                            title="Fichado GPS/QR"
                            description="Iniciar/Finalizar jornada"
                            icon={<MapPin className="w-6 h-6" />}
                            href="/fichado"
                            color="bg-emerald-500"
                            scale={cardScale}
                        />}
                        {show('/timesheets') && <ActionCard
                            title="Registro de Tiempos"
                            description="Tus horas trabajadas"
                            icon={<Clock className="w-6 h-6" />}
                            href="/timesheets"
                            color="bg-primary"
                            scale={cardScale}
                        />}
                        {show('/herramientas') && <ActionCard
                            title="Herramientas y Carros"
                            description="Retiro, devolución y verificación"
                            icon={<Wrench className="w-6 h-6" />}
                            href="/herramientas?tab=retiros"
                            color="bg-slate-600"
                            scale={cardScale}
                        />}
                        {show('/my-projects') && <ActionCard
                            title="Mis Proyectos"
                            description="Proyectos a tu cargo"
                            icon={<Briefcase className="w-6 h-6" />}
                            href="/my-projects"
                            color="bg-indigo-500"
                            scale={cardScale}
                        />}
                        {show('/delays') && <ActionCard
                            title="Demoras del Cliente"
                            description="Registro de inconvenientes"
                            icon={<AlertTriangle className="w-6 h-6" />}
                            href="/delays"
                            color="bg-amber-500"
                            scale={cardScale}
                        />}
                    </div>
                </div>
            )}

            {hasGestion && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 animate-in fade-in duration-300">Gestión y Seguimiento</h3>
                    <div className={getGridClass(cardScale)}>
                        {show('/aprobaciones') && <ActionCard
                            title="Aprobaciones"
                            description="Validar fichadas de riesgo"
                            icon={<ClipboardCheck className="w-6 h-6" />}
                            href="/aprobaciones"
                            color="bg-teal-600"
                            scale={cardScale}
                        />}
                        {show('/planning') && <ActionCard
                            title="Planificación"
                            description="Agenda y cronograma"
                            icon={<CalendarCheck className="w-6 h-6" />}
                            href="/planning"
                            color="bg-violet-600"
                            scale={cardScale}
                        />}
                        {show('/projects') && <ActionCard
                            title="Gestión de Proyectos"
                            description="Proyectos activos"
                            icon={<Briefcase className="w-6 h-6" />}
                            href="/projects"
                            color="bg-indigo-500"
                            scale={cardScale}
                        />}
                        {show('/ordenes-servicio') && <ActionCard
                            title="Órdenes de Servicio"
                            description="Gestión y firmas"
                            icon={<FileSignature className="w-6 h-6" />}
                            href="/ordenes-servicio"
                            color="bg-blue-600"
                            scale={cardScale}
                        />}
                        {show('/provision-materiales') && <ActionCard
                            title="Provisión de Materiales"
                            description="Gestión de suministros"
                            icon={<Package className="w-6 h-6" />}
                            href="/provision-materiales"
                            color="bg-orange-500"
                            scale={cardScale}
                        />}
                        {show('/clients') && <ActionCard
                            title="Gestión de Clientes"
                            description="Base de datos de clientes"
                            icon={<Activity className="w-6 h-6" />}
                            href="/clients"
                            color="bg-indigo-500"
                            scale={cardScale}
                        />}
                    </div>
                </div>
            )}

            {hasCalidad && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 animate-in fade-in duration-300">Calidad</h3>
                    <div className={getGridClass(cardScale)}>
                        {show('/calidad') && <ActionCard
                            title="Calidad y QMS"
                            description="Gestión documental ISO"
                            icon={<FileCheck className="w-6 h-6" />}
                            href="/calidad"
                            color="bg-emerald-600"
                            scale={cardScale}
                        />}
                        {show('/capacitacion') && <ActionCard
                            title="Formación Integral"
                            description="Capacitación y competencias"
                            icon={<BookOpen className="w-6 h-6" />}
                            href="/capacitacion"
                            color="bg-sky-600"
                            scale={cardScale}
                        />}
                        {show('/auditoria-ia') && <ActionCard
                            title="Auditoría de IA"
                            description="Validación inteligente"
                            icon={<Bot className="w-6 h-6" />}
                            href="/auditoria-ia"
                            color="bg-fuchsia-600"
                            scale={cardScale}
                        />}
                    </div>
                </div>
            )}

            {hasAdmin && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 animate-in fade-in duration-300">Administración</h3>
                    <div className={getGridClass(cardScale)}>
                        {show('/dashboard') && <ActionCard
                            title="Panel de Análisis"
                            description="Métricas globales"
                            icon={<BarChart3 className="w-6 h-6" />}
                            href="/dashboard"
                            color="bg-cyan-600"
                            scale={cardScale}
                        />}
                        {show('/operators') && <ActionCard
                            title="Gestión de Usuarios"
                            description="Operadores y permisos"
                            icon={<UserIcon className="w-6 h-6" />}
                            href="/operators"
                            color="bg-slate-700"
                            scale={cardScale}
                        />}
                        {show('/auditoria') && <ActionCard
                            title="Registro Auditoría"
                            description="Trazabilidad total"
                            icon={<HistoryIcon className="w-6 h-6" />}
                            href="/auditoria"
                            color="bg-slate-900"
                            scale={cardScale}
                        />}
                        {show('/configuracion') && <ActionCard
                            title="Configuración"
                            description="Ajustes de sistema"
                            icon={<Settings className="w-6 h-6" />}
                            href="/configuracion"
                            color="bg-slate-400"
                            scale={cardScale}
                        />}
                        {show('/notifications') && <ActionCard
                            title="Notificaciones"
                            description="Novedades y alertas"
                            icon={<Bell className="w-6 h-6" />}
                            href="/notifications"
                            color="bg-rose-500"
                            scale={cardScale}
                        />}
                    </div>
                </div>
            )}
            
            {userData && (
                <TechAssistantChat user={userData} />
            )}
        </div>
    );
}

function ActionCard({ title, description, icon, href, color, scale }: { title: string, description: string, icon: React.ReactNode, href: string, color: string, scale: '0.5' | '1' | '2' }) {
    // Styling variables based on scale
    let containerClass = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 flex flex-row items-center h-full outline-primary focus-visible:ring-4 focus-visible:ring-primary/20 overflow-hidden";
    let iconWrapperClass = `${color} text-white shadow-lg group-hover:scale-110 transition-transform shrink-0`;
    let titleClass = "font-extrabold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors";
    let descClass = "font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider line-clamp-2";
    let textContainerClass = "flex-1 min-w-0";

    if (scale === '0.5') {
        containerClass += " p-2.5 md:p-3 rounded-xl md:rounded-2xl gap-2 md:gap-2.5";
        iconWrapperClass += " p-1.5 md:p-2 rounded-lg md:rounded-xl [&_svg]:w-4 [&_svg]:h-4 md:[&_svg]:w-4.5 md:[&_svg]:h-4.5";
        titleClass += " text-xs md:text-sm";
        descClass += " text-[8px] md:text-[9px]";
        textContainerClass += " space-y-0";
    } else if (scale === '2') {
        containerClass += " p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] gap-4 md:gap-6";
        iconWrapperClass += " p-4 md:p-5 rounded-2xl md:rounded-3xl [&_svg]:w-8 [&_svg]:h-8 md:[&_svg]:w-9 md:[&_svg]:h-9";
        titleClass += " text-lg md:text-xl";
        descClass += " text-xs md:text-sm";
        textContainerClass += " space-y-1.5 md:space-y-2";
    } else {
        // scale === '1' (default)
        containerClass += " p-4 md:p-6 rounded-2xl md:rounded-[2rem] gap-3 md:gap-4";
        iconWrapperClass += " p-3 md:p-4 rounded-xl md:rounded-2xl [&_svg]:w-6 [&_svg]:h-6";
        titleClass += " text-base md:text-lg";
        descClass += " text-[10px] md:text-xs";
        textContainerClass += " space-y-0.5 md:space-y-1";
    }

    return (
        <Link href={href} className="group relative block focus:outline-none">
            <div className={containerClass}>
                <div className={iconWrapperClass}>
                    {icon}
                </div>
                <div className={textContainerClass}>
                    <h4 className={titleClass}>{title}</h4>
                    <p className={descClass}>{description}</p>
                </div>
            </div>
        </Link>
    );
}
