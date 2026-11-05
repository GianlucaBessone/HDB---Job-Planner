'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { RutaMapaProps } from './RutaMapaContent';
import { alRechazarGoogle, googleDisponible } from './googleMaps';

const cargando = () => (
    <div className="h-full w-full flex items-center justify-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 bg-surface-sunken">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando mapa…
    </div>
);

// Los dos mapas usan window: se cargan solo en el navegador.
const MapaOSM = dynamic(() => import('./RutaMapaContent'), { ssr: false, loading: cargando });
const MapaGoogle = dynamic(() => import('./RutaMapaGoogle'), { ssr: false, loading: cargando });

/** Google Maps si está configurado; si no (o si rechaza la clave), OpenStreetMap. */
export default function RutaMapa(props: RutaMapaProps) {
    const [google, setGoogle] = useState(false);
    useEffect(() => {
        setGoogle(googleDisponible());
        return alRechazarGoogle(() => setGoogle(false));
    }, []);
    return google
        ? <MapaGoogle {...props} onError={() => setGoogle(false)} />
        : <MapaOSM {...props} />;
}
