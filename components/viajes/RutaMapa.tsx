'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { RutaMapaProps } from './RutaMapaContent';

// Leaflet usa window: el mapa se carga solo en el navegador.
const Contenido = dynamic(() => import('./RutaMapaContent'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 bg-surface-sunken">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando mapa…
        </div>
    ),
});

export default function RutaMapa(props: RutaMapaProps) {
    return <Contenido {...props} />;
}
