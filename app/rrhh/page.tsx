import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ModuleHeader from '@/components/ModuleHeader';
import { 
    Users, 
    Briefcase, 
    ShieldCheck, 
    UserCheck, 
    AlertTriangle, 
    CheckCircle2, 
    ChevronRight, 
    Package, 
    Activity,
    Layers
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RRHHHubPage() {
    // Obtenemos estadísticas clave de ambos módulos
    let openVacancies = 0;
    let totalCandidates = 0;
    let totalOperators = 0;
    let eppGlobalesCount = 0;
    let eppVencidosCount = 0;
    let eppPendientesFirma = 0;

    try {
        const [vacancies, candidates, operators, eppGlobales, pendingDeliveries] = await Promise.all([
            prisma.recruitmentVacancy.count({ where: { status: 'ABIERTA' } }),
            prisma.candidate.count(),
            prisma.operator.count({ where: { activo: true } }),
            prisma.eppItem.count({ where: { esGlobal: true, activo: true } }),
            prisma.eppDelivery.count({ where: { estado: 'PENDIENTE_FIRMA' } })
        ]);

        openVacancies = vacancies;
        totalCandidates = candidates;
        totalOperators = operators;
        eppGlobalesCount = eppGlobales;
        eppPendientesFirma = pendingDeliveries;

        // EPP vencidos
        const now = new Date();
        const expiredItems = await prisma.eppDeliveryItem.count({
            where: {
                estado: 'VIGENTE',
                fechaVencimiento: { lt: now }
            }
        });
        eppVencidosCount = expiredItems;
    } catch (e) {
        console.error("Error fetching RRHH stats", e);
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-8 animate-in fade-in duration-300">
            <ModuleHeader
                title="Recursos Humanos & Capital Humano"
                description="Portal integral de atracción de talentos y administración del equipo operativo"
                icon={<Users className="w-6 h-6 text-indigo-500" />}
            />

            {/* Banner superior de estado */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Equipo Operativo</p>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalOperators}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Operarios activos</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
                        <UserCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Búsquedas Activas</p>
                        <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{openVacancies}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">{totalCandidates} postulantes en base</p>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                        <Briefcase className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">EPP Globales</p>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">{eppGlobalesCount}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Items de asignación general</p>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Atención EPP</p>
                        <h3 className={`text-3xl font-black mt-1 ${eppVencidosCount > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                            {eppVencidosCount + eppPendientesFirma}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {eppVencidosCount} vencidos · {eppPendientesFirma} p/firmar
                        </p>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Los Dos Pilares Principales de RRHH */}
            <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-500" />
                    Módulos de Recursos Humanos
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pilar 1: Reclutamiento y Selección */}
                    <Link
                        href="/rrhh/reclutamiento"
                        className="group bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Briefcase className="w-40 h-40 text-indigo-600" />
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
                                <Briefcase className="w-3.5 h-3.5" />
                                Módulo ATS
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                Reclutamiento y Base de Talentos
                            </h3>

                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-md">
                                Publicación y seguimiento de vacantes, base de postulantes calificados, pipeline interactivo de entrevistas y contratación de nuevos colaboradores.
                            </p>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                    <span className="text-xs text-slate-500 font-medium">Vacantes Abiertas</span>
                                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{openVacancies}</p>
                                </div>
                                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                    <span className="text-xs text-slate-500 font-medium">Postulantes</span>
                                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{totalCandidates}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                            <span>Ingresar a Reclutamiento</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                        </div>
                    </Link>

                    {/* Pilar 2: Gestión de Personal Operativo */}
                    <Link
                        href="/rrhh/personal"
                        className="group bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldCheck className="w-40 h-40 text-emerald-600" />
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                                <UserCheck className="w-3.5 h-3.5" />
                                Equipo & Operaciones
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                Gestión de Personal Operativo
                            </h3>

                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-md">
                                Administración del equipo en campo, dotación de Elementos de Protección Personal (EPP), control de vencimientos, stock de pañol y firmas digitales con validez ISO.
                            </p>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                    <span className="text-xs text-slate-500 font-medium">Elementos EPP</span>
                                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{eppGlobalesCount} Globales</p>
                                </div>
                                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                    <span className="text-xs text-slate-500 font-medium">Operarios Activos</span>
                                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{totalOperators}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                            <span>Ingresar a Gestión de Personal (EPP)</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                        </div>
                    </Link>
                </div>
            </div>

            {/* Accesos Rápidos de EPP */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                    <div>
                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            Acceso Directo a EPP (Higiene y Seguridad)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Matriz de asignación global, control de stock y actas de entrega
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/rrhh/personal/epp"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Abrir Matriz de EPP
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <Link
                        href="/rrhh/personal/epp?tab=matriz"
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center gap-3 hover:border-emerald-500 transition-colors"
                    >
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block text-xs">Matriz de Operadores</span>
                            <span className="text-[11px] text-slate-400">Ver quién tiene EPP vigente</span>
                        </div>
                    </Link>

                    <Link
                        href="/rrhh/personal/epp?tab=stock"
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center gap-3 hover:border-emerald-500 transition-colors"
                    >
                        <div className="p-2 bg-amber-100 dark:bg-amber-950/50 text-amber-600 rounded-lg">
                            <Package className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block text-xs">Stock de Depósito</span>
                            <span className="text-[11px] text-slate-400">Ingresos, compras y Kardex</span>
                        </div>
                    </Link>

                    <Link
                        href="/rrhh/personal/epp?tab=solicitudes"
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center gap-3 hover:border-emerald-500 transition-colors"
                    >
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 rounded-lg">
                            <Activity className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block text-xs">Solicitudes del Personal</span>
                            <span className="text-[11px] text-slate-400">Pedidos de recambio o rotura</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
