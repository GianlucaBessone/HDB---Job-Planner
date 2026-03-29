'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerContentProps {
    lat: number | null;
    lng: number | null;
    radius: number | null;
    onChange: (lat: number, lng: number, radius: number) => void;
}

function MapEvents({ onLocationClick }: { onLocationClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function ChangeView({ center }: { center: L.LatLngExpression }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom());
        }
    }, [center, map]);
    return null;
}

export default function MapPickerContent({ lat, lng, radius, onChange }: MapPickerContentProps) {
    const [currentPos, setCurrentPos] = useState<[number, number] | null>(
        lat && lng ? [lat, lng] : null
    );
    const [mapRadius, setMapRadius] = useState<number>(radius || 100);

    const defaultCenter: [number, number] = [-34.6037, -58.3816]; // Buenos Aires

    useEffect(() => {
        if (lat && lng) {
            setCurrentPos([lat, lng]);
        }
    }, [lat, lng]);

    useEffect(() => {
        if (radius) {
            setMapRadius(radius);
        }
    }, [radius]);

    useEffect(() => {
        // Auto-detect location if none provided
        if (!lat && !lng && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const pos: [number, number] = [latitude, longitude];
                    setCurrentPos(pos);
                    // Don't auto-save to parent immediately to avoid unintended changes 
                    // unless the user clicks the map, or we can auto-save if it's a new config.
                    // For now, just centering the map is safer UX.
                },
                (error) => console.log("Geolocation error:", error),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }, []);

    const handleMapClick = (lat: number, lng: number) => {
        setCurrentPos([lat, lng]);
        onChange(lat, lng, mapRadius);
    };

    const handleRadiusChange = (newRadius: number) => {
        setMapRadius(newRadius);
        if (currentPos) {
            onChange(currentPos[0], currentPos[1], newRadius);
        }
    };

    return (
        <div className="space-y-4">
            <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0">
                <MapContainer
                    center={currentPos || defaultCenter}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapEvents onLocationClick={handleMapClick} />
                    {currentPos && (
                        <>
                            <Marker position={currentPos} />
                            <Circle 
                                center={currentPos} 
                                radius={mapRadius} 
                                pathOptions={{ 
                                    color: '#2563eb', 
                                    fillColor: '#2563eb', 
                                    fillOpacity: 0.2 
                                }} 
                            />
                            <ChangeView center={currentPos} />
                        </>
                    )}
                </MapContainer>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex justify-between">
                        <span>Ajustar Radio</span>
                        <span>{mapRadius}m</span>
                    </label>
                    <input 
                        type="range" 
                        min="10" 
                        max="2000" 
                        step="10"
                        value={mapRadius}
                        onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                </div>
                <button
                    type="button"
                    title="Centrar en mi ubicación"
                    onClick={() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                                handleMapClick(pos.coords.latitude, pos.coords.longitude);
                            });
                        }
                    }}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-primary hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all active:scale-95 shadow-sm"
                >
                    <MapPin className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
