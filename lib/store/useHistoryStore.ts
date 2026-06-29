import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryEntry {
    url: string;
    title: string;
    timestamp: number;
}

interface HistoryState {
    entries: HistoryEntry[];
    titles: Record<string, string>; // Maps url to human-readable title
    push: (url: string, title: string) => void;
    pop: () => HistoryEntry | null;
    clear: () => void;
    getPrevious: () => HistoryEntry | null;
    sliceTo: (index: number) => void;
    setTitle: (url: string, title: string) => void;
}

const MAX_HISTORY = 50;

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            entries: [],
            titles: {},
            push: (url, title) => set((state) => {
                const newTitles = { ...state.titles, [url]: title };
                
                // Avoid consecutive duplicates
                const last = state.entries[state.entries.length - 1];
                if (last && last.url === url) {
                    return { titles: newTitles };
                }
                
                const newEntries = [...state.entries, { url, title, timestamp: Date.now() }];
                if (newEntries.length > MAX_HISTORY) {
                    newEntries.shift(); // Remove oldest
                }
                return { entries: newEntries, titles: newTitles };
            }),
            pop: () => {
                const currentEntries = get().entries;
                if (currentEntries.length <= 1) return null;
                
                // Remove the current page (last entry)
                const newEntries = [...currentEntries];
                newEntries.pop(); // Pop current
                
                // Return the new last entry (which is the previous page)
                const previous = newEntries[newEntries.length - 1];
                set({ entries: newEntries });
                return previous;
            },
            getPrevious: () => {
                const entries = get().entries;
                if (entries.length <= 1) return null;
                return entries[entries.length - 2];
            },
            sliceTo: (index: number) => {
                set((state) => ({
                    entries: state.entries.slice(0, index + 1)
                }));
            },
            setTitle: (url: string, title: string) => {
                set((state) => ({
                    titles: { ...state.titles, [url]: title }
                }));
            },
            clear: () => set({ entries: [] }),
        }),
        {
            name: 'hdb-navigation-history',
        }
    )
);
