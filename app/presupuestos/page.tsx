'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';
import { useAcceso } from '@/lib/store/useAccessStore';
import { TIPOS_PRESUPUESTO } from '@/components/presupuestos/TiposPresupuesto';

/**
 * Comercial → Presupuestos (P35): una sola entrada para los dos tipos. Abre el de servicio si la persona puede
 * verlo y si no el de productos; dentro de cada uno se cambia de tipo con "De productos | De servicio".
 */
export default function PresupuestosPage() {
    const router = useRouter();
    const { puedeVer } = useAcceso();

    useEffect(() => {
        const destino = [...TIPOS_PRESUPUESTO].reverse().find((t) => puedeVer(t.href));
        router.replace(destino?.href ?? '/');
    }, [puedeVer, router]);

    return <LoadingState label="Abriendo presupuestos…" />;
}
