'use client';

import { Suspense } from 'react';
import SeccionCalidad from './SeccionCalidad';

/** Calidad → Documentos (P29). Las pestañas que pasaron a otras entradas redirigen (`?tab=nc`, etc.). */
export default function CalidadDocumentosPage() {
    return (
        <Suspense fallback={null}>
            <SeccionCalidad seccion="documentos" />
        </Suspense>
    );
}
