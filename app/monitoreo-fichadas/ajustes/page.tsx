'use client';

import { Settings } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { AsistenciaNav } from '@/components/asistencia/AsistenciaNav';
import { EmptyState, LoadingState } from '@/components/ui';
import { OptionsSection, SystemSection } from '@/components/configuracion/secciones';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useTituloMiga } from '@/lib/hooks/useTituloMiga';

/**
 * Ajustes de Asistencia y horas (auditoría, P19): la alerta de carga de horas, el
 * fichaje en la base y las causas de registro de tiempo. Antes estaban en Configuración.
 */
export default function AjustesAsistenciaPage() {
    const { puede, cargado } = useAcceso();
    useTituloMiga('/monitoreo-fichadas/ajustes', 'Ajustes');

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title="Ajustes de asistencia"
                description="Alerta de carga de horas, fichaje en la base y causas de registro"
                icon={<Settings />}
            />
            <AsistenciaNav />
            {!cargado ? (
                <LoadingState label="Cargando…" />
            ) : !puede('config.administrar') ? (
                <EmptyState title="Sin acceso a los ajustes" description="Los ajustes de asistencia los cambia quien administra la configuración." />
            ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
                        <SystemSection />
                    </div>
                    <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
                        <OptionsSection titulo="Causas de registro de tiempo" categorias={['CAUSA_REGISTRO']} />
                    </div>
                </div>
            )}
        </div>
    );
}
