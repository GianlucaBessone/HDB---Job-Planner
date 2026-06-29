import { create } from 'zustand';

interface DrawerState {
    contextIds: string[]; // List of IDs in the current table/view context
    setContextIds: (ids: string[]) => void;
    
    // Helper to find next/prev IDs
    getNextId: (currentId: string) => string | null;
    getPrevId: (currentId: string) => string | null;
}

export const useDrawerStore = create<DrawerState>((set, get) => ({
    contextIds: [],
    
    setContextIds: (ids) => set({ contextIds: ids }),
    
    getNextId: (currentId) => {
        const { contextIds } = get();
        if (!contextIds || contextIds.length === 0) return null;
        
        const idx = contextIds.indexOf(currentId);
        if (idx >= 0 && idx < contextIds.length - 1) {
            return contextIds[idx + 1];
        }
        return null;
    },
    
    getPrevId: (currentId) => {
        const { contextIds } = get();
        if (!contextIds || contextIds.length === 0) return null;
        
        const idx = contextIds.indexOf(currentId);
        if (idx > 0) {
            return contextIds[idx - 1];
        }
        return null;
    }
}));
