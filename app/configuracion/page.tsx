'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, LayoutGrid, Palette, Radio, Settings, Users } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Panel } from '@/components/ui';
import { ViewsSection } from '@/components/configuracion/secciones';
import { useViewState } from '@/lib/hooks/useViewState';
import { useAcceso } from '@/lib/store/useAccessStore';

type ConfigTab = 'indice' | 'vistas';

/** Dónde quedó cada ajuste que antes estaba en esta pantalla (auditoría, P19). */
const DESTINOS = [
    {
        href: '/projects/ajustes',
        titulo: 'Proyectos → Ajustes',
        icono: <LayoutGrid />,
        contenido: 'Etiquetas, checklists por etiqueta, categorías y tipos de actividad, áreas y motivos de demora, valor de la hora de mano de obra',
        vista: '/projects',
    },
    {
        href: '/monitoreo-fichadas/ajustes',
        titulo: 'Asistencia y horas → Ajustes',
        icono: <Radio />,
        contenido: 'Alerta diaria de carga de horas, fichaje en la base (GPS y QR) y causas de registro de tiempo',
        vista: '/monitoreo-fichadas',
    },
    {
        href: '/clients',
        titulo: 'Clientes → ficha del cliente',
        icono: <Users />,
        contenido: 'Lista de precios, % sobre materiales, crédito, tarifas de OT, responsables y sectores del portal',
        vista: '/clients',
    },
] as const;

/**
 * Configuración general. Los catálogos de cada módulo se configuran en el módulo que los usa;
 * acá quedan los roles por vista (control de accesos) y el índice de dónde está cada ajuste.
 */
export default function ConfigPage() {
    const router = useRouter();
    const { role, puedeVer, puede } = useAcceso();
    const [filters, setFilters] = useViewState('configuracion-filters', { activeTab: 'indice' as ConfigTab });

    // Roles por vista es control de accesos: misma función que exige PUT /api/config/views.
    const tabs = [
        { id: 'indice', label: 'Dónde se configura', icon: <Settings /> },
        ...(puede('config.vistas') ? [{ id: 'vistas', label: 'Roles por vista', icon: <Eye /> }] : []),
    ];
    const activeTab: ConfigTab = tabs.some(t => t.id === filters.activeTab) ? filters.activeTab : 'indice';

    const permitido = !!role && puedeVer('/configuracion');

    useEffect(() => {
        if (role && !puedeVer('/configuracion')) router.replace('/');
    }, [role, puedeVer, router]);

    if (!permitido) return null;

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title="Configuración"
                description="Cada módulo se configura donde se usa; acá están los accesos por rol"
                icon={<Settings />}
                tabs={tabs}
                activeTabId={activeTab}
                onTabChange={t => setFilters({ activeTab: t as ConfigTab })}
            />

            {activeTab === 'indice' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {DESTINOS.filter(d => puedeVer(d.vista)).map(d => (
                        <Panel key={d.href} title={<span className="flex items-center gap-2 [&>svg]:w-4 [&>svg]:h-4">{d.icono}{d.titulo}</span>}>
                            <p className="text-sm text-muted-foreground">{d.contenido}</p>
                            <Link href={d.href} className="btn btn-secondary btn-sm mt-3">
                                Abrir <ArrowRight aria-hidden="true" />
                            </Link>
                        </Panel>
                    ))}
                    <Panel title={<span className="flex items-center gap-2 [&>svg]:w-4 [&>svg]:h-4"><Palette />Color de acento</span>}>
                        <p className="text-sm text-muted-foreground">Es una preferencia de cada persona: se cambia desde su menú, abajo a la izquierda.</p>
                    </Panel>
                </div>
            )}

            {activeTab === 'vistas' && (
                <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
                    <ViewsSection />
                </div>
            )}
        </div>
    );
}
