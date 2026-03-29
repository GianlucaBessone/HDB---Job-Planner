'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DynamicMapPicker = dynamic(
    () => import('./MapPickerContent'),
    { 
        ssr: false,
        loading: () => (
            <div className="h-[300px] w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">Cargando Mapa...</span>
            </div>
        )
    }
);

interface MapPickerProps {
    lat: number | null;
    lng: number | null;
    radius: number | null;
    onChange: (lat: number, lng: number, radius: number) => void;
}

export default function MapPicker({ lat, lng, radius, onChange }: MapPickerProps) {
    return <DynamicMapPicker lat={lat} lng={lng} radius={radius} onChange={onChange} />;
}
