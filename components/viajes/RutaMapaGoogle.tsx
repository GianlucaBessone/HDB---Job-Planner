'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cargarGoogleMaps } from './googleMaps';
import type { RutaMapaProps } from './RutaMapaContent';
import { tieneCoordenadas } from './distancia';

const CENTRO_AR = { lat: -31.4, lng: -64.2 }; // Córdoba
const COLOR = { A: '#059669', B: '#DC2626' }; // success-600 / danger-600
const RUTA = '#2F74DA'; // brand (paleta de gráficos)

function icono(g: any, marca: 'A' | 'B') {
    return {
        path: g.SymbolPath.CIRCLE,
        scale: 13,
        fillColor: COLOR[marca],
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
    };
}

/** Mapa de Google con origen (A), destino (B) y ruta. Avisa con onError si no se puede cargar. */
export default function RutaMapaGoogle({ origen, destino, trazado, marcando, onPick, onError }: RutaMapaProps & { onError: () => void }) {
    const divRef = useRef<HTMLDivElement>(null);
    const mapa = useRef<any>(null);
    const gRef = useRef<any>(null);
    const marcadores = useRef<{ A: any; B: any }>({ A: null, B: null });
    const linea = useRef<any>(null);
    const props = useRef({ marcando, onPick });
    props.current = { marcando, onPick };
    const [listo, setListo] = useState(false);

    // Crear el mapa una sola vez
    useEffect(() => {
        let vivo = true;
        cargarGoogleMaps()
            .then(g => {
                if (!vivo || !divRef.current) return;
                gRef.current = g;
                const movil = window.matchMedia('(pointer: coarse)').matches;
                mapa.current = new g.Map(divRef.current, {
                    center: CENTRO_AR,
                    zoom: 6,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: false,
                    // En el celular un dedo hace scroll del formulario y dos mueven el mapa.
                    gestureHandling: movil ? 'cooperative' : 'greedy',
                });
                mapa.current.addListener('click', (e: any) => {
                    if (!e.latLng) return;
                    props.current.onPick(props.current.marcando, e.latLng.lat(), e.latLng.lng());
                });
                setListo(true);
            })
            .catch(() => { if (vivo) onError(); });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Marcadores, ruta y encuadre
    useEffect(() => {
        const g = gRef.current;
        const m = mapa.current;
        if (!listo || !g || !m) return;

        const sincronizar = (marca: 'A' | 'B', lugar: typeof origen) => {
            const actual = marcadores.current[marca];
            if (!tieneCoordenadas(lugar)) {
                actual?.setMap(null);
                marcadores.current[marca] = null;
                return;
            }
            const pos = { lat: lugar!.lat, lng: lugar!.lon };
            if (actual) { actual.setPosition(pos); return; }
            const nuevo = new g.Marker({
                map: m,
                position: pos,
                draggable: true,
                title: marca === 'A' ? 'Origen' : 'Destino',
                icon: icono(g, marca),
                label: { text: marca, color: '#ffffff', fontSize: '12px', fontWeight: '600' },
            });
            nuevo.addListener('dragend', (e: any) => props.current.onPick(marca, e.latLng.lat(), e.latLng.lng()));
            marcadores.current[marca] = nuevo;
        };
        sincronizar('A', origen);
        sincronizar('B', destino);

        linea.current?.setMap(null);
        linea.current = trazado.length > 1
            ? new g.Polyline({ map: m, path: trazado.map(([lat, lng]) => ({ lat, lng })), strokeColor: RUTA, strokeOpacity: 0.85, strokeWeight: 4 })
            : null;

        const puntos: { lat: number; lng: number }[] = trazado.length > 1
            ? trazado.map(([lat, lng]) => ({ lat, lng }))
            : [origen, destino].filter(tieneCoordenadas).map(l => ({ lat: l!.lat, lng: l!.lon }));
        if (puntos.length === 1) {
            m.setCenter(puntos[0]);
            if (m.getZoom() < 10) m.setZoom(10);
        } else if (puntos.length > 1) {
            const b = new g.LatLngBounds();
            puntos.forEach(p => b.extend(p));
            m.fitBounds(b, 40);
        }
    }, [listo, origen?.lat, origen?.lon, destino?.lat, destino?.lon, trazado]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="relative h-full w-full">
            <div ref={divRef} className="h-full w-full" />
            {!listo && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 bg-surface-sunken">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando mapa…
                </div>
            )}
        </div>
    );
}
