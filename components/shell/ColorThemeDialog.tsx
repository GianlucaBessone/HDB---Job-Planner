'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { Dialog } from '@/components/ui';
import { useColorTheme, type ColorTheme } from '@/components/ColorThemeProvider';
import { cn } from '@/lib/cn';

// Muestras del color de acento de cada tema (claro / oscuro). Son la vista previa
// del tema, no colores de la interfaz: por eso van como estilo en línea.
const TEMAS: { id: ColorTheme; nombre: string; claro: string; oscuro: string }[] = [
    { id: 'actual', nombre: 'Azul (predeterminado)', claro: '#2563EB', oscuro: '#3B82F6' },
    { id: 'indigo', nombre: 'Índigo', claro: '#5B4EF5', oscuro: '#7368F7' },
    { id: 'naranja', nombre: 'Naranja', claro: '#F97316', oscuro: '#EA580C' },
    { id: 'verde', nombre: 'Verde', claro: '#16A34A', oscuro: '#22C55E' },
    { id: 'celeste', nombre: 'Celeste', claro: '#0EA5E9', oscuro: '#38BDF8' },
    { id: 'rojo', nombre: 'Rojo', claro: '#EF4444', oscuro: '#F87171' },
    { id: 'rosa', nombre: 'Rosa', claro: '#EC4899', oscuro: '#F472B6' },
    { id: 'violeta', nombre: 'Violeta', claro: '#8B5CF6', oscuro: '#A855F7' },
    { id: 'gris', nombre: 'Gris', claro: '#64748B', oscuro: '#94A3B8' },
];

/** Preferencia personal: el color de acento se guarda solo en este dispositivo. */
export function ColorThemeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { theme, setTheme } = useColorTheme();
    const [montado, setMontado] = useState(false);
    useEffect(() => setMontado(true), []);

    // Se abre desde la barra lateral: va al body para no quedar dentro de su capa.
    if (!montado || !open) return null;

    return createPortal(
        <Dialog
            open={open}
            onClose={onClose}
            title="Color de acento"
            description="Se aplica a botones, íconos y marcas. Se guarda en este dispositivo."
            size="md"
        >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Color de acento">
                {TEMAS.map(t => {
                    const activo = theme === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            onClick={() => setTheme(t.id)}
                            className={cn(
                                'relative flex flex-col gap-2 p-2.5 rounded-lg border text-left transition-colors',
                                activo ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                            )}
                        >
                            <span className="flex h-8 w-full overflow-hidden rounded-md" aria-hidden="true">
                                <span className="flex-1" style={{ backgroundColor: t.claro }} />
                                <span className="flex-1" style={{ backgroundColor: t.oscuro }} />
                            </span>
                            <span className="text-[13px] font-medium text-foreground">{t.nombre}</span>
                            {activo && (
                                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                    <Check className="w-3 h-3" aria-hidden="true" />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </Dialog>,
        document.body
    );
}
