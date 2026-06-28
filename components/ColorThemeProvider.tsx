'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ColorTheme = 'actual' | 'indigo' | 'naranja' | 'verde' | 'celeste' | 'rojo' | 'rosa' | 'violeta' | 'gris';

interface ColorThemeContextType {
    theme: ColorTheme;
    setTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ColorTheme>('actual');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('color-theme') as ColorTheme;
        if (savedTheme) {
            setThemeState(savedTheme);
            document.documentElement.setAttribute('data-color-theme', savedTheme);
        } else {
            document.documentElement.setAttribute('data-color-theme', 'actual');
        }
    }, []);

    const setTheme = (newTheme: ColorTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('color-theme', newTheme);
        document.documentElement.setAttribute('data-color-theme', newTheme);
    };

    // To prevent hydration mismatch, we render children even before mount, 
    // but the data attribute is set by the inline script in layout or immediately here.
    return (
        <ColorThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ColorThemeContext.Provider>
    );
}

export function useColorTheme() {
    const context = useContext(ColorThemeContext);
    if (context === undefined) {
        throw new Error('useColorTheme must be used within a ColorThemeProvider');
    }
    return context;
}
