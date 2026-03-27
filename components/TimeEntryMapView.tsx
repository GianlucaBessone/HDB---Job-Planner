'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DynamicMap = dynamic<TimeEntryMapViewProps>(
    () => import('./TimeEntryMapViewContent'),
    { 
        ssr: false,
        loading: () => (
            <div className="h-full w-full bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Cargando Mapa...</span>
            </div>
        )
    }
);

interface TimeEntryMapViewProps {
    lat: number;
    lng: number;
}

export default function TimeEntryMapView({ lat, lng }: TimeEntryMapViewProps) {
    return <DynamicMap lat={lat} lng={lng} />;
}
