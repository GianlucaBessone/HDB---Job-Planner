'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialogBase } from './Dialog';

interface OpcionesConfirmar {
    title: string;
    message?: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'warning' | 'primary';
}

/**
 * Confirmación con el diálogo del sistema en lugar de `window.confirm` (P34): `await confirmar({...})` devuelve
 * true o false. Hay que renderizar el `dialogo` que devuelve el hook en la pantalla.
 */
export function useConfirmar(): [(opciones: OpcionesConfirmar) => Promise<boolean>, React.ReactNode] {
    const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null);
    const resolver = useRef<((ok: boolean) => void) | null>(null);

    const confirmar = useCallback((o: OpcionesConfirmar) => {
        resolver.current?.(false);
        setOpciones(o);
        return new Promise<boolean>(resolve => { resolver.current = resolve; });
    }, []);

    const cerrar = (ok: boolean) => {
        resolver.current?.(ok);
        resolver.current = null;
        setOpciones(null);
    };

    const dialogo = (
        <ConfirmDialogBase
            open={!!opciones}
            onCancel={() => cerrar(false)}
            onConfirm={() => cerrar(true)}
            title={opciones?.title ?? ''}
            message={opciones?.message}
            detail={opciones?.detail}
            confirmLabel={opciones?.confirmLabel ?? 'Confirmar'}
            cancelLabel={opciones?.cancelLabel ?? 'Cancelar'}
            tone={opciones?.tone ?? 'danger'}
        />
    );
    return [confirmar, dialogo];
}
