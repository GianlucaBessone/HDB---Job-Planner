'use client';

import { useState } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { EmptyState, LoadingState, Tabs } from '@/components/ui';
import { ChecklistSection, OSSection, OptionsSection, TagsSection } from '@/components/configuracion/secciones';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useTituloMiga } from '@/lib/hooks/useTituloMiga';

type Seccion = 'etiquetas' | 'checklists' | 'clasificacion' | 'demoras' | 'mano_obra';

const SECCIONES: { id: Seccion; label: string }[] = [
    { id: 'etiquetas', label: 'Etiquetas' },
    { id: 'checklists', label: 'Checklists por etiqueta' },
    { id: 'clasificacion', label: 'Categorías y actividades' },
    { id: 'demoras', label: 'Demoras del cliente' },
    { id: 'mano_obra', label: 'Mano de obra' },
];

/**
 * Ajustes de Proyectos (auditoría, P19): los catálogos que usan los proyectos, junto a
 * los proyectos. Antes estaban mezclados en Configuración con los de otros módulos.
 */
export default function AjustesProyectosPage() {
    const { puede, cargado } = useAcceso();
    useTituloMiga('/projects/ajustes', 'Ajustes');
    const [seccion, setSeccion] = useState<Seccion>('etiquetas');

    return (
        <div className="w-full space-y-6">
            <ProjectsHeader activeTabId="ajustes" />
            {!cargado ? (
                <LoadingState label="Cargando…" />
            ) : !puede('config.administrar') ? (
                <EmptyState title="Sin acceso a los ajustes" description="Los ajustes de proyectos los cambia quien administra la configuración." />
            ) : (
                <>
                    <Tabs label="Ajustes de proyectos" tabs={SECCIONES} value={seccion} onChange={id => setSeccion(id as Seccion)} />
                    <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
                        {seccion === 'etiquetas' && <TagsSection />}
                        {seccion === 'checklists' && <ChecklistSection />}
                        {seccion === 'clasificacion' && <OptionsSection titulo="Categorías y tipos de actividad" categorias={['CATEGORIA', 'TIPO_ACTIVIDAD']} />}
                        {seccion === 'demoras' && <OptionsSection titulo="Áreas y motivos de demora" categorias={['AREA_DEMORA', 'MOTIVO_DEMORA']} />}
                        {seccion === 'mano_obra' && <OSSection />}
                    </div>
                </>
            )}
        </div>
    );
}
