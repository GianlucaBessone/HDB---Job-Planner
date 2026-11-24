'use client';

import { Suspense } from 'react';
import SeccionCalidad from '../SeccionCalidad';

/** Calidad → Formación y competencias (P29). */
export default function CalidadFormacionPage() {
    return (
        <Suspense fallback={null}>
            <SeccionCalidad seccion="formacion" />
        </Suspense>
    );
}
