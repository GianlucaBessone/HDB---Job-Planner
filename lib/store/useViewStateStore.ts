import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ViewStateStore {
    states: Record<string, any>;
    setState: (key: string, state: any) => void;
    getState: (key: string) => any | null;
    clearState: (key: string) => void;
    clearAll: () => void;
}

export const useViewStateStore = create<ViewStateStore>()(
    persist(
        (set, get) => ({
            states: {},
            setState: (key, state) => set((prev) => {
                const prevState = prev.states[key];
                let newState;
                if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
                    // Spread only if it's an object
                    newState = { ...(prevState || {}), ...state };
                } else {
                    // Otherwise, just replace (primitives, arrays, etc)
                    newState = state;
                }
                return {
                    states: { ...prev.states, [key]: newState }
                };
            }),
            getState: (key) => get().states[key] ?? null,
            clearState: (key) => set((prev) => {
                const newStates = { ...prev.states };
                delete newStates[key];
                return { states: newStates };
            }),
            clearAll: () => set({ states: {} }),
        }),
        {
            name: 'hdb-view-states',
            storage: createJSONStorage(() => sessionStorage)
        }
    )
);
