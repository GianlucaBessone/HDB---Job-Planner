'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lugar } from './distancia';

export interface RutaMapaProps {
    origen: Lugar | null;
    destino: Lugar | null;
    trazado: [number, number][];
    /** Qué punto marca un toque en el mapa. */
    marcando: 'A' | 'B';
    onPick: (marca: 'A' | 'B', lat: number, lon: number) => void;
}

const CENTRO_AR: [number, number] = [-31.4, -64.2]; // Córdoba

const icono = (marca: 'A' | 'B') => L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    html: `<span class="flex items-center justify-center w-7 h-7 rounded-full rounded-bl-none -rotate-45 border-2 border-white shadow-lg ${marca === 'A' ? 'bg-success-600' : 'bg-danger-600'}"><span class="rotate-45 text-white text-xs font-semibold">${marca}</span></span>`,
});

function Clicks({ marcando, onPick }: Pick<RutaMapaProps, 'marcando' | 'onPick'>) {
    useMapEvents({ click: e => onPick(marcando, e.latlng.lat, e.latlng.lng) });
    return null;
}

/**
 * Encuadra los puntos elegidos (y el trazado) cada vez que cambian.
 * Dentro de un diálogo animado Leaflet mide su tamaño antes de tiempo:
 * se vuelve a medir cuando cambia el contenedor y recién ahí se encuadra.
 */
function Encuadre({ puntos }: { puntos: [number, number][] }) {
    const map = useMap();
    const clave = puntos.map(p => p.join(',')).join(';');
    const ultimos = useRef(puntos);
    ultimos.current = puntos;

    const encuadrar = () => {
        const pts = ultimos.current;
        if (pts.length === 0) return;
        if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 10));
        else map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13 });
    };

    useEffect(() => {
        const el = map.getContainer();
        const ro = new ResizeObserver(() => { map.invalidateSize(); encuadrar(); });
        ro.observe(el);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        map.invalidateSize();
        encuadrar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, map]);
    return null;
}

export default function RutaMapaContent({ origen, destino, trazado, marcando, onPick }: RutaMapaProps) {
    const iconoA = useMemo(() => icono('A'), []);
    const iconoB = useMemo(() => icono('B'), []);
    const puntos = [origen, destino].filter(Boolean).map(l => [l!.lat, l!.lon] as [number, number]);
    const encuadre = trazado.length > 1 ? trazado : puntos;

    return (
        // En el celular el arrastre con un dedo queda para el scroll del formulario: se marca tocando y se hace zoom con dos dedos.
        <MapContainer center={puntos[0] || CENTRO_AR} zoom={puntos.length ? 10 : 6} scrollWheelZoom dragging={!L.Browser.mobile} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Clicks marcando={marcando} onPick={onPick} />
            <Encuadre puntos={encuadre} />
            {trazado.length > 1 && <Polyline positions={trazado} pathOptions={{ color: '#2F74DA', weight: 4, opacity: 0.85 }} />}
            {origen && (
                <Marker
                    position={[origen.lat, origen.lon]}
                    icon={iconoA}
                    draggable
                    title="Origen"
                    eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onPick('A', p.lat, p.lng); } }}
                />
            )}
            {destino && (
                <Marker
                    position={[destino.lat, destino.lon]}
                    icon={iconoB}
                    draggable
                    title="Destino"
                    eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onPick('B', p.lat, p.lng); } }}
                />
            )}
        </MapContainer>
    );
}
