import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ModuleHeader from '@/components/ModuleHeader';
import { Panel, Stat } from '@/components/ui';
import { Activity, ArrowRight, Briefcase, ChevronRight, Package, ShieldCheck, Table, UserPlus, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function cargarIndicadores() {
    const hace30 = new Date(Date.now() - 30 * 86_400_000);
    try {
        const [vacantesAbiertas, urgentes, enProceso, nuevos30, totalPostulantes, operarios, eppGlobales, pendientesFirma, eppVencidos, solicitudes] = await Promise.all([
            prisma.recruitmentVacancy.count({ where: { status: 'ABIERTA' } }),
            prisma.recruitmentVacancy.count({ where: { status: 'ABIERTA', priority: { in: ['URGENTE', 'ALTA'] } } }),
            prisma.candidate.count({ where: { status: 'ACTIVO' } }),
            prisma.candidate.count({ where: { createdAt: { gte: hace30 } } }),
            prisma.candidate.count(),
            prisma.operator.count({ where: { activo: true } }),
            prisma.eppItem.count({ where: { esGlobal: true, activo: true } }),
            prisma.eppDelivery.count({ where: { estado: 'PENDIENTE_FIRMA' } }),
            prisma.eppDeliveryItem.count({ where: { estado: 'VIGENTE', fechaVencimiento: { lt: new Date() } } }),
            prisma.eppRequest.count({ where: { estado: 'PENDIENTE' } }).catch(() => 0),
        ]);
        return { vacantesAbiertas, urgentes, enProceso, nuevos30, totalPostulantes, operarios, eppGlobales, pendientesFirma, eppVencidos, solicitudes, error: false };
    } catch (e) {
        console.error('[RRHH] Error al cargar indicadores', e);
        return { vacantesAbiertas: 0, urgentes: 0, enProceso: 0, nuevos30: 0, totalPostulantes: 0, operarios: 0, eppGlobales: 0, pendientesFirma: 0, eppVencidos: 0, solicitudes: 0, error: true };
    }
}

function Acceso({ href, icon, titulo, descripcion }: { href: string; icon: React.ReactNode; titulo: string; descripcion: string }) {
    return (
        <li>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors">
                <span className="w-8 h-8 rounded-lg border border-border bg-surface-sunken text-muted-foreground flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{titulo}</span>
                    <span className="block text-xs text-muted-foreground">{descripcion}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </Link>
        </li>
    );
}

export default async function RRHHPage() {
    const d = await cargarIndicadores();
    const atencionEpp = d.eppVencidos + d.pendientesFirma;

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title="Recursos Humanos"
                description="Reclutamiento de personal y gestión del equipo operativo"
                icon={<Users />}
            />

            {d.error && (
                <p role="alert" className="text-body text-warning-700 dark:text-warning-300">No se pudieron cargar todos los indicadores. Los accesos funcionan igual.</p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Búsquedas abiertas" value={d.vacantesAbiertas} hint={d.urgentes ? `${d.urgentes} prioritarias` : 'Sin búsquedas prioritarias'} tone={d.urgentes ? 'warning' : 'neutral'} />
                <Stat label="Postulantes en proceso" value={d.enProceso} hint={`${d.nuevos30} nuevos en 30 días`} />
                <Stat label="Personal activo" value={d.operarios} hint="Usuarios operativos activos" />
                <Stat
                    label="EPP a atender"
                    value={atencionEpp}
                    hint={`${d.eppVencidos} vencidos · ${d.pendientesFirma} sin firmar`}
                    tone={d.eppVencidos > 0 ? 'danger' : atencionEpp > 0 ? 'warning' : 'success'}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2 items-start">
                <Panel
                    title="Reclutamiento"
                    description="Vacantes, base de talentos y análisis de CV con IA"
                    padded={false}
                    actions={<Link href="/rrhh/reclutamiento" className="btn btn-secondary btn-sm">Abrir <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>}
                >
                    <ul className="divide-y divide-border">
                        <Acceso href="/rrhh/reclutamiento" icon={<Activity />} titulo="Tablero" descripcion="Embudo de selección, actividad y contrataciones" />
                        <Acceso href="/rrhh/reclutamiento/vacantes" icon={<Briefcase />} titulo="Vacantes" descripcion={`${d.vacantesAbiertas} abiertas · pipeline por etapas`} />
                        <Acceso href="/rrhh/reclutamiento/postulantes" icon={<Users />} titulo="Base de talentos" descripcion={`${d.totalPostulantes} postulantes con veracidad y match`} />
                        <Acceso href="/rrhh/reclutamiento/postulantes?nuevo=1" icon={<UserPlus />} titulo="Nuevo postulante" descripcion="Subí el CV en PDF y la IA completa la ficha" />
                    </ul>
                </Panel>

                <Panel
                    title="Personal y EPP"
                    description="Dotación de elementos de protección personal, stock y actas firmadas"
                    padded={false}
                    actions={<Link href="/rrhh/personal/epp" className="btn btn-secondary btn-sm">Abrir <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>}
                >
                    <ul className="divide-y divide-border">
                        <Acceso href="/rrhh/personal/epp?tab=matriz" icon={<Table />} titulo="Matriz de EPP" descripcion={`${d.operarios} operarios · ${d.eppGlobales} elementos de asignación general`} />
                        <Acceso href="/rrhh/personal/epp?tab=stock" icon={<Package />} titulo="Stock de depósito" descripcion="Ingresos, compras y kardex" />
                        <Acceso href="/rrhh/personal/epp?tab=solicitudes" icon={<ShieldCheck />} titulo="Solicitudes del personal" descripcion={d.solicitudes ? `${d.solicitudes} pendientes de resolver` : 'Pedidos de recambio o rotura'} />
                    </ul>
                </Panel>
            </div>
        </div>
    );
}
