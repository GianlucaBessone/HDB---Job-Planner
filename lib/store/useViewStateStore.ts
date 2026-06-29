import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
            setState: (key, state) => set((prev) => ({
                states: { ...prev.states, [key]: { ...prev.states[key], ...state } }
            })),
            getState: (key) => get().states[key] || null,
            clearState: (key) => set((prev) => {
                const newStates = { ...prev.states };
                delete newStates[key];
                return { states: newStates };
            }),
            clearAll: () => set({ states: {} }),
        }),
        {
            name: 'hdb-view-states',
        }
    )
);
