'use client';

import { Suspense } from 'react';
import SeccionCalidad from '../SeccionCalidad';

/** Calidad → Mejora (P29). */
export default function CalidadMejoraPage() {
    return (
        <Suspense fallback={null}>
            <SeccionCalidad seccion="mejora" />
        </Suspense>
    );
}
