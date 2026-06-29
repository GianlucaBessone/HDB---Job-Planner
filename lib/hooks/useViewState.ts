import { useEffect, useState } from 'react';
import { useViewStateStore } from '../store/useViewStateStore';

export function useViewState<T>(key: string, initialState: T): [T, (state: Partial<T> | ((prev: T) => Partial<T>)) => void] {
    const storeState = useViewStateStore((state) => state.getState(key));
    const setStoreState = useViewStateStore((state) => state.setState);

    const [localState, setLocalState] = useState<T>(() => {
        if (storeState) {
            return { ...initialState, ...storeState };
        }
        return initialState;
    });

    const updateState = (newState: Partial<T> | ((prev: T) => Partial<T>)) => {
        setLocalState((prev) => {
            const updated = typeof newState === 'function' ? (newState as any)(prev) : newState;
            const nextState = { ...prev, ...updated };
            setStoreState(key, nextState);
            return nextState;
        });
    };

    return [localState, updateState];
}
