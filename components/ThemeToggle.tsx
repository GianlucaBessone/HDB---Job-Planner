"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Placeholder del mismo tamaño mientras monta, para evitar saltos
    if (!mounted) {
        return <span className="inline-block w-9 h-9 shrink-0" aria-hidden="true" />;
    }

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="btn btn-ghost btn-icon btn-icon-inline"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
            {isDark ? <Sun /> : <Moon />}
        </button>
    );
}
