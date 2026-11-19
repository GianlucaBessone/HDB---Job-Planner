import { useEffect, useState } from 'react';
import { useViewStateStore } from '../store/useViewStateStore';

export function useViewState<T>(key: string, initialState: T): [T, (state: Partial<T> | ((prev: T) => Partial<T>)) => void] {
    const storeState = useViewStateStore((state) => state.getState(key));
    const setStoreState = useViewStateStore((state) => state.setState);

    const [localState, setLocalState] = useState<T>(() => {
        if (storeState !== null && storeState !== undefined) {
            const isInitialObject = typeof initialState === 'object' && initialState !== null && !Array.isArray(initialState);
            const isStoreObject = typeof storeState === 'object' && storeState !== null && !Array.isArray(storeState);

            if (isInitialObject && isStoreObject) {
                return { ...initialState, ...storeState };
            }
            if (!isInitialObject) {
                if (typeof storeState === typeof initialState) {
                    return storeState;
                }
                return initialState;
            }
            return storeState;
        }
        return initialState;
    });

    // El store global se sincroniza después del render. Actualizarlo dentro del
    // updater de setState disparaba "Cannot update a component while rendering
    // a different component" en las pantallas con pestañas o filtros.
    useEffect(() => {
        setStoreState(key, localState);
    }, [key, localState, setStoreState]);

    const updateState = (newState: Partial<T> | ((prev: T) => Partial<T>)) => {
        setLocalState((prev) => {
            const updated = typeof newState === 'function' ? (newState as any)(prev) : newState;
            if (typeof prev === 'object' && prev !== null && !Array.isArray(prev)) {
                return { ...prev, ...updated };
            }
            return updated;
        });
    };

    return [localState, updateState];
}
