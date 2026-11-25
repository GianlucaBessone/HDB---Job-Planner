'use client';

import Link from 'next/link';
import { Calculator, FileSignature } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAcceso } from '@/lib/store/useAccessStore';

/**
 * Presupuestos en una sola entrada con dos tipos (auditoría, P35 / FU4): de productos (cotización, pasa a venta)
 * y de servicio (pasa a proyecto). Cada tipo conserva su editor; esto solo los conecta. Muestra los tipos que la
 * persona puede abrir.
 */
export const TIPOS_PRESUPUESTO = [
    { id: 'productos', label: 'De productos', descripcion: 'Se convierte en venta', href: '/ventas/cotizaciones', Icono: FileSignature },
    { id: 'servicio', label: 'De servicio', descripcion: 'Se convierte en proyecto', href: '/presupuestos-servicio', Icono: Calculator },
] as const;

export default function TiposPresupuesto({ actual, className }: { actual: 'productos' | 'servicio'; className?: string }) {
    const { puedeVer } = useAcceso();
    const tipos = TIPOS_PRESUPUESTO.filter((t) => puedeVer(t.href));
    if (tipos.length < 2) return null;
    return (
        <nav aria-label="Tipo de presupuesto" className={cn('flex items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1 w-fit', className)}>
            {tipos.map(({ id, label, descripcion, href, Icono }) => (
                <Link
                    key={id}
                    href={href}
                    title={descripcion}
                    aria-current={actual === id ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-colors',
                        actual === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <Icono className="w-4 h-4" aria-hidden="true" />
                    {label}
                </Link>
            ))}
        </nav>
    );
}
