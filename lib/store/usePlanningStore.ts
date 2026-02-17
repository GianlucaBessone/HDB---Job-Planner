import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlanningState {
    fecha: string;
    blocksByDate: Record<string, any[]>;
    setFecha: (fecha: string) => void;
    setBlocksForDate: (fecha: string, blocks: any[]) => void;
    clearBlocksForDate: (fecha: string) => void;
}

export const usePlanningStore = create<PlanningState>()(
    persist(
        (set) => ({
            fecha: '',
            blocksByDate: {},
            setFecha: (fecha: string) => set({ fecha }),
            setBlocksForDate: (fecha: string, blocks: any[]) =>
                set((state) => ({
                    blocksByDate: {
                        ...state.blocksByDate,
                        [fecha]: blocks
                    }
                })),
            clearBlocksForDate: (fecha: string) =>
                set((state) => {
                    const newBlocksByDate = { ...state.blocksByDate };
                    delete newBlocksByDate[fecha];
                    return { blocksByDate: newBlocksByDate };
                }),
        }),
        {
            name: 'planning-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
