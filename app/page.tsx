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
    Home
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                setUserRole(user.role?.toLowerCase() || 'operador');
                setUserName(user.nombreCompleto || 'Usuario');
            } catch (e) {
                // Ignore
            }
        }
    }, [router]);

    const isSupervisorOrAdmin = userRole === 'supervisor' || userRole === 'admin';

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
                    <p className="text-sm text-slate-500 font-medium">¿Qué te gustaría hacer hoy?</p>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Tus Acciones Rápidas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    <ActionCard
                        title="Cargar Horario"
                        description="Registra tus horas del día"
                        icon={<Clock className="w-6 h-6" />}
                        href="/timesheets"
                        color="bg-primary"
                    />
                    <ActionCard
                        title="Proyectos Asignados"
                        description="Revisa tus proyectos actuales"
                        icon={<Briefcase className="w-6 h-6" />}
                        href="/my-projects"
                        color="bg-indigo-500"
                    />
                    <ActionCard
                        title="Registrar Actividad"
                        description="Informa avances y tareas"
                        icon={<ClipboardCheck className="w-6 h-6" />}
                        href="/my-projects"
                        color="bg-emerald-500"
                    />
                </div>
            </div>

            {isSupervisorOrAdmin && (
                <div className="space-y-6 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Gestión y Supervisión</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <ActionCard
                            title="Métricas Generales"
                            description="Panel de análisis global"
                            icon={<BarChart3 className="w-6 h-6" />}
                            href="/dashboard"
                            color="bg-primary"
                        />
                        <ActionCard
                            title="Proyectos en Curso"
                            description="Ver todos los activos"
                            icon={<Activity className="w-6 h-6" />}
                            href="/projects?status=activo"
                            color="bg-emerald-500"
                        />
                        <ActionCard
                            title="Con Retraso"
                            description="Proyectos críticos"
                            icon={<AlertTriangle className="w-6 h-6" />}
                            href="/projects?status=atrasado"
                            color="bg-rose-500"
                        />
                        <ActionCard
                            title="Configuración"
                            description="Gestión estructural del sistema"
                            icon={<Settings className="w-6 h-6" />}
                            href="/configuracion"
                            color="bg-slate-700"
                        />
                        <ActionCard
                            title="Planificación"
                            description="Planificación diaria"
                            icon={<CalendarCheck className="w-6 h-6" />}
                            href="/planning"
                            color="bg-cyan-500"
                        />
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
