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

    const updateState = (newState: Partial<T> | ((prev: T) => Partial<T>)) => {
        setLocalState((prev) => {
            const updated = typeof newState === 'function' ? (newState as any)(prev) : newState;
            let nextState: T;
            if (typeof prev === 'object' && prev !== null && !Array.isArray(prev)) {
                nextState = { ...prev, ...updated };
            } else {
                nextState = updated;
            }
            setStoreState(key, nextState);
            return nextState;
        });
    };

    return [localState, updateState];
}
