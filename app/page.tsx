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
    History as HistoryIcon
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [userData, setUserData] = useState<any>(null);

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
    }, [router]);

    const role = userRole?.trim().toLowerCase() || 'operador';
    const isOperador = role === 'operador';
    const isVendedor = role === 'vendedor';
    const isSupervisor = role === 'supervisor';
    const isAdmin = role === 'admin';
    const isSupervisorOrAdmin = isSupervisor || isAdmin;

    if (!userRole) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                        <Home className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Hola, {userName.split(' ')[0]}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight uppercase tracking-widest text-[10px] font-black">{role}</p>
                </div>
            </div>

            {/* Operador */}
            {isOperador && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Tus Acciones Rápidas</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        <ActionCard
                            title="Fichado GPS/QR"
                            description="Iniciar/Finalizar jornada"
                            icon={<MapPin className="w-6 h-6" />}
                            href="/fichado"
                            color="bg-emerald-500"
                        />
                        <ActionCard
                            title="Registro de Tiempos"
                            description="Tus horas trabajadas"
                            icon={<Clock className="w-6 h-6" />}
                            href="/timesheets"
                            color="bg-primary"
                        />
                        <ActionCard
                            title="Mis Proyectos"
                            description="Proyectos a tu cargo"
                            icon={<Briefcase className="w-6 h-6" />}
                            href="/my-projects"
                            color="bg-indigo-500"
                        />
                        <ActionCard
                            title="Demoras del Cliente"
                            description="Registro de inconvenientes"
                            icon={<AlertTriangle className="w-6 h-6" />}
                            href="/delays"
                            color="bg-amber-500"
                        />
                        <ActionCard
                            title="Notificaciones"
                            description="Novedades y alertas"
                            icon={<Bell className="w-6 h-6" />}
                            href="/notifications"
                            color="bg-rose-500"
                        />
                    </div>
                </div>
            )}

            {/* Vendedor */}
            {isVendedor && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Panel de Ventas</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        <ActionCard
                            title="Provisión de Materiales"
                            description="Gestión de suministros"
                            icon={<Package className="w-6 h-6" />}
                            href="/provision-materiales"
                            color="bg-orange-500"
                        />
                        <ActionCard
                            title="Gestión de Clientes"
                            description="Base de datos de clientes"
                            icon={<Activity className="w-6 h-6" />}
                            href="/clients"
                            color="bg-indigo-500"
                        />
                        <ActionCard
                            title="Notificaciones"
                            description="Novedades y alertas"
                            icon={<Bell className="w-6 h-6" />}
                            href="/notifications"
                            color="bg-rose-500"
                        />
                        <ActionCard
                            title="Mi Usuario"
                            description="Perfil de Ventas"
                            icon={<UserIcon className="w-6 h-6" />}
                            href="/operators"
                            color="bg-slate-700"
                        />
                    </div>
                </div>
            )}

            {/* Supervisor y Admin */}
            {isSupervisorOrAdmin && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">
                        {isAdmin ? 'Panel de Administración' : 'Panel de Supervisión'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3 md:gap-4">
                        <ActionCard
                            title="Aprobaciones"
                            description="Validar fichadas de riesgo"
                            icon={<ClipboardCheck className="w-6 h-6" />}
                            href="/aprobaciones"
                            color="bg-teal-600"
                        />
                        <ActionCard
                            title="Fichado GPS/QR"
                            description="Control de asistencia"
                            icon={<MapPin className="w-6 h-6" />}
                            href="/fichado"
                            color="bg-emerald-500"
                        />
                        <ActionCard
                            title="Panel de Análisis"
                            description="Métricas globales"
                            icon={<BarChart3 className="w-6 h-6" />}
                            href="/dashboard"
                            color="bg-cyan-600"
                        />
                        <ActionCard
                            title="Planificación"
                            description="Agenda y cronograma"
                            icon={<CalendarCheck className="w-6 h-6" />}
                            href="/planning"
                            color="bg-violet-600"
                        />
                        <ActionCard
                            title="Gestión de Proyectos"
                            description="Proyectos activos"
                            icon={<Briefcase className="w-6 h-6" />}
                            href="/projects"
                            color="bg-indigo-500"
                        />
                        <ActionCard
                            title="Órdenes de Servicio"
                            description="Gestión y firmas"
                            icon={<FileSignature className="w-6 h-6" />}
                            href="/ordenes-servicio"
                            color="bg-blue-600"
                        />
                        <ActionCard
                            title="Provisión de Materiales"
                            description="Control de suministros"
                            icon={<Package className="w-6 h-6" />}
                            href="/provision-materiales"
                            color="bg-orange-500"
                        />
                        <ActionCard
                            title="Notificaciones"
                            description="Novedades y alertas"
                            icon={<Bell className="w-6 h-6" />}
                            href="/notifications"
                            color="bg-rose-500"
                        />
                        <ActionCard
                            title="Gestión de Usuarios"
                            description="Operadores y permisos"
                            icon={<UserIcon className="w-6 h-6" />}
                            href="/operators"
                            color="bg-slate-700"
                        />
                        {isAdmin && (
                            <>
                                <ActionCard
                                    title="Registro Auditoría"
                                    description="Trazabilidad total"
                                    icon={<HistoryIcon className="w-6 h-6" />}
                                    href="/auditoria"
                                    color="bg-slate-900"
                                />
                                <ActionCard
                                    title="Configuración"
                                    description="Ajustes de sistema"
                                    icon={<Settings className="w-6 h-6" />}
                                    href="/configuracion"
                                    color="bg-slate-400"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ActionCard({ title, description, icon, href, color }: { title: string, description: string, icon: React.ReactNode, href: string, color: string }) {
    return (
        <Link href={href} className="group relative block focus:outline-none">
            <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 transition-all duration-300 flex flex-row items-center gap-3 md:gap-4 h-full outline-primary focus-visible:ring-4 focus-visible:ring-primary/20 overflow-hidden">
                <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1 space-y-0.5 md:space-y-1 min-w-0">
                    <h4 className="font-extrabold text-slate-800 text-base md:text-lg leading-tight group-hover:text-primary transition-colors">{title}</h4>
                    <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider line-clamp-2">{description}</p>
                </div>
            </div>
        </Link>
    );
}
