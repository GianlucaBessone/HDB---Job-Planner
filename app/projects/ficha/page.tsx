'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';
import { useAcceso } from '@/lib/store/useAccessStore';

/** "/projects/ficha" sin proyecto (miga de pan): vuelve a la lista que corresponda. */
export default function FichaSinProyecto() {
    const router = useRouter();
    const { puedeVer, cargado } = useAcceso();
    useEffect(() => {
        if (cargado) router.replace(puedeVer('/projects') ? '/projects' : '/my-projects');
    }, [cargado, puedeVer, router]);
    return <LoadingState label="Abriendo proyectos…" />;
}
