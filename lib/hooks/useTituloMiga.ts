import { useEffect } from 'react';
import { useHistoryStore } from '@/lib/store/useHistoryStore';

/** Nombre de una ruta en las migas de pan (en lugar del segmento de la URL). */
export function useTituloMiga(ruta: string, titulo: string | null | undefined) {
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        if (!titulo) return;
        const t = setTimeout(() => setTitle(ruta, titulo), 0);
        return () => clearTimeout(t);
    }, [ruta, titulo, setTitle]);
}
