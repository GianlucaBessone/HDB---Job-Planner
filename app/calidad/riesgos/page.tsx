'use client';

import { Suspense } from 'react';
import SeccionCalidad from '../SeccionCalidad';

/** Calidad → Riesgos (P29). */
export default function CalidadRiesgosPage() {
    return (
        <Suspense fallback={null}>
            <SeccionCalidad seccion="riesgos" />
        </Suspense>
    );
}
